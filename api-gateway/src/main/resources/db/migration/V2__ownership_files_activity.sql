-- ============================================================
-- V2: 归属关系持久化 / 项目文件 / 项目动态
-- 说明：V1 已上线，禁止修改；所有新增列与表都在此增量迁移中完成，
--       以保持 spring.jpa.hibernate.ddl-auto=validate 校验通过。
-- ============================================================

-- 用户头像（profile 更新接口使用）
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);

-- 任务归属（可空：历史任务没有 owner_id）
ALTER TABLE tasks ADD COLUMN owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_owner_id ON tasks(owner_id);

-- 回填历史任务的 owner_id：任务归属即其项目归属（相关子查询，PostgreSQL/H2 均可执行）。
UPDATE tasks SET owner_id = (
    SELECT p.owner_id FROM projects p WHERE p.id = tasks.project_id
) WHERE owner_id IS NULL;

-- 项目文件（代码/文本文件内容）
CREATE TABLE project_files (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path VARCHAR(500) NOT NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT,
    language VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_project_files_project_path UNIQUE (project_id, path)
);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);

-- 项目动态（活动流）
CREATE TABLE project_activity (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message VARCHAR(1000),
    actor VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_project_activity_project_created_at
    ON project_activity(project_id, created_at DESC);

-- Agent 归属：替代原先内存中的 ConcurrentHashMap（重启丢失 + fail-open）
CREATE TABLE agent_ownership (
    agent_id VARCHAR(255) PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_ownership_owner_id ON agent_ownership(owner_id);

-- Workflow 归属：agent-runtime 不返回 owner，因此归属同样需要在网关侧持久化，
-- 否则 workflow 的 5 个端点无法做授权校验。
CREATE TABLE workflow_ownership (
    workflow_id VARCHAR(255) PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflow_ownership_owner_id ON workflow_ownership(owner_id);
