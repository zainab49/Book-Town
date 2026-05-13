package api

import (
	"booktown/internal/auth"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func (s *server) handleRegister(c *fiber.Ctx) error {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid JSON body")
	}

	username := strings.TrimSpace(req.Username)
	email, err := normalizeEmail(req.Email)
	if err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid email format")
	}
	if username == "" {
		return writeError(c, fiber.StatusBadRequest, "username is required")
	}
	if len(req.Password) < 8 {
		return writeError(c, fiber.StatusBadRequest, "password must be at least 8 characters")
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to process password")
	}

	result, err := s.db.Exec(`
		INSERT INTO users (username, email, password_hash)
		VALUES (?, ?, ?)
	`, username, email, passwordHash)
	if err != nil {
		if isUniqueConstraintError(err) {
			return writeError(c, fiber.StatusConflict, "username or email already in use")
		}
		return writeError(c, fiber.StatusInternalServerError, "failed to create user")
	}

	userID, err := result.LastInsertId()
	if err != nil || userID <= 0 {
		return writeError(c, fiber.StatusInternalServerError, "failed to create user")
	}

	token, err := auth.GenerateToken(userID, string(s.jwtSecret), 24*time.Hour)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to create auth token")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"token": token,
		"user": fiber.Map{
			"id":       userID,
			"username": username,
			"email":    email,
		},
	})
}

func (s *server) handleLogin(c *fiber.Ctx) error {
	var req struct {
		Identifier string `json:"identifier"` // email or username
		Password   string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid JSON body")
	}

	identifier := strings.TrimSpace(req.Identifier)
	if identifier == "" {
		return writeError(c, fiber.StatusBadRequest, "email or username is required")
	}
	if strings.TrimSpace(req.Password) == "" {
		return writeError(c, fiber.StatusBadRequest, "password is required")
	}

	var userID int64
	var username, email, passwordHash string
	var queryErr error

	if strings.Contains(identifier, "@") {
		// Looks like an email — normalise and query by email.
		normalised, err := normalizeEmail(identifier)
		if err != nil {
			return writeError(c, fiber.StatusUnauthorized, "invalid credentials")
		}
		queryErr = s.db.QueryRow(`
			SELECT id, username, email, password_hash
			FROM users WHERE email = ?
		`, normalised).Scan(&userID, &username, &email, &passwordHash)
	} else {
		// Treat as username.
		queryErr = s.db.QueryRow(`
			SELECT id, username, email, password_hash
			FROM users WHERE username = ?
		`, identifier).Scan(&userID, &username, &email, &passwordHash)
	}

	if errors.Is(queryErr, sql.ErrNoRows) {
		return writeError(c, fiber.StatusUnauthorized, "invalid credentials")
	}
	if queryErr != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load user")
	}

	if err := auth.ComparePassword(passwordHash, req.Password); err != nil {
		return writeError(c, fiber.StatusUnauthorized, "invalid credentials")
	}

	token, err := auth.GenerateToken(userID, string(s.jwtSecret), 24*time.Hour)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to create auth token")
	}

	return c.JSON(fiber.Map{
		"token": token,
		"user": fiber.Map{
			"id":       userID,
			"username": username,
			"email":    email,
		},
	})
}
