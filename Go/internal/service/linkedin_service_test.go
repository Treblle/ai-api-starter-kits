// internal/service/linkedin_service_test.go
package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/you/linkedinify/internal/ai"
	"github.com/you/linkedinify/internal/model"
	"github.com/you/linkedinify/internal/repository"
	"github.com/you/linkedinify/internal/service"
)

func TestLinkedInService_Transform_Success(t *testing.T) {
	mockAIClient := &ai.ClientMock{
		TransformFunc: func(ctx context.Context, text string) (string, error) {
			assert.Equal(t, "original text", text)
			return "ai transformed text", nil
		},
	}

	mockPostRepo := &repository.PostRepositoryMock{
		SaveFunc: func(ctx context.Context, p *model.LinkedInPost) error {
			assert.NotNil(t, p)
			assert.NotEmpty(t, p.ID)
			assert.Equal(t, "11111111-1111-1111-1111-111111111111", p.UserID.String())
			assert.Equal(t, "original text", p.InputText)
			assert.Equal(t, "ai transformed text", p.OutputText)
			return nil
		},
	}

	liSvc := service.NewLinkedIn(mockAIClient, mockPostRepo)

	userID, _ := uuid.Parse("11111111-1111-1111-1111-111111111111")
	inputText := "original text"

	transformedText, err := liSvc.Transform(context.Background(), userID, inputText)
	require.NoError(t, err)
	assert.Equal(t, "ai transformed text", transformedText)

	assert.Len(t, mockAIClient.TransformCalls(), 1, "Expected AIClient.Transform to be called once on first call (cache miss)")
	assert.Len(t, mockPostRepo.SaveCalls(), 1, "Expected PostRepository.Save to be called once on first call")

	// Second call with the same input - should be a cache hit
	transformedTextCached, errCached := liSvc.Transform(context.Background(), userID, inputText)
	require.NoError(t, errCached)
	assert.Equal(t, "ai transformed text", transformedTextCached)

	assert.Len(t, mockAIClient.TransformCalls(), 1, "Expected AIClient.Transform to still be called only once (cache hit)")
	assert.Len(t, mockPostRepo.SaveCalls(), 2, "Expected PostRepository.Save to be called twice (once for cache miss, once for cache hit)")
}

func TestLinkedInService_Transform_AIClientError(t *testing.T) {
	aiError := errors.New("ai client failed")
	mockAIClient := &ai.ClientMock{
		TransformFunc: func(ctx context.Context, text string) (string, error) {
			return "", aiError
		},
	}
	mockPostRepo := &repository.PostRepositoryMock{}

	liSvc := service.NewLinkedIn(mockAIClient, mockPostRepo)
	userID, _ := uuid.Parse("test-user-id")

	_, err := liSvc.Transform(context.Background(), userID, "some text")
	require.Error(t, err)
	assert.Equal(t, aiError, err)

	assert.Len(t, mockAIClient.TransformCalls(), 1)
	assert.Len(t, mockPostRepo.SaveCalls(), 0)
}

func TestLinkedInService_Transform_RepositorySaveError(t *testing.T) {
	repoSaveError := errors.New("failed to save post")
	mockAIClient := &ai.ClientMock{
		TransformFunc: func(ctx context.Context, text string) (string, error) {
			return "transformed text", nil
		},
	}
	mockPostRepo := &repository.PostRepositoryMock{
		SaveFunc: func(ctx context.Context, p *model.LinkedInPost) error {
			return repoSaveError
		},
	}

	liSvc := service.NewLinkedIn(mockAIClient, mockPostRepo)
	userID, _ := uuid.Parse("test-user-id")

	_, err := liSvc.Transform(context.Background(), userID, "some text")
	require.Error(t, err)
	assert.Equal(t, repoSaveError, err)

	assert.Len(t, mockAIClient.TransformCalls(), 1)
	assert.Len(t, mockPostRepo.SaveCalls(), 1)
}

func TestLinkedInService_History_Success(t *testing.T) {
	testUserID, _ := uuid.Parse("history-user-id")
	expectedPosts := []model.LinkedInPost{
		{ID: uuid.New(), UserID: testUserID, InputText: "in1", OutputText: "out1", CreatedAt: time.Now().Add(-time.Hour)},
		{ID: uuid.New(), UserID: testUserID, InputText: "in2", OutputText: "out2", CreatedAt: time.Now()},
	}

	mockPostRepo := &repository.PostRepositoryMock{
		ListByUserFunc: func(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]model.LinkedInPost, error) {
			assert.Equal(t, testUserID, userID)
			assert.Equal(t, 1, page)
			assert.Equal(t, 10, pageSize)
			return expectedPosts, nil
		},
	}
	mockAIClient := &ai.ClientMock{}

	liSvc := service.NewLinkedIn(mockAIClient, mockPostRepo)

	posts, err := liSvc.History(context.Background(), testUserID, 1, 10)
	require.NoError(t, err)
	assert.Equal(t, expectedPosts, posts)
	assert.Len(t, mockPostRepo.ListByUserCalls(), 1)
}

func TestLinkedInService_History_RepositoryError(t *testing.T) {
	repoListError := errors.New("failed to list posts")
	testUserID, _ := uuid.Parse("history-user-id-err")

	mockPostRepo := &repository.PostRepositoryMock{
		ListByUserFunc: func(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]model.LinkedInPost, error) {
			return nil, repoListError
		},
	}
	mockAIClient := &ai.ClientMock{}

	liSvc := service.NewLinkedIn(mockAIClient, mockPostRepo)

	_, err := liSvc.History(context.Background(), testUserID, 1, 10)
	require.Error(t, err)
	assert.Equal(t, repoListError, err)
	assert.Len(t, mockPostRepo.ListByUserCalls(), 1)
}
