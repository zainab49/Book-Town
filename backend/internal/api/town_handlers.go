package api

import (
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v2"
)

type buildingDef struct {
	cost          int
	requiredBooks int
}

const starterAssetFilename = "house_003.glb"

var starterPlacementPriority = [][2]float64{
	{-1, -1},
	{-1, 1},
	{1, -1},
	{1, 1},
	{-3, -1},
	{-1, -3},
	{3, 1},
	{1, 3},
}

var modelDefs = map[string]buildingDef{
	// Houses
	"house_001.glb": {cost: 50, requiredBooks: 0},
	"house_002.glb": {cost: 80, requiredBooks: 1},
	"house_003.glb": {cost: 120, requiredBooks: 3},
	// Market
	"stall_001.glb":       {cost: 80, requiredBooks: 1},
	"stall_table_001.glb": {cost: 55, requiredBooks: 1},
	"cart_001.glb":        {cost: 60, requiredBooks: 1},
	"table_001.glb":       {cost: 40, requiredBooks: 0},
	// Nature
	"fir_001.glb":               {cost: 55, requiredBooks: 0},
	"tree_001.glb":               {cost: 45, requiredBooks: 0},
	"fabulous_tree_001.glb":     {cost: 65, requiredBooks: 0},
	"big_fabulous_tree_001.glb": {cost: 75, requiredBooks: 0},
	"cactus_001.glb":            {cost: 35, requiredBooks: 0},
	// Mushrooms
	"fabulous_mushroom_001.glb": {cost: 35, requiredBooks: 0},
	"fabulous_mushroom_002.glb": {cost: 35, requiredBooks: 0},
	"fabulous_mushroom_003.glb": {cost: 35, requiredBooks: 0},
	"fabulous_mushroom_004.glb": {cost: 35, requiredBooks: 0},
	// Structures
	"crane_001.glb":   {cost: 100, requiredBooks: 2},
	"pointer_001.glb": {cost: 25, requiredBooks: 0},
	"holder_001.glb":  {cost: 20, requiredBooks: 0},
	// Containers
	"barrel_001.glb":  {cost: 30, requiredBooks: 0},
	"box_001.glb":     {cost: 20, requiredBooks: 0},
	"box_001_001.glb": {cost: 20, requiredBooks: 0},
	"box_002.glb":     {cost: 20, requiredBooks: 0},
	"box_003.glb":     {cost: 15, requiredBooks: 0},
	"bucket_001.glb":  {cost: 15, requiredBooks: 0},
	// Logs
	"log_001.glb": {cost: 15, requiredBooks: 0},
	"log_002.glb": {cost: 15, requiredBooks: 0},
	"log_003.glb": {cost: 20, requiredBooks: 0},
	"log_004.glb": {cost: 15, requiredBooks: 0},
	// Jugs
	"jug_001.glb": {cost: 15, requiredBooks: 0},
	"jug_002.glb": {cost: 15, requiredBooks: 0},
	"jug_003.glb": {cost: 15, requiredBooks: 0},
	"jug_004.glb": {cost: 15, requiredBooks: 0},
	"jug_005.glb": {cost: 10, requiredBooks: 0},
	// Plates
	"plate_001.glb": {cost: 10, requiredBooks: 0},
	"plate_002.glb": {cost: 12, requiredBooks: 0},
	"plate_003.glb": {cost: 10, requiredBooks: 0},
	// Bags
	"bag_001.glb": {cost: 20, requiredBooks: 0},
	"bag_002.glb": {cost: 25, requiredBooks: 0},
	"bag_003.glb": {cost: 30, requiredBooks: 0},
	"bag_004.glb": {cost: 35, requiredBooks: 0},
}

func getBuildingDef(modelFilename string) (buildingDef, bool) {
	def, ok := modelDefs[modelFilename]
	return def, ok
}

