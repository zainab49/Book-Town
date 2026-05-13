package api

import (
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v2"
)

func (s *server) handleGetStorage(c *fiber.Ctx) error {
	userID := getUserID(c)
	items, err := s.fetchStoredItems(userID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load storage")
	}
	return c.JSON(fiber.Map{"items": items})
}

func (s *server) handlePlaceFromStorage(c *fiber.Ctx) error {
	userID := getUserID(c)
	storageID, err := c.ParamsInt("id")
	if err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid storage item id")
	}

	var req struct {
		PosX float64 `json:"pos_x"`
		PosZ float64 `json:"pos_z"`
	}
	if err := c.BodyParser(&req); err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid JSON body")
	}

	var ownerID int64
	var modelFilename string
	var bookID sql.NullInt64
	if err := s.db.QueryRow(
		`SELECT user_id, model_filename, book_id FROM user_storage WHERE id = ?`, storageID,
	).Scan(&ownerID, &modelFilename, &bookID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return writeError(c, fiber.StatusNotFound, "storage item not found")
		}
		return writeError(c, fiber.StatusInternalServerError, "failed to load storage item")
	}
	if ownerID != userID {
		return writeError(c, fiber.StatusForbidden, "not your item")
	}

	var existingCount int
	if err := s.db.QueryRow(
		`SELECT COUNT(*) FROM town_assets WHERE user_id = ? AND pos_x = ? AND pos_z = ?`,
		userID, req.PosX, req.PosZ,
	).Scan(&existingCount); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to check tile")
	}
	if existingCount > 0 {
		return writeError(c, fiber.StatusConflict, "tile already occupied")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to start transaction")
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO town_assets (user_id, book_id, model_filename, pos_x, pos_z, rotation_y) VALUES (?, ?, ?, ?, ?, 0)`,
		userID, bookID, modelFilename, req.PosX, req.PosZ,
	)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to place asset")
	}
	assetID, _ := result.LastInsertId()

	if _, err := tx.Exec(`DELETE FROM user_storage WHERE id = ?`, storageID); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to remove from storage")
	}

	if err := tx.Commit(); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to commit")
	}

	asset, err := s.fetchTownAssetByID(assetID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load placed asset")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"asset": asset})
}

func (s *server) handleDeleteFromStorage(c *fiber.Ctx) error {
	userID := getUserID(c)
	storageID, err := c.ParamsInt("id")
	if err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid storage item id")
	}

	var ownerID int64
	if err := s.db.QueryRow(`SELECT user_id FROM user_storage WHERE id = ?`, storageID).Scan(&ownerID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return writeError(c, fiber.StatusNotFound, "storage item not found")
		}
		return writeError(c, fiber.StatusInternalServerError, "failed to load storage item")
	}
	if ownerID != userID {
		return writeError(c, fiber.StatusForbidden, "not your item")
	}

	if _, err := s.db.Exec(`DELETE FROM user_storage WHERE id = ?`, storageID); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to delete storage item")
	}

	return c.JSON(fiber.Map{"ok": true})
}
