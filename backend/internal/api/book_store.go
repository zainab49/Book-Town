package api

import (
	"database/sql"
	"strings"
)

func (s *server) fetchBookByID(userID, bookID int64) (book, error) {
	return fetchBookByIDTx(s.db, userID, bookID)
}

func fetchBookByIDTx(queryer interface {
	QueryRow(query string, args ...any) *sql.Row
}, userID, bookID int64) (book, error) {
	row := queryer.QueryRow(`
		SELECT
			id, user_id, title, author, cover_url, total_pages, current_page, status,
			started_at, finished_at, google_books_id, rating, created_at, updated_at
		FROM books
		WHERE id = ? AND user_id = ?
	`, bookID, userID)

	return scanBook(row)
}

func scanBook(scanner interface {
	Scan(dest ...any) error
}) (book, error) {
	var b book
	var author sql.NullString
	var coverURL sql.NullString
	var totalPages sql.NullInt64
	var startedAt sql.NullString
	var finishedAt sql.NullString
	var googleBooksID sql.NullString
	var rating sql.NullFloat64
	var createdAt sql.NullString
	var updatedAt sql.NullString

	err := scanner.Scan(
		&b.ID,
		&b.UserID,
		&b.Title,
		&author,
		&coverURL,
		&totalPages,
		&b.CurrentPage,
		&b.Status,
		&startedAt,
		&finishedAt,
		&googleBooksID,
		&rating,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		return book{}, err
	}

	if author.Valid {
		b.Author = author.String
	}
	if coverURL.Valid {
		b.CoverURL = coverURL.String
	}
	if totalPages.Valid {
		b.TotalPages = int(totalPages.Int64)
	}
	if startedAt.Valid && startedAt.String != "" {
		started := startedAt.String
		b.StartedAt = &started
	}
	if finishedAt.Valid && finishedAt.String != "" {
		finished := finishedAt.String
		b.FinishedAt = &finished
	}
	if googleBooksID.Valid {
		b.GoogleBooksID = googleBooksID.String
	}
	if rating.Valid {
		b.Rating = rating.Float64
	}
	if createdAt.Valid {
		b.CreatedAt = createdAt.String
	}
	if updatedAt.Valid {
		b.UpdatedAt = updatedAt.String
	}

	return b, nil
}

func nullIfEmpty(value string) sql.NullString {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: trimmed, Valid: true}
}
