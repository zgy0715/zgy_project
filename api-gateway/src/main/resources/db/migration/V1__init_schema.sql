-- V1__init_schema.sql
-- Initial database schema for DeepAgent API Gateway

-- Users table
CREATE TABLE users (
    id          BIGSERIAL       PRIMARY KEY,
    username    VARCHAR(100)    NOT NULL UNIQUE,
    email       VARCHAR(255)    NOT NULL UNIQUE,
    password    VARCHAR(255)    NOT NULL,
    role        VARCHAR(20)     NOT NULL DEFAULT 'USER',
    enabled     BOOLEAN         NOT NULL DEFAULT TRUE,
    refresh_token VARCHAR(500),
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Projects table
CREATE TABLE projects (
    id          BIGSERIAL       PRIMARY KEY,
    name        VARCHAR(200)    NOT NULL,
    description VARCHAR(2000),
    owner_id    BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    agent_type  VARCHAR(50),
    config      VARCHAR(5000),
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Tasks table
CREATE TABLE tasks (
    id              BIGSERIAL       PRIMARY KEY,
    project_id      BIGINT          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(200)    NOT NULL,
    description     VARCHAR(2000),
    status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    agent_type      VARCHAR(50),
    input           VARCHAR(5000),
    output          VARCHAR(10000),
    dependencies    VARCHAR(2000)   DEFAULT '[]',
    retry_count     INTEGER,
    max_retries     INTEGER         DEFAULT 3,
    priority        INTEGER,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);

-- Insert default admin user (password: admin123)
-- BCrypt hash generated with strength 12
INSERT INTO users (username, email, password, role, enabled)
VALUES (
    'admin',
    'admin@deepagent.dev',
    '$2a$12$LJ3m4ys3Lg2RqwmMpVr5kuYDFnGMHbOlcEHjPMYVHNwiMbQwQJJAi',
    'ADMIN',
    TRUE
);
