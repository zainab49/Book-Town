PRAGMA foreign_keys=off;

DROP TRIGGER IF EXISTS books_set_updated_at;
DROP INDEX IF EXISTS idx_books_user_status_updated;

CREATE TABLE books_old (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  total_pages INTEGER,
  current_page INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('to_read','reading','finished')) DEFAULT 'to_read',
  finished_at DATETIME,
  google_books_id TEXT
);

INSERT INTO books_old (
  id,
  user_id,
  title,
  author,
  cover_url,
  total_pages,
  current_page,
  status,
  finished_at,
  google_books_id
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
  google_books_id
FROM books;

DROP TABLE books;
ALTER TABLE books_old RENAME TO books;

PRAGMA foreign_keys=on;
