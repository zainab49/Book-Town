package api

import (
	"database/sql"
	"errors"
	"fmt"
	"net/mail"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func (s *server) JWTMiddleware(c *fiber.Ctx) error {
	path := c.Path()
	if path == "/api/auth" || strings.HasPrefix(path, "/api/auth/") {
		return c.Next()
	}
	// Public: visiting another user's town (GET /api/town/:username)
	if c.Method() == fiber.MethodGet && strings.HasPrefix(path, "/api/town/") {
		return c.Next()
	}

	// EventSource cannot set headers, so the SSE endpoint also accepts ?token=
	var tokenString string
	authHeader := strings.TrimSpace(c.Get("Authorization"))
	const bearerPrefix = "Bearer "
	if strings.HasPrefix(authHeader, bearerPrefix) {
		tokenString = strings.TrimSpace(strings.TrimPrefix(authHeader, bearerPrefix))
	} else {
		tokenString = strings.TrimSpace(c.Query("token"))
	}
	if tokenString == "" {
		return writeError(c, fiber.StatusUnauthorized, "missing auth token")
	}

	claims := &jwt.RegisteredClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}
		return s.jwtSecret, nil
	})
	if err != nil || token == nil || !token.Valid {
		return writeError(c, fiber.StatusUnauthorized, "invalid auth token")
	}

	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil || userID <= 0 {
		return writeError(c, fiber.StatusUnauthorized, "invalid token subject")
	}

	c.Locals("user_id", userID)
	c.Locals("userID", userID)
	return c.Next()
}

func getUserID(c *fiber.Ctx) int64 {
	if value := c.Locals("user_id"); value != nil {
		if userID, ok := value.(int64); ok {
			return userID
		}
	}

	value := c.Locals("userID")
	if userID, ok := value.(int64); ok {
		return userID
	}
	return 0
}

func normalizeEmail(raw string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed == "" {
		return "", errors.New("empty email")
	}

	addr, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", err
	}

	if !strings.Contains(addr.Address, "@") {
		return "", errors.New("invalid email")
	}

	return addr.Address, nil
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, sql.ErrNoRows) {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "unique constraint failed")
}
