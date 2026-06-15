# AIREAD.md — DeepAgent AI 开发指南

> 本文件为 AI 辅助开发提供项目全景视图，确保 AI 理解项目架构、约定和当前状态。

---

## 项目概览

**DeepAgent** 是一个基于大语言模型的多智能体协作开发平台。编排 Coder、Reviewer、Tester、Deployer 四个专业化 AI Agent，让它们像真实软件团队一样协同工作。

- **版本**: v0.2.1
- **状态**: 核心功能已实现，全栈安全加固完成，安全审计问题已修复

---

## 四层架构

```
前端 (Next.js 14 / TypeScript)  ←→  API 网关 (Java 21 / Spring Boot 3)
                                          ↕ gRPC / RabbitMQ
                                   Agent 运行时 (Python 3.11 / FastAPI)
                                          ↕ pybind11
                                   向量引擎 (C++17 / HNSW)
```

---

## 目录结构

```
zgy_project/
├── frontend/          # Next.js 14 前端 (App Router)
├── api-gateway/       # Java 21 Spring Boot 3 API 网关
├── agent-runtime/     # Python 3.11 FastAPI Agent 运行时
├── vector-engine/     # C++17 HNSW 向量引擎
├── scripts/           # E2E 测试脚本
├── .env.example       # 环境变量模板
├── docker-compose.yml # 一键部署
└── README.md
```

---

## 前端详细架构 (frontend/)

### 技术栈
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript 5.x
- **状态管理**: Zustand (纯 API 模式，无 mock)
- **样式**: Tailwind CSS
- **代码编辑**: Monaco Editor
- **工作流编辑**: ReactFlow
- **终端**: xterm.js
- **WebSocket**: @stomp/stompjs + sockjs-client
- **HTTP**: Axios
- **图表**: Recharts

### 安全措施
- JWT Access Token (1h) + Refresh Token (24h) 双令牌
- Axios 拦截器自动附加 Bearer Token，401 自动刷新
- Cookie SameSite=Strict，生产环境 Secure 标志
- 安全响应头: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- 所有页面需认证（中间件 Cookie 检查 + Route Guard）

### API 模式
- **仅支持 API 模式**，已完全移除 mock 模式
- `API_MODE` 常量固定为 `'api'`
- 所有数据通过后端 API 获取

### 后端 API 格式
```typescript
// 统一响应格式
ApiResponse<T> = {
  success: boolean;
  code: string;       // 如 "SUCCESS", "AUTH_FAILED"
  message: string;
  data: T;
  timestamp?: string;
}

// 分页响应格式
PaginatedResponse<T> = {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
```

### 认证流程
- JWT 双令牌: Access Token (1小时) + Refresh Token (24小时)
- 登录/注册后存储到 localStorage + Zustand persist
- Axios 拦截器自动附加 Bearer Token
- 401 时自动尝试 Refresh Token 刷新
- 登出时黑名单 Access Token + Refresh Token (Redis)
- Next.js Middleware 检查 `deepagent_authenticated` cookie (SameSite=Strict)

### 状态管理 (6 个 Store)

| Store | 文件 | 职责 |
|-------|------|------|
| auth-store | `stores/auth-store.ts` | 认证状态、登录/注册/登出、token 管理 |
| project-store | `stores/project-store.ts` | 项目列表/详情/活动流 |
| agent-store | `stores/agent-store.ts` | Agent 列表/对话/SSE 流式聊天/思维链 |
| workflow-store | `stores/workflow-store.ts` | 工作流列表/编辑/执行/节点操作 |
| editor-store | `stores/editor-store.ts` | 文件树/代码编辑/Tab 管理/文件 CRUD |
| notification-store | `stores/notification-store.ts` | 通知列表/未读计数 |

### 页面路由

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | Landing Page | 产品介绍、Agent 展示 |
| `/auth/login` | 登录页 | JWT 登录 |
| `/auth/register` | 注册页 | 用户注册 |
| `/auth/forgot-password` | 忘记密码 | 邮箱重置 (占位) |
| `/dashboard` | 仪表板 | 项目概览、统计、活动流 |
| `/dashboard/agents` | Agent 管理 | 创建/删除/编辑 Agent |
| `/dashboard/workflows` | 工作流管理 | 创建/删除/执行工作流 |
| `/dashboard/projects` | 项目列表 | 项目 CRUD |
| `/dashboard/projects/[id]` | 项目详情 | 概览/统计/活动 |
| `/dashboard/projects/[id]/agents` | 项目 Agent | Agent 对话 (SSE 流式) |
| `/dashboard/projects/[id]/workflow` | 工作流编辑 | ReactFlow DAG 编辑器 |
| `/dashboard/projects/[id]/code` | 代码编辑器 | Monaco + 文件树 + 终端 |
| `/dashboard/settings` | 设置 | 个人资料/密码/主题 |
| `/dashboard/docs` | 文档 | 项目 Markdown 文档查看 |

