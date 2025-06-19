// internal/middleware/auth_middleware_test.go
package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/you/linkedinify/internal/middleware"
)

var testAuthSecret = []byte("test-jwt-secret-for-middleware")

// Helper function to generate a JWT for testing
func generateTestToken(t *testing.T, userID uuid.UUID, secret []byte, expiresIn time.Duration, customClaims ...map[string]interface{}) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"exp": time.Now().Add(expiresIn).Unix(),
		"iat": time.Now().Unix(),
	}
	// Allow overriding or adding claims for specific test cases
	if len(customClaims) > 0 {
		for k, v := range customClaims[0] {
			claims[k] = v
		}
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(secret)
	require.NoError(t, err, "Failed to sign test token")
	return signedToken
}

// Helper test handler that checks if it was called and optionally checks UserID from context
type mockHandler struct {
	called      bool
	handlerFunc func(w http.ResponseWriter, r *http.Request)
}

func (mh *mockHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	mh.called = true
	if mh.handlerFunc != nil {
		mh.handlerFunc(w, r)
	} else {
		w.WriteHeader(http.StatusOK)
	}
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	testUserID := uuid.New()
	token := generateTestToken(t, testUserID, testAuthSecret, time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	nextHandler := &mockHandler{
		handlerFunc: func(w http.ResponseWriter, r *http.Request) {
			contextUserID := middleware.UserID(r.Context())
			assert.Equal(t, testUserID, contextUserID, "UserID in context does not match token")
			w.WriteHeader(http.StatusOK)
		},
	}

	authMiddleware := middleware.Auth(testAuthSecret)
	handlerToTest := authMiddleware(nextHandler)
	handlerToTest.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code, "Expected StatusOK for valid token")
	assert.True(t, nextHandler.called, "Next handler was not called with a valid token")
}

func TestAuthMiddleware_InvalidToken_BadSignature(t *testing.T) {
	testUserID := uuid.New()
	wrongSecret := []byte("another-secret")
	token := generateTestToken(t, testUserID, wrongSecret, time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	nextHandler := &mockHandler{}
	authMiddleware := middleware.Auth(testAuthSecret)
	handlerToTest := authMiddleware(nextHandler)
	handlerToTest.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "Expected Unauthorized for bad signature")
	assert.False(t, nextHandler.called, "Next handler should not be called with bad signature")
}

func TestAuthMiddleware_InvalidToken_Expired(t *testing.T) {
	testUserID := uuid.New()
	token := generateTestToken(t, testUserID, testAuthSecret, -time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	nextHandler := &mockHandler{}
	authMiddleware := middleware.Auth(testAuthSecret)
	handlerToTest := authMiddleware(nextHandler)
	handlerToTest.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "Expected Unauthorized for expired token")
	assert.False(t, nextHandler.called, "Next handler should not be called with expired token")
}

func TestAuthMiddleware_NoAuthHeader(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rr := httptest.NewRecorder()

	nextHandler := &mockHandler{}
	authMiddleware := middleware.Auth(testAuthSecret)
	handlerToTest := authMiddleware(nextHandler)
	handlerToTest.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "Expected Unauthorized for missing auth header")
	assert.False(t, nextHandler.called, "Next handler should not be called with missing auth header")
}

func TestAuthMiddleware_MalformedAuthHeader_NoBearer(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "NotBearer someToken")
	rr := httptest.NewRecorder()

	nextHandler := &mockHandler{}
	authMiddleware := middleware.Auth(testAuthSecret)
	handlerToTest := authMiddleware(nextHandler)
	handlerToTest.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "Expected Unauthorized for malformed auth header")
	assert.False(t, nextHandler.called, "Next handler should not be called with malformed auth header")
}

func TestAuthMiddleware_MalformedAuthHeader_EmptyBearer(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer ")
	rr := httptest.NewRecorder()

	nextHandler := &mockHandler{}
	authMiddleware := middleware.Auth(testAuthSecret)
	handlerToTest := authMiddleware(nextHandler)
	handlerToTest.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "Expected Unauthorized for empty bearer token")
	assert.False(t, nextHandler.called, "Next handler should not be called with empty bearer token")
}

func TestAuthMiddleware_InvalidToken_NonUUIDSubClaim(t *testing.T) {
	token := generateTestToken(t, uuid.Nil, testAuthSecret, time.Hour, map[string]interface{}{"sub": "not-a-uuid"})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	nextHandler := &mockHandler{}
	authMiddleware := middleware.Auth(testAuthSecret)
	handlerToTest := authMiddleware(nextHandler)
	handlerToTest.ServeHTTP(rr, req)

	// Current middleware sets uuid.Nil if sub is not a valid UUID, but does not reject the request.
	assert.Equal(t, http.StatusOK, rr.Code, "Expected StatusOK as token is valid, sub becomes Nil UUID")
	assert.True(t, nextHandler.called, "Next handler should be called")
}

func TestAuthMiddleware_InvalidToken_MissingSubClaim(t *testing.T) {
	token := generateTestToken(t, uuid.Nil, testAuthSecret, time.Hour, map[string]interface{}{"sub": nil})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	nextHandler := &mockHandler{}
	authMiddleware := middleware.Auth(testAuthSecret)
	handlerToTest := authMiddleware(nextHandler)
	handlerToTest.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code, "Expected Unauthorized for missing sub claim")
	assert.False(t, nextHandler.called, "Next handler should not be called with missing sub claim")
}
