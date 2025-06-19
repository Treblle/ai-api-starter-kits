// internal/service/linkedin_service.go
package service

import (
	"context"
	"sync" // Added for RWMutex

	"github.com/google/uuid"

	"github.com/you/linkedinify/internal/ai"
	"github.com/you/linkedinify/internal/model"
	"github.com/you/linkedinify/internal/repository"
)

// LinkedInServiceInteractor defines the operations for LinkedIn related services.
type LinkedInServiceInteractor interface {
	Transform(ctx context.Context, userID uuid.UUID, text string) (string, error)
	History(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]model.LinkedInPost, error)
}

type LinkedInService struct {
	ai    ai.Client
	posts repository.PostRepository
	cache map[string]string // Added for in-memory caching
	mu    sync.RWMutex      // Added for cache synchronization
}

// NewLinkedIn creates a new LinkedInService instance.
// It now returns the LinkedInServiceInteractor interface.
func NewLinkedIn(ai ai.Client, pr repository.PostRepository) LinkedInServiceInteractor {
	return &LinkedInService{
		ai:    ai,
		posts: pr,
		cache: make(map[string]string), // Initialize cache
	}
}

func (l *LinkedInService) Transform(ctx context.Context, userID uuid.UUID, text string) (string, error) {
	// Check cache first (read lock)
	l.mu.RLock()
	cachedOutput, found := l.cache[text]
	l.mu.RUnlock()

	var out string
	var err error

	if found {
		out = cachedOutput
	} else {
		// If not found, call AI, then write to cache (write lock)
		out, err = l.ai.Transform(ctx, text)
		if err != nil {
			return "", err
		}

		l.mu.Lock()
		l.cache[text] = out
		l.mu.Unlock()
	}

	// Save the transformation to history regardless of cache hit/miss
	post := &model.LinkedInPost{
		ID:         uuid.New(),
		UserID:     userID,
		InputText:  text,
		OutputText: out,
	}
	if err = l.posts.Save(ctx, post); err != nil {
		// Note: If saving fails, we might have already transformed and cached.
		// Depending on requirements, one might want to invalidate the cache entry here.
		// For now, we'll return the error and keep the cache entry.
		return "", err
	}
	return out, nil
}

func (l *LinkedInService) History(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]model.LinkedInPost, error) {
	return l.posts.ListByUser(ctx, userID, page, pageSize)
}