### SSE 流式对话
- `streamAgentChat()` 使用 fetch + ReadableStream
- 事件类型: `message_start` / `content_delta` / `message_end` / `error`
- 实时更新 Agent 状态: pending → planning → executing → completed/failed

### WebSocket (STOMP)
- 连接端点: `/ws` (SockJS)
- 订阅: `/topic/project/{projectId}`, `/user/queue/notifications`
- 发送: `/app/terminal/{projectId}` (终端输入)
- JWT 认证: 连接时在 STOMP headers 传递 token
- 安全: 订阅时验证用户认证状态，限制非授权 topic

---

## 后端 API 端点

### 认证 (/api/v1/auth)
- `POST /auth/login` — 登录
- `POST /auth/register` — 注册
- `POST /auth/refresh` — 刷新令牌 (X-Refresh-Token header)
- `POST /auth/logout` — 登出 (黑名单 Access + Refresh Token)
- `GET /auth/me` — 获取当前用户

### 项目 (/api/v1/projects)
- `GET /projects` — 项目列表 (分页, ?page=&size=)
- `GET /projects/{id}` — 项目详情
- `POST /projects` — 创建项目
- `PUT /projects/{id}` — 更新项目
- `DELETE /projects/{id}` — 删除项目
- `GET /projects/{id}/files` — 文件树
- `GET /projects/{id}/files/{fileId}` — 文件内容
- `PUT /projects/{id}/files/{fileId}` — 更新文件
- `GET /projects/{id}/activity` — 项目活动

### Agent (/api/v1/agents)
- `GET /agents` — Agent 列表 (?projectId=)
- `GET /agents/{id}` — Agent 详情 (需所有权验证)
- `POST /agents` — 创建 Agent (记录 owner)
- `DELETE /agents/{id}` — 删除 Agent (需所有权验证)
- `POST /agents/{id}/chat/stream` — SSE 流式对话
- `GET /agents/{id}/thinking-chain` — 思维链
- `GET /agents/{id}/messages` — 消息历史

### 工作流 (/api/v1/workflows)
- `GET /workflows` — 工作流列表 (?projectId=)
- `GET /workflows/{id}` — 工作流详情
- `POST /workflows` — 创建工作流
- `DELETE /workflows/{id}` — 删除工作流
- `PUT /workflows/{id}` — 保存工作流
- `POST /workflows/{id}/execute` — 执行工作流

---

## 安全架构

### 认证与授权
- **JWT HMAC-SHA256**: 强制 32 字符最小密钥长度，拒绝开发默认值
- **Token 黑名单**: Redis 统一前缀 `jwt:blacklist:`，覆盖 HTTP + WebSocket
- **Agent 所有权**: API Gateway 层维护 agentId→userId 映射，操作前校验
- **内部 API 密钥**: Agent Runtime 要求 `X-DeepAgent-Internal-Key` 请求头

### 速率限制 (Rate Limiting)
- 认证接口: 10 次/分钟/IP
- 通用 API: 100 次/分钟/用户
- 支持 Redis（多实例）和内存回退（单实例）

### WebSocket 安全
- STOMP CONNECT: JWT 认证 + 黑名单检查
- STOMP SUBSCRIBE: 仅允许 `/topic/project/` 和 `/user/` 前缀
- 未认证订阅请求被拒绝

### Agent 工具安全
- **TerminalTool**: 四层防御 (shell 语法过滤 → 命令白名单 → 危险模式匹配 → 路径写入检查)
- **FileOps**: 路径白名单 `allowed_directories`，文件大小限制 10MB，关闭失败
- **CoderAgent**: 移除终端代码执行验证，仅通过 LLM 审核代码质量

### 安全配置要求
| 环境变量 | 要求 | 说明 |
|---------|------|------|
| `JWT_SECRET` | ≥32 字符 | HMAC-SHA256 签名密钥 |
| `INTERNAL_API_KEY` | 推荐 64 字符十六进制 | 内部服务间认证 |
| `OPENAI_API_KEY` | 有效 API Key | LLM 服务密钥 |

