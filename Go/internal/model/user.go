// internal/model/user.go
package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type User struct {
	bun.BaseModel `bun:"table:users"`
	ID            uuid.UUID `bun:"type:uuid,pk"`
	Email         string    `bun:",notnull,unique"`
	PasswordHash  string    `bun:",notnull"`
	APIToken      string    `bun:",notnull,unique"`
	CreatedAt     time.Time `bun:",nullzero,notnull,default:current_timestamp"`
}
