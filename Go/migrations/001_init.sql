-- migrations/001_init.sql
create extension if not exists "uuid-ossp";

create table users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  password_hash text not null,
  api_token text not null unique,
  created_at timestamptz default now()
);

create table linkedin_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  input_text text not null,
  output_text text not null,
  created_at timestamptz default now()
);