---

## 开发约定

### 命名规范
- 组件文件: kebab-case (`chat-panel.tsx`)
- Store 文件: kebab-case (`agent-store.ts`)
- 类型文件: camelCase 或 index (`types/index.ts`)
- CSS 类: Tailwind utility classes

### 代码风格
- 使用 `'use client'` 标记客户端组件
- Zustand store 使用 `create()` + TypeScript 泛型
- API 调用统一通过 `api-client.ts` 中的方法
- 错误处理: try/catch + `(error as any)?.response?.data?.message`
- 所有 Controller 端点需添加 `@AuthenticationPrincipal UserDetails` 参数

### 环境变量
- `NEXT_PUBLIC_API_URL` — 后端 API 地址 (默认 http://localhost:8080/api/v1)
- `NEXT_PUBLIC_WS_URL` — WebSocket 地址 (默认 ws://localhost:8080/ws)
- 不再使用 `NEXT_PUBLIC_API_MODE` (已移除 mock 模式)

---

## 已知限制与 TODO

### 后端 API 待实现
- `PUT /auth/profile` — 更新用户资料 (Settings 页面暂仅本地更新)
- `POST /auth/change-password` — 修改密码 (Settings 页面已标记为"开发中")
- `PUT /agents/{id}` — 更新 Agent 配置 (编辑 Agent 暂仅本地更新)
- Agent 所有权持久化存储 (当前使用 API Gateway 内存 Map，重启后丢失)

### 前端待优化
- Diff 模式的"原始代码"是模拟生成的，非真实版本对比
- 项目列表页状态显示为英文原始值，需统一中文映射
- 通知的 icon 字段为字符串，未映射到实际图标组件

---

## 变更日志

### v0.2.1 - 2026-06-15 — 安全审计修复

#### 🔴 严重漏洞修复
- JWT Secret 添加 32 字符最小长度校验，拒绝开发默认值
- 修复 WebSocket Token 黑名单 Key 前缀不一致 (`token:blacklist:` → `jwt:blacklist:`)
- Agent 控制器添加用户所有权追踪和 `@AuthenticationPrincipal` 验证
- Agent Runtime 默认 CORS 从 `["*"]` 改为 `["http://localhost:8080"]`
- docker-compose 移除所有默认密码，使用 `:?` 语法强制要求环境变量

#### 🟠 高危漏洞修复
- 移除终端工具中的编译器/构建工具白名单 (`gcc`, `javac`, `mvn`, `cargo` 等)
- CoderAgent 移除终端代码执行验证逻辑
- Agent Runtime 新增 `InternalAuthMiddleware` 内部 API Key 认证
- 前端中间件移除开发模式认证绕过，添加安全响应头

#### 🟡 中危问题修复
- 新增 `RateLimitFilter` — 认证接口 10次/分钟，通用 API 100次/分钟
- WebSocket 订阅添加目标验证，仅允许 `/topic/project/` 和 `/user/` 前缀
- Auth Cookie 添加 `SameSite=Strict` 和 `Secure`（生产环境）
- `WorkflowController` / `SchedulerController` 添加 `@AuthenticationPrincipal`
- Actuator 和 Swagger 端点改为仅 `ADMIN` 角色可访问
- HNSW 路径构造函数修复 (`load_from_file()` + 元数据持久化)
- 所有 API Gateway 到 Agent Runtime 的请求添加内部认证头
- `.env.example` 添加安全密钥生成指导和安全警告

### v0.1.2 - 2026-06-14

#### 重大变更: 移除 Mock 模式
- 删除 `mock-data.ts` (1300+ 行硬编码数据)
- `API_MODE` 从 `'mock' | 'api'` 改为固定 `'api'`
- 所有 Store 移除 mock 分支逻辑
- 登录页移除 Demo Mode 按钮

#### Critical 修复
- Agent/Workflow 列表页增删改操作改为调用后端 API
- Code 页面添加 useEffect 自动加载文件树和文件内容
- Docs 页面添加项目选择和文档加载功能
- 修复 `user.id` 始终为空字符串 (改为使用 username 作为临时 ID)
- 移除 Agent/Workflow 创建时硬编码的 `projectId: 'proj-1'`

[完整 v0.1.2 变更日志见 README.md]
