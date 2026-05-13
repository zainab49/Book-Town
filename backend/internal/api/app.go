package api

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	fiberws "github.com/gofiber/websocket/v2"
)

func NewApp(db *sql.DB, jwtSecret []byte, googleBooksAPIKey string) *fiber.App {
	s := &server{
		db:                db,
		jwtSecret:         jwtSecret,
		googleBooksAPIKey: googleBooksAPIKey,
		hub:               newNotifHub(),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	app := fiber.New()
	app.Use(compress.New(compress.Config{Level: compress.LevelBestSpeed}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-User-ID",
		AllowMethods: "GET,POST,PATCH,DELETE,OPTIONS",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})

	app.Use("/api", s.JWTMiddleware)

	authRoutes := app.Group("/api/auth")
	authRoutes.Post("/register", s.handleRegister)
	authRoutes.Post("/login", s.handleLogin)

	api := app.Group("/api")
	api.Get("/books", s.handleGetBooks)
	api.Post("/books", s.handleCreateBook)
	api.Delete("/books/:id", s.handleDeleteBook)
	api.Patch("/books/:id/status", s.handlePatchBookStatus)
	api.Patch("/books/:id/progress", s.handlePatchBookProgress)
	api.Get("/books/search", s.handleSearchBooks)
	api.Get("/users/me/stats", s.handleGetMyStats)
	api.Get("/users/me/followers", s.handleGetMyFollowers)
	api.Get("/users/me", s.handleGetMe)
	api.Get("/users/search", s.handleSearchUsers)
	api.Get("/users/:username", s.handleGetUserProfile)
	api.Post("/follow/:username", s.handleFollow)
	api.Delete("/unfollow/:username", s.handleUnfollow)
	api.Get("/feed", s.handleGetFeed)

	api.Get("/notifications", s.handleGetNotifications)
	api.Get("/notifications/ws", fiberws.New(s.handleNotificationWS))
	api.Patch("/notifications/read", s.handleMarkNotificationsRead)
	api.Delete("/notifications/:id", s.handleDeleteNotification)

	api.Get("/town", s.handleGetMyTown)
	api.Post("/town/place", s.handlePlaceBuilding)
	api.Patch("/town/assets/:id", s.handleMoveAsset)
	api.Delete("/town/assets/:id", s.handleDeleteAsset)
	api.Get("/town/:username", s.handleGetUserTown)

	api.Get("/storage", s.handleGetStorage)
	api.Post("/storage/:id/place", s.handlePlaceFromStorage)
	api.Delete("/storage/:id", s.handleDeleteFromStorage)

	return app
}
