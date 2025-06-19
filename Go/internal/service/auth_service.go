// internal/service/auth_service.go
package service

import (
	"context"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/you/linkedinify/internal/model"
	"github.com/you/linkedinify/internal/repository"
)

// AuthConfigProvider provides the JWT secret for AuthService.
type AuthConfigProvider interface {
	GetJWTSecret() []byte
}

// AuthServiceInteractor defines the operations for authentication services.
type AuthServiceInteractor interface {
	Register(ctx context.Context, email, password string) (string, error)
	Login(ctx context.Context, email, password string) (string, error)
}

type AuthService struct {
	repo repository.UserRepository
	cfg  AuthConfigProvider // Uses the interface
}

// NewAuth creates a new AuthService instance.
// It now accepts AuthConfigProvider and returns AuthServiceInteractor.
func NewAuth(repo repository.UserRepository, cfg AuthConfigProvider) AuthServiceInteractor {
	return &AuthService{repo: repo, cfg: cfg}
}

func (a *AuthService) Register(ctx context.Context, email, password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err // Handle bcrypt errors
	}
	user := &model.User{
		ID:           uuid.New(),
		Email:        email,
		PasswordHash: string(hash),
		APIToken:     uuid.NewString(),
	}
	if err := a.repo.Create(ctx, user); err != nil {
		return "", err
	}
	return a.generateJWT(user.ID)
}

func (a *AuthService) Login(ctx context.Context, email, password string) (string, error) {
	u, err := a.repo.FindByEmail(ctx, email)
	if err != nil {
		return "", err
	}
	err = bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	if err != nil {
		return "", jwt.ErrTokenInvalidAudience
	}
	return a.generateJWT(u.ID)
}

func (a *AuthService) generateJWT(userID uuid.UUID) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(a.cfg.GetJWTSecret())
}
