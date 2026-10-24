-- Frozen pre-Alembic PostgreSQL schema, independent of current ORM metadata.
CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR NOT NULL UNIQUE,
    password VARCHAR NOT NULL
);
CREATE INDEX ix_users_id ON public.users (id);
CREATE TABLE public.internships (
    id SERIAL PRIMARY KEY,
    company VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    application_date DATE NOT NULL,
    user_id INTEGER NOT NULL,
    location VARCHAR,
    job_url VARCHAR,
    notes TEXT
);
CREATE INDEX ix_internships_id ON public.internships (id);
