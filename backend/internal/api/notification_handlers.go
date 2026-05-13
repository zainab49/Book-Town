package api

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	fiberws "github.com/gofiber/websocket/v2"
)

// GET /api/notifications/ws — WebSocket
func (s *server) handleNotificationWS(c *fiberws.Conn) {
	userID, _ := c.Locals("user_id").(int64)
	if userID == 0 {
		userID, _ = c.Locals("userID").(int64)
	}
	if userID == 0 {
		return
	}

	ch := s.hub.subscribe(userID)
	defer s.hub.unsubscribe(userID, ch)

	// Flush any unread notifications on connect.
	rows, err := s.db.Query(`
		SELECT id, type, actor_username, created_at
		FROM notifications
		WHERE user_id = ? AND read = 0
		ORDER BY created_at ASC
	`, userID)
	if err == nil {
		for rows.Next() {
			var n notificationMsg
			if err := rows.Scan(&n.ID, &n.Type, &n.ActorUsername, &n.CreatedAt); err == nil {
				data, _ := json.Marshal(n)
				if err := c.WriteMessage(fiberws.TextMessage, data); err != nil {
					rows.Close()
					return
				}
			}
		}
		rows.Close()
	}

	// Forward hub messages to the WebSocket client.
	for msg := range ch {
		if err := c.WriteMessage(fiberws.TextMessage, msg); err != nil {
			return
		}
	}
}

// GET /api/notifications
func (s *server) handleGetNotifications(c *fiber.Ctx) error {
	userID := getUserID(c)
	rows, err := s.db.Query(`
		SELECT id, type, actor_username, read, created_at
		FROM notifications
		WHERE user_id = ?
		ORDER BY created_at DESC
		LIMIT 30
	`, userID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load notifications")
	}
	defer rows.Close()

	items := make([]notificationMsg, 0)
	for rows.Next() {
		var n notificationMsg
		var readInt int
		if err := rows.Scan(&n.ID, &n.Type, &n.ActorUsername, &readInt, &n.CreatedAt); err != nil {
			continue
		}
		n.Read = readInt == 1
		items = append(items, n)
	}
	return c.JSON(fiber.Map{"notifications": items})
}

// PATCH /api/notifications/read
func (s *server) handleMarkNotificationsRead(c *fiber.Ctx) error {
	userID := getUserID(c)
	if _, err := s.db.Exec(
		`UPDATE notifications SET read = 1 WHERE user_id = ?`, userID,
	); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to mark notifications")
	}
	return c.JSON(fiber.Map{"ok": true})
}

// DELETE /api/notifications/:id
func (s *server) handleDeleteNotification(c *fiber.Ctx) error {
	userID := getUserID(c)
	id, err := c.ParamsInt("id")
	if err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid notification id")
	}
	result, dbErr := s.db.Exec(
		`DELETE FROM notifications WHERE id = ? AND user_id = ?`, id, userID,
	)
	if dbErr != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to delete notification")
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return writeError(c, fiber.StatusNotFound, "notification not found")
	}
	return c.JSON(fiber.Map{"ok": true})
}
