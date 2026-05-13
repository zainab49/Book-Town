package api

import "database/sql"

func (s *server) fetchStoredItems(userID int64) ([]storedItem, error) {
	rows, err := s.db.Query(`
		SELECT id, user_id, model_filename, book_id, stored_at
		FROM user_storage
		WHERE user_id = ?
		ORDER BY stored_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]storedItem, 0)
	for rows.Next() {
		var item storedItem
		var bookID sql.NullInt64
		var storedAt sql.NullString
		if err := rows.Scan(&item.ID, &item.UserID, &item.ModelFilename, &bookID, &storedAt); err != nil {
			return nil, err
		}
		if bookID.Valid {
			item.BookID = &bookID.Int64
		}
		if storedAt.Valid {
			item.StoredAt = storedAt.String
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
