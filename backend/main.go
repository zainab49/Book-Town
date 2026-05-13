package main

import (
	"booktown/internal/api"
	"errors"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"
)

func main() {
	_ = godotenv.Load()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "sqlite3://booktown.db"
	}

	migrationsPath := os.Getenv("MIGRATIONS_PATH")
	if migrationsPath == "" {
		migrationsPath = "file://migrations"
	}

	// Apply any pending migrations before opening the DB connection for the app.
	m, err := migrate.New(migrationsPath, databaseURL)
	if err != nil {
		log.Fatalf("failed to initialize migrations: %v", err)
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatalf("failed to run migrations: %v", err)
	}
	srcErr, dbErr := m.Close()
	if srcErr != nil {
		log.Printf("migrate source close: %v", srcErr)
	}
	if dbErr != nil {
		log.Printf("migrate db close: %v", dbErr)
	}
	log.Println("migrations up to date")

	db, err := api.OpenDatabase(databaseURL)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is required (set it in backend/.env)")
	}

	app := api.NewApp(db, []byte(jwtSecret), os.Getenv("GOOGLE_BOOKS_API_KEY"))
	log.Println("listening on :8080")
	log.Fatal(app.Listen(":8080"))
}