func (s *server) findFirstFreeTownTile(userID int64) (float64, float64, bool, error) {
	for _, slot := range starterPlacementPriority {
		var occupied int
		if err := s.db.QueryRow(
			`SELECT COUNT(*) FROM town_assets WHERE user_id = ? AND pos_x = ? AND pos_z = ?`,
			userID, slot[0], slot[1],
		).Scan(&occupied); err != nil {
			return 0, 0, false, err
		}
		if occupied == 0 {
			return slot[0], slot[1], true, nil
		}
	}

	// Fallback to full grid scan (grid is [-9..9] with step 2).
	for i := 0; i < 10; i++ {
		x := float64(i*2 - 9)
		for j := 0; j < 10; j++ {
			z := float64(j*2 - 9)
			var occupied int
			if err := s.db.QueryRow(
				`SELECT COUNT(*) FROM town_assets WHERE user_id = ? AND pos_x = ? AND pos_z = ?`,
				userID, x, z,
			).Scan(&occupied); err != nil {
				return 0, 0, false, err
			}
			if occupied == 0 {
				return x, z, true, nil
			}
		}
	}
	return 0, 0, false, nil
}

func (s *server) ensureStarterAsset(userID int64) error {
	var starterCount int
	if err := s.db.QueryRow(
		`SELECT COUNT(*) FROM town_assets WHERE user_id = ? AND model_filename = ?`,
		userID, starterAssetFilename,
	).Scan(&starterCount); err != nil {
		return err
	}
	if starterCount > 0 {
		return nil
	}

	x, z, found, err := s.findFirstFreeTownTile(userID)
	if err != nil {
		return err
	}
	if !found {
		return nil
	}

	_, err = s.db.Exec(
		`INSERT INTO town_assets (user_id, book_id, model_filename, pos_x, pos_z, rotation_y) VALUES (?, NULL, ?, ?, ?, 0)`,
		userID, starterAssetFilename, x, z,
	)
	return err
}

func (s *server) handleGetMyTown(c *fiber.Ctx) error {
	userID := getUserID(c)
	if err := s.ensureStarterAsset(userID); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to initialize town")
	}
	assets, err := s.fetchTownAssets(userID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load town")
	}
	var username string
	_ = s.db.QueryRow(`SELECT username FROM users WHERE id = ?`, userID).Scan(&username)
	return c.JSON(fiber.Map{"assets": assets, "username": username})
}

func (s *server) handleGetUserTown(c *fiber.Ctx) error {
	username := c.Params("username")
	if username == "" {
		return writeError(c, fiber.StatusBadRequest, "username required")
	}
	var userID int64
	err := s.db.QueryRow(`SELECT id FROM users WHERE username = ?`, username).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		return writeError(c, fiber.StatusNotFound, "user not found")
	}
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to find user")
	}
	if err := s.ensureStarterAsset(userID); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to initialize town")
	}
	assets, err := s.fetchTownAssets(userID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load town")
	}
	return c.JSON(fiber.Map{"assets": assets, "username": username})
}

