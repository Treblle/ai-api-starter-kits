// internal/config/config.go
package config

import (
	"log"
	"os"
)

type Config struct {
	HTTPAddr      string
	DSN           string
	JWTSecret     []byte
	OpenAIToken   string
	TreblleToken  string
	TreblleAPIKey string
}

func Load() Config {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("FATAL: JWT_SECRET environment variable is required")
	}

	openAIToken := os.Getenv("OPENAI_TOKEN")
	if openAIToken == "" {
		log.Fatal("FATAL: OPENAI_TOKEN environment variable is required")
	}

	treblleToken := os.Getenv("TREBLLE_SDK_TOKEN")
	if treblleToken == "" {
		log.Fatal("FATAL: TREBLLE_SDK_TOKEN environment variable is required")
	}

	treblleAPIKey := os.Getenv("TREBLLE_API_KEY")
	if treblleAPIKey == "" {
		log.Fatal("FATAL: TREBLLE_API_KEY environment variable is required")
	}

	return Config{
		HTTPAddr:      envDefault("HTTP_ADDR", ":8080"),
		DSN:           envDefault("DATABASE_DSN", "postgres:///linkedinify?sslmode=disable"),
		JWTSecret:     []byte(jwtSecret),
		OpenAIToken:   openAIToken,
		TreblleToken:  treblleToken,
		TreblleAPIKey: treblleAPIKey,
	}
}

func envDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func (c Config) GetJWTSecret() []byte {
	return c.JWTSecret
}
