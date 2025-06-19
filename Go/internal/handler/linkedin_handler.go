// internal/handler/linkedin_handler.go
package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"strconv"

	"github.com/microcosm-cc/bluemonday"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/you/linkedinify/internal/middleware"
	"github.com/you/linkedinify/internal/service"
)

type LinkedInHandler struct {
	svc service.LinkedInServiceInteractor
}

func NewLinkedIn(svc service.LinkedInServiceInteractor) *LinkedInHandler {
	return &LinkedInHandler{svc: svc}
}

func (h *LinkedInHandler) Routes(secret []byte) chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.Auth(secret))
	r.Post("/", h.transform)
	r.Get("/", h.history)
	return r
}

type reqBody struct {
	Text string `json:"text"`
}

func (h *LinkedInHandler) transform(w http.ResponseWriter, r *http.Request) {
	var in reqBody
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if in.Text == "" {
		respondError(w, http.StatusBadRequest, "The 'text' field is required")
		return
	}

	p := bluemonday.StrictPolicy()
	sanitizedText := p.Sanitize(in.Text)
	uid := middleware.UserID(r.Context())
	out, err := h.svc.Transform(r.Context(), uid, sanitizedText)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to transform text")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"post": out})
}

func (h *LinkedInHandler) history(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10 // Default page size
	}

	items, err := h.svc.History(r.Context(), uid, page, pageSize)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to retrieve history")
		return
	}
	type item struct {
		ID    uuid.UUID `json:"id"`
		Input string    `json:"input"`
		Post  string    `json:"post"`
	}
	var res []item
	for _, p := range items {
		res = append(res, item{ID: p.ID, Input: p.InputText, Post: p.OutputText})
	}
	respondJSON(w, http.StatusOK, res)
}

// --- Response Helpers ---

// respondJSON writes a JSON response with a given status code and payload.
func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	response, err := json.Marshal(payload)
	if err != nil {
		log.Printf("ERROR: Failed to marshal JSON response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		// We'll try to write an error response, but this might also fail
		if _, writeErr := w.Write([]byte(`{"error":"Internal server error"}`)); writeErr != nil {
			log.Printf("ERROR: Could not write error response: %v", writeErr)
		}
		return
	}
	w.WriteHeader(status)
	if _, err := w.Write(response); err != nil {
		log.Printf("ERROR: Failed to write JSON response: %v", err)
	}
}

// respondError sends a structured JSON error response.
func respondError(w http.ResponseWriter, code int, message string) {
	respondJSON(w, code, map[string]string{"error": message})
}
