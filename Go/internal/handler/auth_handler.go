// internal/handler/auth_handler.go
package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/you/linkedinify/internal/service"
)

type AuthHandler struct {
	svc service.AuthServiceInteractor
}

func NewAuth(svc service.AuthServiceInteractor) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/login", h.login)
	r.Post("/register", h.register)
	return r
}

type creds struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) login(w http.ResponseWriter, r *http.Request) {
	var c creds
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil || c.Email == "" || c.Password == "" {
		http.Error(w, "bad request: missing email or password", http.StatusBadRequest)
		return
	}
	token, err := h.svc.Login(r.Context(), c.Email, c.Password)
	if err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func (h *AuthHandler) register(w http.ResponseWriter, r *http.Request) {
	var c creds
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil || c.Email == "" || c.Password == "" {
		http.Error(w, "bad request: missing email or password", http.StatusBadRequest)
		return
	}
	token, err := h.svc.Register(r.Context(), c.Email, c.Password)
	if err != nil {
		log.Printf("Registration error: %v", err)
		http.Error(w, "registration failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}
