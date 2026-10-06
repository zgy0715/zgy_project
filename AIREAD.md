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
- `GET /auth/profile` — 读取当前用户资料
- `PUT /auth/profile` — 更新用户资料 (username / email / avatarUrl)
- `POST /auth/change-password` — 修改密码 (校验旧密码，成功后清除 refresh token)

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
> 所有权来自 `agent_ownership` 表（持久化）；非所有者一律得到 404，避免存在性探测。

- `GET /agents` — Agent 列表 (仅返回当前用户可见的 Agent)
- `GET /agents/{id}` — Agent 详情 (需所有权验证)
- `POST /agents` — 创建 Agent (写入 `agent_ownership`)
- `PUT /agents/{id}` — 更新 Agent (名称/描述/类型/config)
- `GET /agents/{id}/config` — 读取 Agent 配置
- `PUT /agents/{id}/config` — 覆盖 Agent 配置
- `DELETE /agents/{id}` — 删除 Agent (需所有权验证，同时删除所有权行)
- `POST /agents/{id}/execute` — 非流式执行 (最长阻塞 10 分钟)
- `POST /agents/{id}/chat` — 非流式对话
- `POST /agents/{id}/chat/stream` — SSE 流式对话
- `GET /agents/{id}/thinking-chain` — 思维链
- `GET /agents/{id}/messages` — 消息历史
- `GET /agents/{id}/review-findings` — 代码审查结果

### 工作流 (/api/v1/workflows)
> 所有权来自 `workflow_ownership` 表；`PUT` / `execute` 均校验所有者。

- `GET /workflows` — 工作流列表 (?projectId=)
- `GET /workflows/templates` — 内置工作流模板
- `GET /workflows/{id}` — 工作流详情
- `POST /workflows` — 创建工作流
- `PUT /workflows/{id}` — 保存/更新工作流
- `DELETE /workflows/{id}` — 删除工作流
- `POST /workflows/{id}/execute` — 执行工作流

### 任务 (/api/v1/tasks)
- `POST /tasks` — 创建任务 (记录 `owner_id`)
- `GET /tasks/{taskId}` — 任务详情 (需所有权验证)
- `PUT /tasks/{taskId}` — 更新任务
- `DELETE /tasks/{taskId}` — 删除任务
- `GET /tasks/project/{projectId}` — 项目下任务列表 (需项目所有权)
- `POST /tasks/project/{projectId}/execute` — 执行 DAG (需项目所有权)

---

## 安全架构

### 认证与授权
- **JWT HMAC-SHA256**: 强制 32 字符最小密钥长度，拒绝开发默认值
- **Token 黑名单**: Redis 统一前缀 `jwt:blacklist:`，覆盖 HTTP + WebSocket
- **Agent / Workflow 所有权**: 持久化到 `agent_ownership` / `workflow_ownership` 表（V2 迁移），
  所有读写路径使用 `findByIdAndOwnerId` / `existsByIdAndOwnerId` 严格校验，非所有者返回 404
- **任务所有权**: `tasks.owner_id`（V2 迁移，含历史数据回填），`GET/PUT/DELETE /tasks/*` 与
  DAG 执行均按所有者过滤
- **内部 API 密钥**: Agent Runtime 要求 `X-DeepAgent-Internal-Key` 请求头（兼容 `X-Internal-Api-Key`），
  使用 `hmac.compare_digest` 常量时间比较；密钥未配置时**拒绝请求**并给出清晰启动错误
- **错误语义**: 未认证返回 JSON 401 (`UNAUTHORIZED`)，越权返回 JSON 403 (`ACCESS_DENIED`)，
  不再返回空 body 的 403

### 速率限制 (Rate Limiting)
- 认证接口: 10 次/分钟/IP
- 通用 API: 100 次/分钟/用户
- 支持 Redis（多实例）和内存回退（单实例）

### WebSocket 安全
- STOMP CONNECT: JWT 认证 + 黑名单检查
- STOMP SUBSCRIBE: `/user/**` 仅允许自己的会话目标；`/topic/project/{id}` 需通过
  `existsByIdAndOwnerId` 校验项目所有权，否则抛出 `MessageDeliveryException`
