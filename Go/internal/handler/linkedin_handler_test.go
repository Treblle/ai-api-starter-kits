package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/you/linkedinify/internal/handler"
	"github.com/you/linkedinify/internal/model"
	"github.com/you/linkedinify/internal/service"
)

// Helper to generate a JWT for testing
func generateTestToken(t *testing.T, userID uuid.UUID, secret []byte) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"exp": time.Now().Add(time.Hour * 1).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(secret)
	require.NoError(t, err)
	return signedToken
}

func TestLinkedInHandler_transform_Success(t *testing.T) {
	mockService := &service.LinkedInServiceInteractorMock{
		TransformFunc: func(ctx context.Context, userID uuid.UUID, text string) (string, error) {
			assert.Equal(t, "00000000-0000-0000-0000-000000000001", userID.String())
			assert.Equal(t, "some input text", text)
			return "transformed linkedin post", nil
		},
	}
	testUserID, _ := uuid.Parse("00000000-0000-0000-0000-000000000001")
	testSecret := []byte("your-test-jwt-secret")
	linkedinHandler := handler.NewLinkedIn(mockService)
	router := linkedinHandler.Routes(testSecret)
	server := httptest.NewServer(router)
	defer server.Close()

	requestBody := map[string]string{"text": "some input text"}
	jsonBody, err := json.Marshal(requestBody)
	require.NoError(t, err)
	authToken := generateTestToken(t, testUserID, testSecret)

	req, err := http.NewRequest(http.MethodPost, server.URL+"/", bytes.NewBuffer(jsonBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var responseBody map[string]string
	err = json.NewDecoder(resp.Body).Decode(&responseBody)
	require.NoError(t, err)
	assert.Equal(t, "transformed linkedin post", responseBody["post"])
	assert.Len(t, mockService.TransformCalls(), 1)
	call := mockService.TransformCalls()[0]
	assert.Equal(t, testUserID, call.UserID)
	assert.Equal(t, "some input text", call.Text)
}

func TestLinkedInHandler_transform_BadRequest_EmptyText(t *testing.T) {
	mockService := &service.LinkedInServiceInteractorMock{}
	testUserID, _ := uuid.Parse("00000000-0000-0000-0000-000000000002")
	testSecret := []byte("your-test-jwt-secret")
	linkedinHandler := handler.NewLinkedIn(mockService)
	router := linkedinHandler.Routes(testSecret)
	server := httptest.NewServer(router)
	defer server.Close()

	requestBody := map[string]string{"text": ""}
	jsonBody, _ := json.Marshal(requestBody)
	authToken := generateTestToken(t, testUserID, testSecret)

	req, err := http.NewRequest(http.MethodPost, server.URL+"/", bytes.NewBuffer(jsonBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	assert.Len(t, mockService.TransformCalls(), 0)
}

func TestLinkedInHandler_History_Success(t *testing.T) {
	testUserID, _ := uuid.Parse("00000000-0000-0000-0000-000000000003")
	testSecret := []byte("your-test-jwt-secret")
	expectedPosts := []model.LinkedInPost{
		{ID: uuid.New(), UserID: testUserID, InputText: "in1", OutputText: "out1"},
	}

	mockService := &service.LinkedInServiceInteractorMock{
		HistoryFunc: func(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]model.LinkedInPost, error) {
			assert.Equal(t, testUserID, userID)
			assert.Equal(t, 1, page)
			assert.Equal(t, 5, pageSize)
			return expectedPosts, nil
		},
	}

	linkedinHandler := handler.NewLinkedIn(mockService)
	router := linkedinHandler.Routes(testSecret)
	server := httptest.NewServer(router)
	defer server.Close()

	authToken := generateTestToken(t, testUserID, testSecret)
	req, err := http.NewRequest(http.MethodGet, server.URL+"/?page=1&pageSize=5", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer "+authToken)

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var responseBody []map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&responseBody)
	require.NoError(t, err)
	assert.Len(t, responseBody, 1)
	assert.Equal(t, expectedPosts[0].InputText, responseBody[0]["input"])
	assert.Len(t, mockService.HistoryCalls(), 1)
}

func TestLinkedInHandler_History_ServiceError(t *testing.T) {
	testUserID, _ := uuid.Parse("00000000-0000-0000-0000-000000000004")
	testSecret := []byte("your-test-jwt-secret")
	serviceErr := errors.New("service error")

	mockService := &service.LinkedInServiceInteractorMock{
		HistoryFunc: func(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]model.LinkedInPost, error) {
			return nil, serviceErr
		},
	}

	linkedinHandler := handler.NewLinkedIn(mockService)
	router := linkedinHandler.Routes(testSecret)
	server := httptest.NewServer(router)
	defer server.Close()

	authToken := generateTestToken(t, testUserID, testSecret)
	req, err := http.NewRequest(http.MethodGet, server.URL+"/", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer "+authToken)

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	assert.Len(t, mockService.HistoryCalls(), 1)
}

func TestLinkedInHandler_transform_SanitizesInput(t *testing.T) {
	mockService := &service.LinkedInServiceInteractorMock{
		TransformFunc: func(ctx context.Context, userID uuid.UUID, text string) (string, error) {
			// Assert that the text received by the service is sanitized
			assert.Equal(t, "Hello world", text, "Expected input to be sanitized")
			return "sanitized and transformed", nil
		},
	}
	testUserID, _ := uuid.Parse("00000000-0000-0000-0000-000000000005")
	testSecret := []byte("your-test-jwt-secret")
	linkedinHandler := handler.NewLinkedIn(mockService)
	router := linkedinHandler.Routes(testSecret)
	server := httptest.NewServer(router)
	defer server.Close()

	// Input with HTML tags
	requestBody := map[string]string{"text": "<p>Hello world</p><script>alert('xss')</script>"}
	jsonBody, err := json.Marshal(requestBody)
	require.NoError(t, err)
	authToken := generateTestToken(t, testUserID, testSecret)

	req, err := http.NewRequest(http.MethodPost, server.URL+"/", bytes.NewBuffer(jsonBody))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)

	resp, err := server.Client().Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusCreated, resp.StatusCode)
	assert.Len(t, mockService.TransformCalls(), 1)
}
