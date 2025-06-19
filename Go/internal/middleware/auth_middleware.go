// internal/middleware/auth_middleware.go
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type ctxKey string

const userKey ctxKey = "userID"

func UserID(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(userKey).(uuid.UUID)
	return id
}

func Auth(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if !strings.HasPrefix(auth, "Bearer ") {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			raw := strings.TrimPrefix(auth, "Bearer ")
			token, err := jwt.Parse(raw, func(t *jwt.Token) (interface{}, error) {
				return secret, nil
			}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Name}))
			if err != nil || !token.Valid {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			claims, _ := token.Claims.(jwt.MapClaims)
			sub, ok := claims["sub"].(string)
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			uid, _ := uuid.Parse(sub)
			ctx := context.WithValue(r.Context(), userKey, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
