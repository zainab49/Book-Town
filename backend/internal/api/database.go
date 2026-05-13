package api

import (
	"database/sql"
	"strings"
)

func OpenDatabase(rawURL string) (*sql.DB, error) {
	if rawURL == "" {
		rawURL = "sqlite3://booktown.db"
	}

	dsn := rawURL
	if strings.HasPrefix(rawURL, "sqlite3://") {
		dsn = strings.TrimPrefix(rawURL, "sqlite3://")
	}
	if dsn == "" {
		dsn = "booktown.db"
	}

	if !strings.Contains(dsn, "?") {
		dsn += "?_foreign_keys=on&_busy_timeout=5000&_journal_mode=WAL&_synchronous=NORMAL&_cache_size=-32000"
	} else {
		dsn += "&_foreign_keys=on&_busy_timeout=5000&_journal_mode=WAL&_synchronous=NORMAL&_cache_size=-32000"
	}

	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)

	return db, nil
}
