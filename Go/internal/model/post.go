// internal/model/post.go
package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type LinkedInPost struct {
	bun.BaseModel `bun:"table:linkedin_posts"`
	ID            uuid.UUID `bun:"type:uuid,pk"`
	UserID        uuid.UUID `bun:"type:uuid,notnull"`
	InputText     string    `bun:",notnull"`
	OutputText    string    `bun:",notnull"`
	CreatedAt     time.Time `bun:",nullzero,notnull,default:current_timestamp"`
}
