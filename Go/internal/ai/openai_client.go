// internal/ai/openai_client.go
package ai

import (
	"context"
	"fmt"

	openai "github.com/sashabaranov/go-openai"
)

type Client interface {
	Transform(ctx context.Context, text string) (string, error)
}

type openaiClient struct {
	cl *openai.Client
}

func NewOpenAI(token string) Client {
	return &openaiClient{cl: openai.NewClient(token)}
}

func (c *openaiClient) Transform(ctx context.Context, text string) (string, error) {
	msg := fmt.Sprintf(`Rewrite the following statement as an over-the-top inspirational LinkedIn post with emojis, buzzwords, and hashtags. Keep it under 240 characters.

"%s"`, text)
	resp, err := c.cl.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: "gpt-4o-mini",
		Messages: []openai.ChatCompletionMessage{
			{Role: "system", Content: "You are a viral LinkedIn influencer."},
			{Role: "user", Content: msg},
		},
		MaxTokens: 120,
	})
	if err != nil {
		return "", err
	}
	return resp.Choices[0].Message.Content, nil
}