func (s *server) handlePlaceBuilding(c *fiber.Ctx) error {
	userID := getUserID(c)

	var req struct {
		ModelFilename string  `json:"model_filename"`
		PosX          float64 `json:"pos_x"`
		PosZ          float64 `json:"pos_z"`
		BookID        *int64  `json:"book_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid JSON body")
	}

	def, ok := getBuildingDef(req.ModelFilename)
	if !ok {
		return writeError(c, fiber.StatusBadRequest, "unknown building type")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to start transaction")
	}
	defer tx.Rollback()

	var points int
	if err := tx.QueryRow(`SELECT points FROM users WHERE id = ?`, userID).Scan(&points); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load user")
	}
	if points < def.cost {
		return writeError(c, fiber.StatusPaymentRequired, "insufficient points")
	}

	if def.requiredBooks > 0 {
		var finishedCount int
		if err := tx.QueryRow(
			`SELECT COUNT(*) FROM books WHERE user_id = ? AND status = 'finished'`, userID,
		).Scan(&finishedCount); err != nil {
			return writeError(c, fiber.StatusInternalServerError, "failed to check books")
		}
		if finishedCount < def.requiredBooks {
			return writeError(c, fiber.StatusForbidden, "not enough finished books")
		}
	}

	var existingCount int
	if err := tx.QueryRow(
		`SELECT COUNT(*) FROM town_assets WHERE user_id = ? AND pos_x = ? AND pos_z = ?`,
		userID, req.PosX, req.PosZ,
	).Scan(&existingCount); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to check tile")
	}
	if existingCount > 0 {
		return writeError(c, fiber.StatusConflict, "tile already occupied")
	}

	if _, err := tx.Exec(
		`UPDATE users SET points = points - ? WHERE id = ?`, def.cost, userID,
	); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to deduct points")
	}

	var bookID sql.NullInt64
	if req.BookID != nil && *req.BookID > 0 {
		bookID = sql.NullInt64{Int64: *req.BookID, Valid: true}
	}

	result, err := tx.Exec(
		`INSERT INTO town_assets (user_id, book_id, model_filename, pos_x, pos_z, rotation_y) VALUES (?, ?, ?, ?, ?, 0)`,
		userID, bookID, req.ModelFilename, req.PosX, req.PosZ,
	)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to place building")
	}
	assetID, _ := result.LastInsertId()

	var newPoints int
	if err := tx.QueryRow(`SELECT points FROM users WHERE id = ?`, userID).Scan(&newPoints); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load new points")
	}

	if err := tx.Commit(); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to commit")
	}

	asset, err := s.fetchTownAssetByID(assetID)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to load placed asset")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"asset":              asset,
		"new_points_balance": newPoints,
	})
}

func (s *server) handleMoveAsset(c *fiber.Ctx) error {
	userID := getUserID(c)
	assetID, err := c.ParamsInt("id")
	if err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid asset id")
	}

	var req struct {
		PosX      float64 `json:"pos_x"`
		PosZ      float64 `json:"pos_z"`
		RotationY float64 `json:"rotation_y"`
	}
	if err := c.BodyParser(&req); err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid JSON body")
	}

	// Verify ownership
	var ownerID int64
	if err := s.db.QueryRow(`SELECT user_id FROM town_assets WHERE id = ?`, assetID).Scan(&ownerID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return writeError(c, fiber.StatusNotFound, "asset not found")
		}
		return writeError(c, fiber.StatusInternalServerError, "failed to load asset")
	}
	if ownerID != userID {
		return writeError(c, fiber.StatusForbidden, "not your asset")
	}

	// Check destination tile is free (excluding the asset itself)
	var existingCount int
	if err := s.db.QueryRow(
		`SELECT COUNT(*) FROM town_assets WHERE user_id = ? AND pos_x = ? AND pos_z = ? AND id != ?`,
		userID, req.PosX, req.PosZ, assetID,
	).Scan(&existingCount); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to check tile")
	}
	if existingCount > 0 {
		return writeError(c, fiber.StatusConflict, "tile already occupied")
	}

	if _, err := s.db.Exec(
		`UPDATE town_assets SET pos_x = ?, pos_z = ?, rotation_y = ? WHERE id = ?`,
		req.PosX, req.PosZ, req.RotationY, assetID,
	); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to move asset")
	}

	asset, err := s.fetchTownAssetByID(int64(assetID))
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to reload asset")
	}
	return c.JSON(fiber.Map{"asset": asset})
}

func (s *server) handleDeleteAsset(c *fiber.Ctx) error {
	userID := getUserID(c)
	assetID, err := c.ParamsInt("id")
	if err != nil {
		return writeError(c, fiber.StatusBadRequest, "invalid asset id")
	}

	var ownerID int64
	var modelFilename string
	var bookID sql.NullInt64
	if err := s.db.QueryRow(
		`SELECT user_id, model_filename, book_id FROM town_assets WHERE id = ?`, assetID,
	).Scan(&ownerID, &modelFilename, &bookID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return writeError(c, fiber.StatusNotFound, "asset not found")
		}
		return writeError(c, fiber.StatusInternalServerError, "failed to load asset")
	}
	if ownerID != userID {
		return writeError(c, fiber.StatusForbidden, "not your asset")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to start transaction")
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO user_storage (user_id, model_filename, book_id) VALUES (?, ?, ?)`,
		userID, modelFilename, bookID,
	)
	if err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to save item to storage")
	}
	storageID, _ := result.LastInsertId()

	if _, err := tx.Exec(`DELETE FROM town_assets WHERE id = ?`, assetID); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to remove asset from town")
	}

	if err := tx.Commit(); err != nil {
		return writeError(c, fiber.StatusInternalServerError, "failed to commit")
	}

	var item storedItem
	var sBookID sql.NullInt64
	var sStoredAt sql.NullString
	_ = s.db.QueryRow(
		`SELECT id, user_id, model_filename, book_id, stored_at FROM user_storage WHERE id = ?`, storageID,
	).Scan(&item.ID, &item.UserID, &item.ModelFilename, &sBookID, &sStoredAt)
	if sBookID.Valid {
		item.BookID = &sBookID.Int64
	}
	if sStoredAt.Valid {
		item.StoredAt = sStoredAt.String
	}

	return c.JSON(fiber.Map{"ok": true, "stored_item": item})
}
