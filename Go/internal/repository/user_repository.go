// internal/repository/user_repository.go
package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"github.com/you/linkedinify/internal/model"
)

type UserRepository interface {
	FindByEmail(ctx context.Context, email string) (*model.User, error)
	FindByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	Create(ctx context.Context, u *model.User) error
}

type userRepo struct{ db *bun.DB }

func NewUserRepo(db *bun.DB) UserRepository { return &userRepo{db} }

func (r *userRepo) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	u := new(model.User)
	err := r.db.NewSelect().Model(u).Where("email = ?", email).Scan(ctx)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *userRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	u := new(model.User)
	err := r.db.NewSelect().Model(u).Where("id = ?", id).Scan(ctx)
	return u, err
}

func (r *userRepo) Create(ctx context.Context, u *model.User) error {
	_, err := r.db.NewInsert().Model(u).Exec(ctx)
	return err
}
