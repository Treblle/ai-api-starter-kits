package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/you/linkedinify/internal/handler"
	"github.com/you/linkedinify/internal/service"
)

func TestAuthHandler_Login_Success(t *testing.T) {
	mockAuthService := &service.AuthServiceInteractorMock{
		LoginFunc: func(ctx context.Context, email, password string) (string, error) {
			assert.Equal(t, "test@example.com", email)
			assert.Equal(t, "password123", password)
			return "test-jwt-token", nil
		},
	}
	authHandler := handler.NewAuth(mockAuthService)
	router := authHandler.Routes()
	server := httptest.NewServer(router)
	defer server.Close()

	requestBody := map[string]string{
		"email":    "test@example.com",
		"password": "password123",
	}
	jsonBody, _ := json.Marshal(requestBody)

	req, _ := http.NewRequest(http.MethodPost, server.URL+"/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	var respBody map[string]string
	err = json.NewDecoder(resp.Body).Decode(&respBody)
	require.NoError(t, err)
	assert.Equal(t, "test-jwt-token", respBody["token"])
	require.Len(t, mockAuthService.LoginCalls(), 1)
}

func TestAuthHandler_Login_InvalidCredentials(t *testing.T) {
	mockAuthService := &service.AuthServiceInteractorMock{
		LoginFunc: func(ctx context.Context, email, password string) (string, error) {
			return "", errors.New("invalid credentials")
		},
	}
	authHandler := handler.NewAuth(mockAuthService)
	router := authHandler.Routes()
	server := httptest.NewServer(router)
	defer server.Close()

	requestBody := map[string]string{"email": "test@example.com", "password": "wrongpassword"}
	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest(http.MethodPost, server.URL+"/login", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	require.Len(t, mockAuthService.LoginCalls(), 1)
}

func TestAuthHandler_Login_BadRequest_MissingFields(t *testing.T) {
	mockAuthService := &service.AuthServiceInteractorMock{}
	authHandler := handler.NewAuth(mockAuthService)
	router := authHandler.Routes()
	server := httptest.NewServer(router)
	defer server.Close()

	tests := []struct {
		name        string
		payload     map[string]string
		expectedMsg string
	}{
		{"missing_email", map[string]string{"password": "password123"}, "bad request: missing email or password"},
		{"missing_password", map[string]string{"email": "test@example.com"}, "bad request: missing email or password"},
		{"empty_payload", map[string]string{}, "bad request: missing email or password"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonBody, _ := json.Marshal(tt.payload)
			req, _ := http.NewRequest(http.MethodPost, server.URL+"/login", bytes.NewBuffer(jsonBody))
			req.Header.Set("Content-Type", "application/json")

			resp, err := server.Client().Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		})
	}
	assert.Len(t, mockAuthService.LoginCalls(), 0)
}

func TestAuthHandler_Register_Success(t *testing.T) {
	mockAuthService := &service.AuthServiceInteractorMock{
		RegisterFunc: func(ctx context.Context, email, password string) (string, error) {
			assert.Equal(t, "newuser@example.com", email)
			assert.Equal(t, "securepassword", password)
			return "new-test-jwt-token", nil
		},
	}
	authHandler := handler.NewAuth(mockAuthService)
	router := authHandler.Routes()
	server := httptest.NewServer(router)
	defer server.Close()

	requestBody := map[string]string{"email": "newuser@example.com", "password": "securepassword"}
	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest(http.MethodPost, server.URL+"/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)
	var respBody map[string]string
	err = json.NewDecoder(resp.Body).Decode(&respBody)
	require.NoError(t, err)
	assert.Equal(t, "new-test-jwt-token", respBody["token"])
	require.Len(t, mockAuthService.RegisterCalls(), 1)
}

func TestAuthHandler_Register_Conflict(t *testing.T) {
	userExistsError := errors.New("user already exists")
	mockAuthService := &service.AuthServiceInteractorMock{
		RegisterFunc: func(ctx context.Context, email, password string) (string, error) {
			return "", userExistsError
		},
	}
	authHandler := handler.NewAuth(mockAuthService)
	router := authHandler.Routes()
	server := httptest.NewServer(router)
	defer server.Close()

	requestBody := map[string]string{"email": "existing@example.com", "password": "password123"}
	jsonBody, _ := json.Marshal(requestBody)
	req, _ := http.NewRequest(http.MethodPost, server.URL+"/register", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	require.Len(t, mockAuthService.RegisterCalls(), 1)
}
