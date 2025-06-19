// internal/service/auth_service_test.go
package service_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/you/linkedinify/internal/model"
	"github.com/you/linkedinify/internal/repository"
	"github.com/you/linkedinify/internal/service"
)

const testJWTSecret = "test-secret-for-auth-service"

// Helper to parse JWT and extract subject (userID)
func parseTestJWT(t *testing.T, tokenString string, secret []byte) (string, int64) {
	t.Helper()
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})
	require.NoError(t, err, "Failed to parse token")
	require.True(t, token.Valid, "Token is not valid")

	claims, ok := token.Claims.(jwt.MapClaims)
	require.True(t, ok, "Failed to get claims")

	sub, ok := claims["sub"].(string)
	require.True(t, ok, "Failed to get sub claim")

	expFloat, ok := claims["exp"].(float64)
	require.True(t, ok, "Failed to get exp claim")
	return sub, int64(expFloat)
}

func TestAuthService_Register_Success(t *testing.T) {
	mockUserRepo := &repository.UserRepositoryMock{
		CreateFunc: func(ctx context.Context, u *model.User) error {
			assert.NotEmpty(t, u.ID)
			assert.Equal(t, "test@example.com", u.Email)
			assert.NotEmpty(t, u.PasswordHash)
			err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte("password123"))
			assert.NoError(t, err, "Password was not hashed correctly")
			assert.NotEmpty(t, u.APIToken)
			return nil
		},
	}

	mockConfigProvider := &service.AuthConfigProviderMock{
		GetJWTSecretFunc: func() []byte {
			return []byte(testJWTSecret)
		},
	}

	authSvc := service.NewAuth(mockUserRepo, mockConfigProvider)

	email := "test@example.com"
	password := "password123"

	tokenString, err := authSvc.Register(context.Background(), email, password)
	require.NoError(t, err)
	require.NotEmpty(t, tokenString)

	// Verify JWT
	userIDStr, exp := parseTestJWT(t, tokenString, []byte(testJWTSecret))
	_, parseErr := uuid.Parse(userIDStr)
	require.NoError(t, parseErr, "Subject in JWT is not a valid UUID")
	assert.True(t, exp > time.Now().Unix(), "Token should not be expired")

	assert.Len(t, mockUserRepo.CreateCalls(), 1, "Expected Create to be called once")
	assert.Len(t, mockConfigProvider.GetJWTSecretCalls(), 1, "Expected GetJWTSecret to be called once")
}

func TestAuthService_Register_CreateUserError(t *testing.T) {
	dbError := errors.New("database error on create")
	mockUserRepo := &repository.UserRepositoryMock{
		CreateFunc: func(ctx context.Context, u *model.User) error {
			return dbError
		},
	}
	mockConfigProvider := &service.AuthConfigProviderMock{}

	authSvc := service.NewAuth(mockUserRepo, mockConfigProvider)
	_, err := authSvc.Register(context.Background(), "test@example.com", "password123")

	require.Error(t, err)
	assert.Equal(t, dbError, err)
	assert.Len(t, mockUserRepo.CreateCalls(), 1)
	assert.Len(t, mockConfigProvider.GetJWTSecretCalls(), 0)
}

func TestAuthService_Login_Success(t *testing.T) {
	testUserID := uuid.New()
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	mockUserRepo := &repository.UserRepositoryMock{
		FindByEmailFunc: func(ctx context.Context, email string) (*model.User, error) {
			assert.Equal(t, "test@example.com", email)
			return &model.User{
				ID:           testUserID,
				Email:        email,
				PasswordHash: string(hashedPassword),
			}, nil
		},
	}
	mockConfigProvider := &service.AuthConfigProviderMock{
		GetJWTSecretFunc: func() []byte {
			return []byte(testJWTSecret)
		},
	}

	authSvc := service.NewAuth(mockUserRepo, mockConfigProvider)

	tokenString, err := authSvc.Login(context.Background(), "test@example.com", "password123")
	require.NoError(t, err)
	require.NotEmpty(t, tokenString)

	// Verify JWT
	userIDStr, exp := parseTestJWT(t, tokenString, []byte(testJWTSecret))
	assert.Equal(t, testUserID.String(), userIDStr, "UserID in JWT does not match")
	assert.True(t, exp > time.Now().Unix(), "Token should not be expired")

	assert.Len(t, mockUserRepo.FindByEmailCalls(), 1)
	assert.Len(t, mockConfigProvider.GetJWTSecretCalls(), 1)
}

func TestAuthService_Login_UserNotFound(t *testing.T) {
	mockUserRepo := &repository.UserRepositoryMock{
		FindByEmailFunc: func(ctx context.Context, email string) (*model.User, error) {
			return nil, sql.ErrNoRows
		},
	}
	mockConfigProvider := &service.AuthConfigProviderMock{}

	authSvc := service.NewAuth(mockUserRepo, mockConfigProvider)
	_, err := authSvc.Login(context.Background(), "unknown@example.com", "password123")

	require.Error(t, err)
	assert.Equal(t, sql.ErrNoRows, err)
	assert.Len(t, mockUserRepo.FindByEmailCalls(), 1)
	assert.Len(t, mockConfigProvider.GetJWTSecretCalls(), 0)
}

func TestAuthService_Login_IncorrectPassword(t *testing.T) {
	testUserID := uuid.New()
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.DefaultCost)
	mockUserRepo := &repository.UserRepositoryMock{
		FindByEmailFunc: func(ctx context.Context, email string) (*model.User, error) {
			return &model.User{
				ID:           testUserID,
				Email:        email,
				PasswordHash: string(hashedPassword),
			}, nil
		},
	}
	mockConfigProvider := &service.AuthConfigProviderMock{}

	authSvc := service.NewAuth(mockUserRepo, mockConfigProvider)

	_, err := authSvc.Login(context.Background(), "test@example.com", "wrongpassword")
	require.Error(t, err)
	assert.Equal(t, jwt.ErrTokenInvalidAudience, err)
	assert.Len(t, mockUserRepo.FindByEmailCalls(), 1)
	assert.Len(t, mockConfigProvider.GetJWTSecretCalls(), 0)
}

func TestAuthService_Login_RepositoryError(t *testing.T) {
	repoErr := errors.New("some other repository error")
	mockUserRepo := &repository.UserRepositoryMock{
		FindByEmailFunc: func(ctx context.Context, email string) (*model.User, error) {
			return nil, repoErr
		},
	}
	mockConfigProvider := &service.AuthConfigProviderMock{}

	authSvc := service.NewAuth(mockUserRepo, mockConfigProvider)
	_, err := authSvc.Login(context.Background(), "test@example.com", "password")

	require.Error(t, err)
	assert.Equal(t, repoErr, err)
	assert.Len(t, mockUserRepo.FindByEmailCalls(), 1)
	assert.Len(t, mockConfigProvider.GetJWTSecretCalls(), 0)
}