- 未被允许的目的地一律拒绝，不再"仅校验登录状态"
- 事件信封: `{eventType, projectId, taskId, agentType, data, timestamp}`，
  `eventType ∈ TASK_STARTED|AGENT_OUTPUT|TASK_COMPLETED|TASK_FAILED|AGENT_THINKING|REVIEW_FINDING|TEST_RESULT`

### Agent 工具安全
- **TerminalTool**: 默认关闭 (`SECURITY_ALLOW_SHELL=false`)，开启后使用
  `asyncio.create_subprocess_exec`（不经 shell，元字符注入无效）+ 命令白名单 + 危险模式匹配 + 工作目录校验
- **FileOps / GitOps**: 路径白名单 `allowed_directories`，组件级包含性判断 (`Path.is_relative_to`)，
  文件大小限制，写入失败即拒绝
- **Documents**: 仅允许白名单目录下的 `.md`，同样使用组件级包含性判断
- **WebSearch**: URL 白名单与重定向校验，阻止 SSRF 到元数据地址

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
- 错误处理: `getErrorMessage(error)` (统一从 `ApiResponse`/异常中提取消息，禁止 `as any`)
- 所有 Controller 端点需添加 `@AuthenticationPrincipal UserDetails` 参数

### 环境变量
- `NEXT_PUBLIC_API_URL` — 后端 API 地址，**必须包含 `/api/v1` 后缀** (默认 http://localhost:8080/api/v1)
- `NEXT_PUBLIC_WS_URL` — SockJS 地址，**必须使用 `http://` 而非 `ws://`** (默认 http://localhost:8080/ws)
- 两者都是 Next.js **构建期内联**变量：修改后必须重新 `next build`，以运行时 `environment:` 传入无效
- 不再使用 `NEXT_PUBLIC_API_MODE` (已移除 mock 模式)

---

## 已知限制与 TODO

> 本节原先列出的 7 条（`PUT /auth/profile`、`POST /auth/change-password`、`PUT /agents/{id}`、
> Agent 所有权内存 Map、模拟 Diff 基线、项目状态英文原值、通知 icon 未映射）已在 v0.2.2 全部实现，
> 详见下方变更日志。以下为**当前仍然存在**的限制。

### 未在本机验证（环境缺依赖）
- **agent-runtime 已实跑**：`pytest tests --ignore=tests/test_performance.py` →
  **202 passed / 1 skipped**（约 35s）。`tests/test_performance.py` 的断言是墙钟阈值，在共享 CI 上
  天然不稳定，故默认排除（需单独 `pytest tests/test_performance.py`）。
- **api-gateway 未编译验证**：本机无 JDK 21 / Maven，Java 侧改动仅经静态审查（符号解析、方法签名、
  导入、Flyway 迁移与实体的列级一致性）。**必须在有 Maven 的环境执行 `mvn verify` 才算确认。**
- **vector-engine 未编译验证**：本机无 CMake / C++ 编译器，CMake 配置与 pybind11 绑定仅经静态审查。
- **frontend**：`tsc`（编译器 API，69 文件 0 诊断）、`jest`（2 套件 / 56 用例）、`next build` 均已实跑。

### 后端
- `orchestrator/grpc/AgentServiceGrpcClient` 仍为骨架实现，非流式路径不会真正发起 gRPC 调用。
  要落地必须把 `agent_service.proto` 移到 `src/main/proto/` 并配置 protobuf/grpc Maven 插件
  （当前 proto 位于 `src/main/resources/proto/`，`target/` 无 `generated-sources`）。
- `agent-runtime.internal-api-key` 默认空值仅打 WARN，生产必须显式配置。
- RabbitMQ 无 DLX/DLQ 与 publisher-confirms；STOMP 使用内存 simple broker，多实例部署下 topic 不共享。
- `JwtAuthenticationFilter` 的 token 黑名单检查在 Redis 不可用时**故意失败开放**（记录 WARN）：
  Redis 故障期间已登出的令牌仍可能被接受，这是可用性优先于吊销能力的取舍。
- `GET /api/v1/orchestrator/health` 对任意已认证用户开放（仅返回布尔值）。

### Agent Runtime
- **工作流数据仅存于进程内存**（`app/api/routes/workflows.py` 的 `_workflows` 字典），重启即全部丢失，
  多副本之间也不共享；持久化尚未实现。
- `app/tools/web_search.py` 未接入真实搜索 API：直接抓取 DuckDuckGo 返回的 HTML 且不解析结果结构，
  检索质量有限（代码内保留 TODO）。
- `app/services/event_service.py` 仍是**原生 WebSocket** 实现，与前端使用的 STOMP 不兼容；前端只通过
  网关的 STOMP 接收事件，二者未打通。真实事件链路是「网关 → RabbitMQ → `SimpMessagingTemplate`」，
  该模块属于待移除的遗留实现。

### 前端
- **浅色 / 跟随系统主题目前是空操作**：`frontend/tailwind.config.ts` 未声明 `darkMode`（Tailwind 默认
  取 `media`），`frontend/src/app/globals.css:6` 的 `:root` CSS 变量本身就是深色取值且没有 `.dark` 分支，
  另有 130 处硬编码深色类名（`text-white`、`bg-gray-900` 等）分布在 33 / 70 个文件中。设置页的
  「深色 / 浅色 / 跟随系统」因此实际只有「深色」生效（`frontend/src/app/dashboard/settings/page.tsx`）。
  真正支持浅色需要对这 33 个文件做一轮样式改造，本机无浏览器可验证，故列为已知限制。
- 工作流暂停/恢复仅改变界面状态，后端无对应端点，UI 已如实标注。
- 终端面板不支持真正的远程执行：网关侧不存在 `/app/project/{id}/terminal` 的 `@MessageMapping`，
  命令在本地执行，UI 已如实标注。

### 向量引擎
- 默认 `dummy` 后端是确定性哈希占位实现（非语义向量），生产应配置真实 embedding 后端；
  原生模块不可用时 `VectorService` 会静默退化为全零向量，`/health` 却报告 `vector_engine: healthy`。

---

## 变更日志

### v0.2.2 - 2026-10-06 — 维护与功能补全

本次维护的目标是让四个子系统**真正能构建、启动、运行**，并补全本文档中记录的缺失功能。

#### 🔴 构建 / 启动阻断修复
- **UTF-8 BOM 污染（总根因）**: 仓库 24 个文件带 BOM，其中 7 个叠加了 4 个 BOM、3 个叠加 2 个
  （说明历史上有一段脚本被反复执行）。`agent-runtime/app/tools/terminal.py` 的双 BOM 触发
  `SyntaxError: invalid non-printable character U+FEFF`，而 `app/tools/__init__.py` 会立即导入
  `TerminalTool`，因此**整个 agent-runtime 包无法 import，服务完全不可用**；javac 同样拒绝行首
  U+FEFF，YAML / docker-compose 解析也会失败。已全部清除并逐字节校验。
- **api-gateway**: 修复 4 处编译错误 —— `RateLimitFilter` 对 record 字段 `count` 赋值、
  `AgentEventPublisher` 引用不存在的 `webSocketHandler` 字段、`WebSocketAuthInterceptor` 中
  `MessageHeaders` → `Message<?>` 的不可转换强转、`AuthService` 接口缺少 `findByUsername`
  （实现类却标了 `@Override`）。补齐缺失的 `UserDetailsService` Bean（原先启动即
  `UnsatisfiedDependencyException`）；为 `JwtTokenProvider` 的三个 `@Value("")` 补上真实占位符
  （原先注入空串，两个 `long` 字段在创建 Bean 时转换失败）。修复测试源码无法编译
  （补 `mockwebserver` 依赖、`JwtTokenProvider` 三参构造、缺失的 `src/test/resources/application-test.yml`），
  否则 `Dockerfile` 里的 `mvn package -DskipTests` 依然会失败。
- **agent-runtime**: 修复 `app/agents/coder.py` 中 `context_section` 从未绑定
  （每次 coder 执行必然 `NameError`，`/agents/{id}/execute`、`/chat`、图节点全部失败）；
  修复 `documents.py` 中 `@router.get("/")` 声明在 `/{file_path:path}` 之后，导致列表端点永远不可达。
- **vector-engine**: 删除在 `FetchContent_MakeAvailable` **之前**创建 `hnswlib::hnswlib` ALIAS 的语句
  （CMake 配置阶段直接中止）；用真实存在的 `hnswlib::InnerProductSpace` + L2 归一化替换
  并不存在的 `CosineSpace`；统一 `HNSWIndex` 路径构造函数在头文件与实现中的签名；修正 pybind11
  绑定中 7 处不存在的符号（`api_url` / `pooling_strategy` / `detect_language` / `CodeToken.type` 等）、
  四个枚举 `export_values()` 造成的模块级同名冲突，以及 `OUTPUT_NAME _vector_engine` 与
  `PYBIND11_MODULE(vector_engine, m)` 不一致（`import vector_engine` 必然失败）；消除
  `include/deepagent/vector_engine.h` 重复定义 `SearchResult` / `HNSWIndex` 引发的 ODR 冲突。
- **frontend**: Next 14.2 下 5 个项目详情路由用 `use(params)` 读取普通对象参数，运行时抛
  "An unsupported type was passed to use()"，页面全部白屏；改为普通 `params`。修复 `next build`
  的 ESLint 阻断错误（`react/no-unescaped-entities`），此前前端 Docker 镜像无法构建。

#### 🟠 安全修复
- **越权 (IDOR)**: `GET /projects/{id}` 原先无所有者过滤；`SchedulerController` 与
  `OrchestratorController` 收到 `@AuthenticationPrincipal` 却从不使用，任意登录用户可读取他人任务、
  触发他人 DAG / Agent 执行。现全部改为 `findByIdAndOwnerId` 严格校验，非所有者得到 404。
- **所有权持久化**: 原先 `AgentController` 用进程内 `ConcurrentHashMap` 记录 owner，重启即丢失且
  `ownerId == null` 时**放行**（fail-open）。现拆分为 `agent_ownership` / `workflow_ownership` 表，
  并新增 `tasks.owner_id`、`project_files`、`project_activity`（V2 迁移，含历史数据回填）。
- **WebSocket 跨租户泄漏**: 原先任意已认证用户可订阅 `/topic/project/**`；现 `/topic/project/{id}`
  需通过 `existsByIdAndOwnerId`，`/user/**` 需为自己的会话目标，其余目的地一律拒绝。
- **命令注入**: `TerminalTool` 原先把整条命令字符串交给 `create_subprocess_shell`，而校验只覆盖
  第一个 `|;&` 之前片段的首个词，`ls; curl ...` 之类可直接绕过；现改为
  `create_subprocess_exec`（不经 shell），并默认关闭 socket 能力。
- **路径穿越**: `documents.py` 用 `startswith` 前缀判断，`/workspace-evil/x.md` 可通过；
  现统一为组件级 `Path.is_relative_to`，`git_ops` 也补上了缺失的沙箱校验。
- **内部认证 fail-open**: 内部 API Key 未配置时原先"允许所有请求"；现改为拒绝，并使用
  `hmac.compare_digest` 常量时间比较。
- **DAG 重试失效**: `DagScheduler` 的重试分支把失败任务重置为 `PENDING` 后直接返回，重试从未发生，
  失败被吞掉且 DAG 仍报成功；已重写为真实的有界重试循环，并把 `@Transactional` 自调用问题
  （注解失效 + 长事务跨越 10 分钟 Agent 调用）改为委托短期 `TaskService` 事务。
- **凭据泄漏**: `@Data` 生成的 `toString()` 会打印 BCrypt 密码哈希 / refresh token，已改为
  `@Getter/@Setter` + 按 id 的 `equals/hashCode`。
- **前端 Cookie 绕过**: `middleware.ts` 用 `pathname.includes('.')` 判断静态资源，任何带点的路径
  都能绕过登录跳转；已改为显式静态文件正则。

#### 🟡 功能补全（原"已知限制与 TODO"）
- 新增 `PUT /auth/profile`、`GET /auth/profile`、`POST /auth/change-password`（校验旧密码，
  成功后清除 refresh token）；Settings 页面改为真实调用这两个接口，不再本地假更新，
  密码最小长度与后端一致（8 位）。
- 新增 `PUT /agents/{id}`、`GET /agents/{id}/config`、`PUT /agents/{id}/config`，
  Agent 编辑不再是本地状态；agent-runtime 侧补齐对应的 PUT 路由。
- 新增 `GET /workflows/templates`、`PUT /workflows/{id}`；新增
  `GET|PUT /projects/{id}/files/{fileId}`、`GET /projects/{id}/activity?limit=`。
- **Diff 基线真实化**: Code 页面的"原始代码"改为取自网关保存的服务端内容
  （`editor-store` 的 server copy），删除按每 5 行删除一行伪造基线的 `generateOriginalCode()`。
- **项目状态中文化**: 后端保持 `@Enumerated(STRING)` 的 `ACTIVE|ARCHIVED|DELETED`，
  前端 `ProjectStatus` 改为同为大写并提供唯一的中文映射表（进行中 / 已归档 / 已删除）。
- **通知图标**: WS 通知改为按 `type` 映射图标与中文标题；前端订阅 `/user/queue/notifications`
  并把通知写入通知 store（此前后端无生产者、铃铛永远为空）。
- WebSocket 事件信封统一为 `{eventType, projectId, taskId, agentType, data, timestamp}` —— 原先
  `TASK_STARTED` / `AGENT_OUTPUT` 走的是不含 `eventType` 的 `AgentOutputMessage`，被前端
  `isAgentEvent()` 直接丢弃（流式输出收不到、"执行中"状态永不解除）；文本字段统一为 `data`。
- 补齐智能体/工作流列表页缺失的 `useEffect`（原先 `fetchAgents` / `fetchWorkflows` 从未被调用，
  页面永远空白）；`agentsApi.execute` 修正为 `POST /agents/{id}/execute`（原先漏了 `/execute`）；
  工作流执行不再把 `isExecuting` 永久锁定。

#### 🔵 工程 / 配置 / CI
- **`.env.example` 完全重写**（145 行）：修正 agent-runtime 使用 `DB_` / `REDIS_` / `LLM_` / `SECURITY_`
  前缀（原先文档里的 `DATABASE_URL` 等变量根本不会被读取），补齐全部 `SECURITY_*`，说明
  next 的 `NEXT_PUBLIC_*` 是构建期内联，并标注 `MINIO_*` 目前未被代码使用。
- **`Makefile`**: 移除会吞掉失败状态的 `|| true`；`setup` 原先在 `python -m venv` 之后用系统
  `python -m pip install`（装到全局而非 venv，venv 从未被激活），现改为显式使用 venv 解释器并安装
  `ruff`；`AGENT_PY` 自动探测 venv（Windows / POSIX 路径都支持）。
- **`.gitignore`**: 移除裸 `Makefile` 规则（git 会匹配任意层级的同名文件，导致根目录的 `Makefile`
  从未被跟踪），补充 `*.pyd`。
- **`ci.yml` 重写**: 原文件调用不存在的 `./mvnw`（仓库没有 Maven Wrapper）、传入无效的
  `-DBUILD_TESTS=ON`（真实选项是 `VECTOR_ENGINE_BUILD_TESTS`），且前端只跑 `lint` + `build`，
  **从不跑 type-check / test**（正是漏掉前端 P0 的原因）。现为 5 个 job，并对 pybind11 模块增加
  `import vector_engine; vector_engine.Engine` 硬性门禁。
- `docker-compose.yml` / `ci.yml` 的 `NEXT_PUBLIC_*` 构建参数修正为包含 `/api/v1` 后缀、
  `http://` 形式的 SockJS 地址。
- `scripts/run_e2e_tests.{ps1,sh}` 改为使用 venv 解释器，并把全部测试纳入（原先只跑两个文件，
  恰好绕过了覆盖 P0 的 `test_agents.py` / `test_tools.py`）。
- 更正 `memory/step3-4-vector-engine-and-agent-runtime.md` 中三处与事实不符的结论。

#### ⚠️ 验证范围说明
- 已实跑验证: 前端 `tsc`（编译器 API，69 文件 0 诊断）、`jest`（2 套件 / 56 用例通过）、`next build`；
  agent-runtime `pytest`（203 收集 → **202 passed / 1 skipped**，`tests/test_performance.py` 因依赖
  墙钟阈值而排除）。
- **未验证**: api-gateway（无 JDK/Maven）与 vector-engine（无 CMake/编译器）**未做编译验证**，
  两者的改动均只经过静态审查。首次在完整环境构建时请优先执行 `mvn verify` 与
  `cmake -S vector-engine -B vector-engine/build -DVECTOR_ENGINE_BUILD_TESTS=ON && cmake --build vector-engine/build`。

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
