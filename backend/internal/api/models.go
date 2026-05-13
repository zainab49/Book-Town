package api

import (
	"database/sql"
	"net/http"
)

type server struct {
	db                *sql.DB
	jwtSecret         []byte
	httpClient        *http.Client
	googleBooksAPIKey string
	hub               *notifHub
}

type notificationMsg struct {
	ID            int64  `json:"id"`
	Type          string `json:"type"`
	ActorUsername string `json:"actor_username"`
	Read          bool   `json:"read"`
	CreatedAt     string `json:"created_at"`
}

type book struct {
	ID            int64   `json:"id"`
	UserID        int64   `json:"user_id"`
	Title         string  `json:"title"`
	Author        string  `json:"author"`
	CoverURL      string  `json:"cover_url"`
	Rating        float64 `json:"rating"`
	TotalPages    int     `json:"total_pages"`
	CurrentPage   int     `json:"current_page"`
	Status        string  `json:"status"`
	StartedAt     *string `json:"started_at"`
	FinishedAt    *string `json:"finished_at"`
	GoogleBooksID string  `json:"google_books_id"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

type townAsset struct {
	ID            int64   `json:"id"`
	UserID        int64   `json:"user_id"`
	BookID        *int64  `json:"book_id"`
	ModelFilename string  `json:"model_filename"`
	PosX          float64 `json:"pos_x"`
	PosZ          float64 `json:"pos_z"`
	RotationY     float64 `json:"rotation_y"`
	PlacedAt      string  `json:"placed_at"`
	BookTitle     string  `json:"book_title"`
	BookAuthor    string  `json:"book_author"`
}

type storedItem struct {
	ID            int64  `json:"id"`
	UserID        int64  `json:"user_id"`
	ModelFilename string `json:"model_filename"`
	BookID        *int64 `json:"book_id"`
	StoredAt      string `json:"stored_at"`
}

type searchedUser struct {
	Username    string `json:"username"`
	IsFollowing bool   `json:"is_following"`
}

type feedItem struct {
	Username   string `json:"username"`
	BookTitle  string `json:"book_title"`
	BookAuthor string `json:"book_author"`
	CoverURL   string `json:"cover_url"`
	FinishedAt string `json:"finished_at"`
}

type googleBooksResponse struct {
	Items []struct {
		ID         string `json:"id"`
		VolumeInfo struct {
			Title         string   `json:"title"`
			Authors       []string `json:"authors"`
			PageCount     int      `json:"pageCount"`
			AverageRating *float64 `json:"averageRating"`
			ImageLinks    struct {
				Thumbnail string `json:"thumbnail"`
			} `json:"imageLinks"`
		} `json:"volumeInfo"`
	} `json:"items"`
}
