// cmd/api/main.go
package main

import (
	"log"
	"net/http"

	"github.com/joho/godotenv"
	"github.com/you/linkedinify/internal/config"
	"github.com/you/linkedinify/internal/router"
)

func main() {
	// Load environment variables
	// Try to find the .env file using a generic approach
	envPaths := []string{
		".env",       // Current directory
		"../../.env", // Two directories up (from cmd/api to project root)
	}

	// Try loading from each path until successful
	var loaded bool
	for _, path := range envPaths {
		if err := godotenv.Load(path); err == nil {
			log.Printf("✓ Successfully loaded .env file from %s", path)
			loaded = true
			break
		}
	}

	if !loaded {
		log.Println("⚠ Warning: Could not load .env file - using default configuration")
	}
	cfg := config.Load()

	// Create the router, which now includes all middleware
	appRouter := router.New(cfg)

	server := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: appRouter, // Use the router from the router package directly
	}

	log.Printf("⇢ Server starting on %s", cfg.HTTPAddr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed to start: %v", err)
	}
}
