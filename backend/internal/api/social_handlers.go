package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func (s *server) handleGetMe(c *fiber.Ctx) error {
	userID := getUserID(c)
	var username, email string
	var points int
	err := s.db.QueryRow(
		`SELECT username, email, points FROM users WHERE id = ?`, userID,
	).Scan(&username, &email, &points)
	if errors.Is(err, sql.ErrNoRows) {
		return writeError(c, fiber.StatusNotFound, "user not found")
	}
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load user")
	}
	return c.JSON(fiber.Map{
		"id":       userID,
		"username": username,
		"email":    email,
		"points":   points,
	})
}

func (s *server) handleSearchUsers(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return c.JSON(fiber.Map{"users": []interface{}{}})
	}

	userID := getUserID(c)
	rows, err := s.db.Query(`
		SELECT u.username,
		       CASE WHEN f.following_id IS NOT NULL THEN 1 ELSE 0 END AS is_following
		FROM users u
		LEFT JOIN follows f ON f.follower_id = ? AND f.following_id = u.id
		WHERE u.username LIKE ? AND u.id != ?
		LIMIT 20
	`, userID, "%"+q+"%", userID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to search users")
	}
	defer rows.Close()

	users := make([]searchedUser, 0)
	for rows.Next() {
		var u searchedUser
		var isFollowing int
		if err := rows.Scan(&u.Username, &isFollowing); err != nil {
			return writeError(c, fiber.StatusInternalServerError, "failed to read users")
		}
		u.IsFollowing = isFollowing == 1
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to read users")
	}
	return c.JSON(fiber.Map{"users": users})
}

