CREATE TABLE books (
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
