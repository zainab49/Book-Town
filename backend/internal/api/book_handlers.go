package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func (s *server) handleGetBooks(c *fiber.Ctx) error {
	rows, err := s.db.Query(`
		SELECT
			id, user_id, title, author, cover_url, total_pages, current_page, status,
			started_at, finished_at, google_books_id, rating, created_at, updated_at
		FROM books
		WHERE user_id = ?
		ORDER BY
			CASE status
				WHEN 'to_read' THEN 1
				WHEN 'reading' THEN 2
				WHEN 'finished' THEN 3
				ELSE 4
			END,
			datetime(updated_at) DESC,
			id DESC
	`, getUserID(c))
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to query books")
	}
	defer rows.Close()

	books := make([]book, 0)
	for rows.Next() {
		b, err := scanBook(rows)
		if err != nil {
			return writeError(c, fiber.StatusInternalServerError, "failed to read books")
		}
		books = append(books, b)
	}
	if err := rows.Err(); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to read books")
	}

	return c.JSON(fiber.Map{"books": books})
}

func (s *server) handleCreateBook(c *fiber.Ctx) error {
	var req struct {
		Title         string   `json:"title"`
		Author        string   `json:"author"`
		CoverURL      string   `json:"cover_url"`
		Rating        *float64 `json:"rating"`
		TotalPages    *int     `json:"total_pages"`
		GoogleBooksID string   `json:"google_books_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid JSON body")
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Author = strings.TrimSpace(req.Author)
	req.CoverURL = strings.TrimSpace(req.CoverURL)
	req.GoogleBooksID = strings.TrimSpace(req.GoogleBooksID)

	if req.Title == "" {
		return writeError(c, fiber.StatusBadRequest, "title is required")
	}

	totalPages := sql.NullInt64{}
	if req.TotalPages != nil {
		if *req.TotalPages < 0 {
			return writeError(c, fiber.StatusBadRequest, "total_pages must be >= 0")
		}
		if *req.TotalPages > 0 {
			totalPages = sql.NullInt64{Int64: int64(*req.TotalPages), Valid: true}
		}
	}

	rating := sql.NullFloat64{}
	if req.Rating != nil {
		if *req.Rating < 0 || *req.Rating > 5 {
			return writeError(c, fiber.StatusBadRequest, "rating must be between 0 and 5")
		}
		rating = sql.NullFloat64{Float64: *req.Rating, Valid: true}
	}

	result, err := s.db.Exec(`
		INSERT INTO books (user_id, title, author, cover_url, rating, total_pages, current_page, status, started_at, google_books_id)
		VALUES (?, ?, ?, ?, ?, ?, 0, 'to_read', NULL, ?)
	`,
		getUserID(c),
		req.Title,
		nullIfEmpty(req.Author),
		nullIfEmpty(req.CoverURL),
		rating,
		totalPages,
		nullIfEmpty(req.GoogleBooksID),
	)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to create book")
	}

	bookID, err := result.LastInsertId()
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to create book")
	}

	b, err := s.fetchBookByID(getUserID(c), bookID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load book")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"book": b})
}

func (s *server) handleDeleteBook(c *fiber.Ctx) error {
	bookID, err := c.ParamsInt("id")
	if err != nil || bookID <= 0 {
		return writeError(c, fiber.StatusBadRequest, "invalid book id")
	}

	result, err := s.db.Exec(`DELETE FROM books WHERE id = ? AND user_id = ?`, bookID, getUserID(c))
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to delete book")
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to delete book")
	}
	if affected == 0 {
		return writeError(c, fiber.StatusNotFound, "book not found")
	}

	return c.JSON(fiber.Map{"deleted": true})
}

func (s *server) handlePatchBookStatus(c *fiber.Ctx) error {
	bookID, err := c.ParamsInt("id")
	if err != nil || bookID <= 0 {
		return writeError(c, fiber.StatusBadRequest, "invalid book id")
	}

	var req struct {
		Status     string  `json:"status"`
		StartedAt  *string `json:"started_at"`
		FinishedAt *string `json:"finished_at"`
	}
	if err := c.BodyParser(&req); err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid JSON body")
	}

	status := strings.TrimSpace(req.Status)
	if status != "to_read" && status != "reading" && status != "finished" {
		return writeError(c, fiber.StatusBadRequest, "status must be one of: to_read, reading, finished")
	}

	var requestedStarted sql.NullString
	if req.StartedAt != nil {
		startedAt, err := normalizeBookDate(*req.StartedAt)
		if err != nil {
			return writeError(c, fiber.StatusBadRequest, "invalid started_at format")
		}
		requestedStarted = sql.NullString{String: startedAt, Valid: true}
	}

	var requestedFinished sql.NullString
	if req.FinishedAt != nil {
		finishedAt, err := normalizeBookDate(*req.FinishedAt)
		if err != nil {
			return writeError(c, fiber.StatusBadRequest, "invalid finished_at format")
		}
		requestedFinished = sql.NullString{String: finishedAt, Valid: true}
	}

	tx, err := s.db.Begin()
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to start transaction")
	}
	defer tx.Rollback()

	var totalPages sql.NullInt64
	var currentPage int
	var priorStatus string
	var priorStarted sql.NullString
	queryErr := tx.QueryRow(`
		SELECT total_pages, current_page, status, started_at
		FROM books
		WHERE id = ? AND user_id = ?
	`, bookID, getUserID(c)).Scan(&totalPages, &currentPage, &priorStatus, &priorStarted)
	if errors.Is(queryErr, sql.ErrNoRows) {
		return writeError(c, fiber.StatusNotFound, "book not found")
	}
	if queryErr != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load book")
	}

	nextCurrentPage := currentPage
	nextStartedAt := sql.NullString{}
	nextFinishedAt := sql.NullString{}

	now := time.Now().UTC().Format("2006-01-02 15:04:05")

	switch status {
	case "to_read":
		nextCurrentPage = 0
	case "reading":
		if requestedStarted.Valid {
			nextStartedAt = requestedStarted
		} else if priorStarted.Valid {
			nextStartedAt = priorStarted
		} else {
			nextStartedAt = sql.NullString{String: now, Valid: true}
		}
	case "finished":
		if requestedStarted.Valid {
			nextStartedAt = requestedStarted
		} else if priorStarted.Valid {
			nextStartedAt = priorStarted
		} else {
			nextStartedAt = sql.NullString{String: now, Valid: true}
		}

		if requestedFinished.Valid {
			nextFinishedAt = requestedFinished
		} else {
			nextFinishedAt = sql.NullString{String: now, Valid: true}
		}

		if totalPages.Valid && totalPages.Int64 > 0 && int64(nextCurrentPage) < totalPages.Int64 {
			nextCurrentPage = int(totalPages.Int64)
		}
	}

	if _, err := tx.Exec(`
		UPDATE books
		SET status = ?, current_page = ?, started_at = ?, finished_at = ?
		WHERE id = ? AND user_id = ?
	`, status, nextCurrentPage, nextStartedAt, nextFinishedAt, bookID, getUserID(c)); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to update book status")
	}

	if priorStatus != "finished" && status == "finished" {
		if _, err := tx.Exec(`UPDATE users SET points = points + 50 WHERE id = ?`, getUserID(c)); err != nil {
			return writeError(c, fiber.StatusInternalServerError, "failed to update points")
		}
	}

	var newPoints int
	if err := tx.QueryRow(`SELECT points FROM users WHERE id = ?`, getUserID(c)).Scan(&newPoints); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load points")
	}

	updatedBook, err := fetchBookByIDTx(tx, getUserID(c), int64(bookID))
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load updated book")
	}

	if err := tx.Commit(); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to commit book status update")
	}

	return c.JSON(fiber.Map{
		"book":               updatedBook,
		"new_points_balance": newPoints,
	})
}

func (s *server) handlePatchBookProgress(c *fiber.Ctx) error {
	bookID, err := c.ParamsInt("id")
	if err != nil || bookID <= 0 {
		return writeError(c, fiber.StatusBadRequest, "invalid book id")
	}

	var req struct {
		CurrentPage int `json:"current_page"`
	}
	if err := c.BodyParser(&req); err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid JSON body")
	}
	if req.CurrentPage < 0 {
		return writeError(c, fiber.StatusBadRequest, "current_page must be >= 0")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to start transaction")
	}
	defer tx.Rollback()

	var totalPages sql.NullInt64
	var priorStatus string
	queryErr := tx.QueryRow(`
		SELECT total_pages, status
		FROM books
		WHERE id = ? AND user_id = ?
	`, bookID, getUserID(c)).Scan(&totalPages, &priorStatus)
	if errors.Is(queryErr, sql.ErrNoRows) {
		return writeError(c, fiber.StatusNotFound, "book not found")
	}
	if queryErr != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load book")
	}

	newCurrent := req.CurrentPage
	newStatus := "reading"
	if newCurrent == 0 {
		newStatus = "to_read"
	}

	shouldFinish := totalPages.Valid && totalPages.Int64 > 0 && int64(newCurrent) >= totalPages.Int64
	if shouldFinish {
		newCurrent = int(totalPages.Int64)
		newStatus = "finished"
	}

	if _, err := tx.Exec(`
		UPDATE books
		SET current_page = ?, status = ?, finished_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END
		WHERE id = ? AND user_id = ?
	`, newCurrent, newStatus, shouldFinish, bookID, getUserID(c)); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to update progress")
	}

	if shouldFinish && priorStatus != "finished" {
		if _, err := tx.Exec(`UPDATE users SET points = points + 50 WHERE id = ?`, getUserID(c)); err != nil {
			return writeError(c, fiber.StatusInternalServerError, "failed to update points")
		}
	}

	var newPoints int
	if err := tx.QueryRow(`SELECT points FROM users WHERE id = ?`, getUserID(c)).Scan(&newPoints); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load points")
	}

	b, err := fetchBookByIDTx(tx, getUserID(c), int64(bookID))
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load updated book")
	}

	if err := tx.Commit(); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to commit progress update")
	}

	return c.JSON(fiber.Map{
		"book":               b,
		"new_points_balance": newPoints,
	})
}

func (s *server) handleSearchBooks(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return c.JSON(fiber.Map{"results": []interface{}{}})
	}

	googleURL := "https://www.googleapis.com/books/v1/volumes?q=" + url.QueryEscape(q)
	if s.googleBooksAPIKey != "" {
		googleURL += "&key=" + url.QueryEscape(s.googleBooksAPIKey)
	}
	req, err := http.NewRequest(http.MethodGet, googleURL, nil)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to build search request")
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return writeError(c, fiber.StatusBadGateway, "google books request failed")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return writeError(c, fiber.StatusBadGateway, "google books request failed")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return writeError(c, fiber.StatusBadGateway, "failed to read google books response")
	}

	var payload googleBooksResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return writeError(c, fiber.StatusBadGateway, "failed to parse google books response")
	}

	results := make([]fiber.Map, 0, len(payload.Items))
	for _, item := range payload.Items {
		if strings.TrimSpace(item.ID) == "" {
			continue
		}
		results = append(results, fiber.Map{
			"id":        item.ID,
			"title":     item.VolumeInfo.Title,
			"authors":   item.VolumeInfo.Authors,
			"cover":     item.VolumeInfo.ImageLinks.Thumbnail,
			"rating":    item.VolumeInfo.AverageRating,
			"pageCount": item.VolumeInfo.PageCount,
		})
	}

	return c.JSON(fiber.Map{"results": results})
}

func (s *server) handleGetMyStats(c *fiber.Ctx) error {
	userID := getUserID(c)

	var started int
	if err := s.db.QueryRow(`
		SELECT COUNT(*)
		FROM books
		WHERE user_id = ? AND status IN ('reading', 'finished')
	`, userID).Scan(&started); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to compute started stats")
	}

	var finished int
	if err := s.db.QueryRow(`
		SELECT COUNT(*)
		FROM books
		WHERE user_id = ? AND status = 'finished'
	`, userID).Scan(&finished); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to compute finished stats")
	}

	var points int
	if err := s.db.QueryRow(`SELECT points FROM users WHERE id = ?`, userID).Scan(&points); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return writeError(c, fiber.StatusNotFound, "user not found")
		}
		return writeError(c, fiber.StatusInternalServerError, "failed to load user points")
	}

	ratio := 0.0
	if started > 0 {
		ratio = float64(finished) / float64(started)
	}

	return c.JSON(fiber.Map{
		"started":  started,
		"finished": finished,
		"ratio":    ratio,
		"points":   points,
	})
}

func normalizeBookDate(value string) (string, error) {
	clean := strings.TrimSpace(value)
	if clean == "" {
		return "", errors.New("empty date")
	}

	if t, err := time.Parse("2006-01-02", clean); err == nil {
		return t.UTC().Format("2006-01-02 15:04:05"), nil
	}
	if t, err := time.Parse(time.RFC3339, clean); err == nil {
		return t.UTC().Format("2006-01-02 15:04:05"), nil
	}
	if t, err := time.Parse("2006-01-02 15:04:05", clean); err == nil {
		return t.UTC().Format("2006-01-02 15:04:05"), nil
	}

	return "", errors.New("unsupported date format")
}