func (s *server) handleGetUserProfile(c *fiber.Ctx) error {
	username := strings.TrimSpace(c.Params("username"))
	if username == "" {
		return writeError(c, fiber.StatusBadRequest, "username is required")
	}

	callerID := getUserID(c)

	var targetID int64
	var targetUsername string
	var points int
	queryErr := s.db.QueryRow(
		`SELECT id, username, points FROM users WHERE username = ?`, username,
	).Scan(&targetID, &targetUsername, &points)
	if errors.Is(queryErr, sql.ErrNoRows) {
		return writeError(c, fiber.StatusNotFound, "user not found")
	}
	if queryErr != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load user")
	}

	var started, finished, townAssetCount, followingCount, followerCount int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM books WHERE user_id = ? AND status IN ('reading','finished')`, targetID).Scan(&started)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM books WHERE user_id = ? AND status = 'finished'`, targetID).Scan(&finished)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM town_assets WHERE user_id = ?`, targetID).Scan(&townAssetCount)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM follows WHERE follower_id = ?`, targetID).Scan(&followingCount)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM follows WHERE following_id = ?`, targetID).Scan(&followerCount)

	isFollowing := false
	if callerID > 0 && callerID != targetID {
		var cnt int
		_ = s.db.QueryRow(
			`SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = ?`, callerID, targetID,
		).Scan(&cnt)
		isFollowing = cnt > 0
	}

	type finishedBook struct {
		Title      string  `json:"title"`
		Author     string  `json:"author"`
		CoverURL   string  `json:"cover_url"`
		FinishedAt *string `json:"finished_at"`
	}

	rows, err := s.db.Query(`
		SELECT title, author, cover_url, finished_at
		FROM books
		WHERE user_id = ? AND status = 'finished'
		ORDER BY datetime(finished_at) DESC
	`, targetID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load books")
	}
	defer rows.Close()

	finishedBooks := make([]finishedBook, 0)
	for rows.Next() {
		var fb finishedBook
		var author, coverURL, finAt sql.NullString
		if err := rows.Scan(&fb.Title, &author, &coverURL, &finAt); err != nil {
			return writeError(c, fiber.StatusInternalServerError, "failed to read books")
		}
		if author.Valid {
			fb.Author = author.String
		}
		if coverURL.Valid {
			fb.CoverURL = coverURL.String
		}
		if finAt.Valid && finAt.String != "" {
			v := finAt.String
			fb.FinishedAt = &v
		}
		finishedBooks = append(finishedBooks, fb)
	}

	followingRows, err := s.db.Query(`
		SELECT u.username
		FROM follows f
		JOIN users u ON u.id = f.following_id
		WHERE f.follower_id = ?
	`, targetID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load following")
	}
	defer followingRows.Close()

	following := make([]string, 0)
	for followingRows.Next() {
		var u string
		if err := followingRows.Scan(&u); err != nil {
			return writeError(c, fiber.StatusInternalServerError, "failed to read following")
		}
		following = append(following, u)
	}

	ratio := 0.0
	if started > 0 {
		ratio = float64(finished) / float64(started)
	}

	return c.JSON(fiber.Map{
		"username":         targetUsername,
		"started":          started,
		"finished":         finished,
		"points":           points,
		"ratio":            ratio,
		"following_count":  followingCount,
		"follower_count":   followerCount,
		"town_asset_count": townAssetCount,
		"is_following":     isFollowing,
		"finished_books":   finishedBooks,
		"following":        following,
	})
}

func (s *server) handleFollow(c *fiber.Ctx) error {
	username := strings.TrimSpace(c.Params("username"))
	if username == "" {
		return writeError(c, fiber.StatusBadRequest, "username is required")
	}

	followerID := getUserID(c)

	var followingID int64
	queryErr := s.db.QueryRow(`SELECT id FROM users WHERE username = ?`, username).Scan(&followingID)
	if errors.Is(queryErr, sql.ErrNoRows) {
		return writeError(c, fiber.StatusNotFound, "user not found")
	}
	if queryErr != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load user")
	}
	if followingID == followerID {
		return writeError(c, fiber.StatusBadRequest, "cannot follow yourself")
	}

	result, err := s.db.Exec(
		`INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)`, followerID, followingID,
	)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to follow user")
	}

	// Only notify when a new follow row was actually inserted.
	if n, _ := result.RowsAffected(); n == 1 {
		var followerUsername string
		_ = s.db.QueryRow(`SELECT username FROM users WHERE id = ?`, followerID).Scan(&followerUsername)

		// follow_back: the target (followingID) already follows the actor (followerID),
		// so from their perspective this person is "following you back".
		notifType := "follow"
		var mutualCount int
		_ = s.db.QueryRow(
			`SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = ?`,
			followingID, followerID,
		).Scan(&mutualCount)
		if mutualCount > 0 {
			notifType = "follow_back"
		}

		var notifID int64
		var createdAt string
		nr, err2 := s.db.Exec(
			`INSERT INTO notifications (user_id, type, actor_username) VALUES (?, ?, ?)`,
			followingID, notifType, followerUsername,
		)
		if err2 == nil {
			notifID, _ = nr.LastInsertId()
			_ = s.db.QueryRow(
				`SELECT created_at FROM notifications WHERE id = ?`, notifID,
			).Scan(&createdAt)

			msg := notificationMsg{
				ID:            notifID,
				Type:          notifType,
				ActorUsername: followerUsername,
				CreatedAt:     createdAt,
			}
			if data, err3 := json.Marshal(msg); err3 == nil {
				s.hub.push(followingID, data)
			}
		}
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"followed": username})
}

func (s *server) handleUnfollow(c *fiber.Ctx) error {
	username := strings.TrimSpace(c.Params("username"))
	if username == "" {
		return writeError(c, fiber.StatusBadRequest, "username is required")
	}

	followerID := getUserID(c)

	var followingID int64
	queryErr := s.db.QueryRow(`SELECT id FROM users WHERE username = ?`, username).Scan(&followingID)
	if errors.Is(queryErr, sql.ErrNoRows) {
		return writeError(c, fiber.StatusNotFound, "user not found")
	}
	if queryErr != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load user")
	}

	if _, err := s.db.Exec(
		`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`, followerID, followingID,
	); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to unfollow user")
	}
	return c.JSON(fiber.Map{"unfollowed": username})
}

// GET /api/users/me/followers — returns usernames that follow the current user
func (s *server) handleGetMyFollowers(c *fiber.Ctx) error {
	userID := getUserID(c)
	rows, err := s.db.Query(`
		SELECT u.username
		FROM follows f
		JOIN users u ON u.id = f.follower_id
		WHERE f.following_id = ?
		ORDER BY u.username ASC
	`, userID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load followers")
	}
	defer rows.Close()

	followers := make([]string, 0)
	for rows.Next() {
		var username string
		if err := rows.Scan(&username); err != nil {
			continue
		}
		followers = append(followers, username)
	}
	return c.JSON(fiber.Map{"followers": followers})
}

func (s *server) handleGetFeed(c *fiber.Ctx) error {
	userID := getUserID(c)

	rows, err := s.db.Query(`
		SELECT u.username, b.title, b.author, b.cover_url, b.finished_at
		FROM books b
		JOIN users u ON u.id = b.user_id
		JOIN follows f ON f.following_id = b.user_id AND f.follower_id = ?
		WHERE b.status = 'finished' AND b.finished_at IS NOT NULL
		ORDER BY datetime(b.finished_at) DESC
		LIMIT 20
	`, userID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load feed")
	}
	defer rows.Close()

	items := make([]feedItem, 0)
	for rows.Next() {
		var item feedItem
		var author, coverURL sql.NullString
		if err := rows.Scan(&item.Username, &item.BookTitle, &author, &coverURL, &item.FinishedAt); err != nil {
			return writeError(c, fiber.StatusInternalServerError, "failed to read feed")
		}
		if author.Valid {
			item.BookAuthor = author.String
		}
		if coverURL.Valid {
			item.CoverURL = coverURL.String
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to read feed")
	}

	return c.JSON(fiber.Map{"feed": items})
}
