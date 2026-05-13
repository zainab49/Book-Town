PRAGMA foreign_keys=off;

CREATE TABLE books_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  total_pages INTEGER,
  current_page INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('to_read','reading','finished')) DEFAULT 'to_read',
  finished_at DATETIME,
  google_books_id TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO books_new (
  id,
  user_id,
  title,
  author,
  cover_url,
  total_pages,
  current_page,
  status,
  finished_at,
  google_books_id,
  created_at,
  updated_at
)
SELECT
  id,
  user_id,
  title,
  author,
  cover_url,
  total_pages,
  current_page,
  status,
  finished_at,
  google_books_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM books;

DROP TABLE books;
ALTER TABLE books_new RENAME TO books;

CREATE INDEX idx_books_user_status_updated ON books(user_id, status, updated_at DESC);

CREATE TRIGGER books_set_updated_at
AFTER UPDATE ON books
FOR EACH ROW
BEGIN
  UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

PRAGMA foreign_keys=on;
