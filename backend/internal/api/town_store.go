package api

import (
	"database/sql"
)

func (s *server) fetchTownAssets(userID int64) ([]townAsset, error) {
	rows, err := s.db.Query(`
		SELECT
			ta.id, ta.user_id, ta.book_id, ta.model_filename, ta.pos_x, ta.pos_z, ta.rotation_y, ta.placed_at,
			COALESCE(b.title, '') AS book_title,
			COALESCE(b.author, '') AS book_author
		FROM town_assets ta
		LEFT JOIN books b ON ta.book_id = b.id
		WHERE ta.user_id = ?
		ORDER BY ta.placed_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]townAsset, 0)
	for rows.Next() {
		a, err := scanTownAsset(rows)
		if err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, rows.Err()
}

func (s *server) fetchTownAssetByID(assetID int64) (townAsset, error) {
	row := s.db.QueryRow(`
		SELECT
			ta.id, ta.user_id, ta.book_id, ta.model_filename, ta.pos_x, ta.pos_z, ta.rotation_y, ta.placed_at,
			COALESCE(b.title, '') AS book_title,
			COALESCE(b.author, '') AS book_author
		FROM town_assets ta
		LEFT JOIN books b ON ta.book_id = b.id
		WHERE ta.id = ?
	`, assetID)
	return scanTownAsset(row)
}

func scanTownAsset(scanner interface {
	Scan(dest ...any) error
}) (townAsset, error) {
	var a townAsset
	var bookID sql.NullInt64
	var placedAt sql.NullString

	err := scanner.Scan(
		&a.ID,
		&a.UserID,
		&bookID,
		&a.ModelFilename,
		&a.PosX,
		&a.PosZ,
		&a.RotationY,
		&placedAt,
		&a.BookTitle,
		&a.BookAuthor,
	)
	if err != nil {
		return townAsset{}, err
	}

	if bookID.Valid {
		a.BookID = &bookID.Int64
	}
	if placedAt.Valid {
		a.PlacedAt = placedAt.String
	}
	return a, nil
}
