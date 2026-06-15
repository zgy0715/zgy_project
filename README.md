<div align="center">

<img src="https://img.shields.io/badge/DeepAgent-v0.2.1-6366f1?style=for-the-badge&logo=robot&logoColor=white" alt="DeepAgent" />

# 🤖 DeepAgent

**基于大语言模型的多智能体协作开发平台**

*让 AI Agent 像真正的开发团队一样协作构建软件*

[![License](https://img.shields.io/badge/License-MIT-6366f1?style=flat-square)](LICENSE)
[![C++17](https://img.shields.io/badge/C++-17-00599C?style=flat-square&logo=c%2B%2B&logoColor=white)](https://isocpp.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Java](https://img.shields.io/badge/Java-21-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)

[🚀 快速开始](#-快速开始) · [🏗️ 系统架构](#️-系统架构) · [🤖 Agent 详解](#-agent-详解) · [📁 项目结构](#-项目结构) · [🤝 参与贡献](#-参与贡献)

</div>

---

## 💡 项目简介

DeepAgent 是一个由大语言模型驱动的多智能体协作开发平台。它编排 **Coder**、**Reviewer**、**Tester**、**Deployer** 四个专业化 AI Agent，让它们像真实的软件团队一样协同工作——只需用自然语言描述需求，Agent 团队就会自动完成从需求分析到代码交付的全流程。

<table>
<tr>
<td width="50%">

### 🔥 核心痛点

- 单一 Agent 难以应对复杂开发任务
- AI 决策过程不透明，无法干预
- AI 生成代码缺乏质量保障
- 固定流水线无法灵活定制
- 向量检索依赖黑盒第三方服务

</td>
<td width="50%">

### ✅ DeepAgent 方案

- **多 Agent 分工协作**，各司其职
- **思考链实时可视化**，随时介入修正
- **内置审查-测试闭环**，Agent 互相校验
- **可视化 DAG 工作流**，拖拽编排流程
- **自研 C++ 向量引擎**，高性能可掌控

</td>
</tr>
</table>

---

## ✨ 核心特性

| | 特性 | 说明 |
|---|------|------|
| 🧠 | **多 Agent 编排** | 基于 LangGraph 的 Agent 推理、规划与协作 |
| 🎨 | **可视化工作流编辑器** | 拖拽式 DAG 编排，自定义 Agent 执行流程 |
| 👁️ | **思考链透明化** | 实时查看每个 Agent 的推理过程 (Chain of Thought) |
| 🔍 | **语义代码搜索** | 自研 C++ HNSW 向量引擎，毫秒级代码检索 |
| 🧪 | **自动测试生成** | Tester Agent 自动生成并执行单元/集成测试 |
| 🔄 | **代码审查闭环** | Reviewer Agent 检测 Bug / 安全漏洞 / 代码风格 |
| 📦 | **部署配置生成** | 自动生成 Dockerfile 与 CI/CD 配置 |
| 🧠 | **持久化记忆** | Agent 具备项目级长期记忆，越用越懂你的项目 |
| 🌐 | **四语言技术栈** | C++ / Python / Java / TypeScript 各展所长 |
| 🔒 | **全栈安全加固** | JWT 强密钥校验、速率限制、内部服务认证、WebSocket 授权 |

---

## 🏗️ 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                      前端 (Next.js 14)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  工作流编辑器  │  │  Agent 对话   │  │  Monaco 代码编辑器  │  │
│  │  (ReactFlow)  │  │  (CoT 可视化) │  │  (代码预览/Diff)   │  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │ WebSocket / REST API
┌───────────────────────────┴──────────────────────────────────┐
│              API 网关 (Java 21 — Spring Boot 3)               │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │  认证鉴权   │  │  DAG 调度器  │  │  Agent 编排引擎        │  │
│  │ (JWT+RBAC) │  │ (Kahn+VT)  │  │  (gRPC → Python)      │  │
│  │ +限流过滤器 │  │            │  │  +内部服务认证          │  │
│  └────────────┘  └────────────┘  └────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │ gRPC / RabbitMQ
┌───────────────────────────┴──────────────────────────────────┐
│              Agent 运行时 (Python 3.11 — FastAPI)              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │  Coder     │  │  Reviewer  │  │  向量引擎客户端         │  │
│  │  Agent     │  │  Agent     │  │  (HTTP/pybind11)       │  │
│  └────────────┘  └────────────┘  └────────────────────────┘  │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │  Tester    │  │  Deployer  │  │  Agent 记忆系统         │  │
│  │  Agent     │  │  Agent     │  │  (短期+长期记忆)        │  │
│  └────────────┘  └────────────┘  └────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │ pybind11
┌───────────────────────────┴──────────────────────────────────┐
│              向量引擎 (C++17 — HNSW)                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │  HNSW 索引  │  │  距离计算   │  │  Code Embedder        │  │
│  │  (hnswlib)  │  │  (SIMD)    │  │  (ONNX/API)           │  │
│  └────────────┘  └────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔒 安全架构

DeepAgent 采用纵深防御策略，在每一层都实施了安全措施：

### 认证与授权
- **JWT HMAC-SHA256**: 强制 32 字符最小密钥长度
- **Token 黑名单**: Redis 统一前缀，覆盖 HTTP + WebSocket
- **Agent 所有权**: API Gateway 层维护 agentId→userId 映射
- **内部 API 密钥**: Agent Runtime 要求 X-DeepAgent-Internal-Key
- **RBAC**: 用户角色 (USER/ADMIN/VIEWER)，Actuator 端点仅 ADMIN

### 速率限制
- 认证接口: 10 次/分钟/IP — 防暴力破解
- 通用 API: 100 次/分钟/用户 — 防 DoS
- 支持 Redis 多实例和内存回退

### WebSocket 安全
- STOMP CONNECT: JWT 认证 + 黑名单检查
- STOMP SUBSCRIBE: 仅允许 `/topic/project/` 和 `/user/` 前缀

### Agent 工具安全
- TerminalTool: 四层防御 — 语法过滤 → 白名单 → 黑名单 → 路径检查
- FileOps: 路径白名单，10MB 限制，关闭失败
- CoderAgent: 仅通过 LLM 审核，移除终端执行

---

## 🚀 快速开始

### 前置要求

- Docker & Docker Compose
- Node.js 18+ (本地开发)
- Java 21 (本地开发)
- Python 3.11+ (本地开发)
- C++17 编译器 (向量引擎)

### 一键部署 (Docker)

```bash
# 1. 克隆仓库
git clone https://github.com/zgy0715/zgy_project.git
cd zgy_project

# 2. ⚠️ 配置环境变量 (必须!)
#     复制 .env.example 为 .env，填入所有必填项
cp .env.example .env
#     编辑 .env，设置以下关键密钥:
#     - JWT_SECRET: 至少32字符随机字符串
#     - INTERNAL_API_KEY: 64字符十六进制随机字符串
#     - OPENAI_API_KEY: 有效的 OpenAI API Key

# 3. 启动所有服务
docker-compose up -d

# 4. 访问 http://localhost:3000
```

### 本地开发

```bash
# 1. 复制并配置环境变量
cp .env.example .env
# 编辑 .env 填入 JWT_SECRET (≥32字符), INTERNAL_API_KEY, OPENAI_API_KEY

# 2. 启动数据库依赖 (Docker)
docker-compose up -d postgres redis rabbitmq

# 3. 启动 API Gateway (Java)
cd api-gateway
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# 4. 启动 Agent Runtime (Python)
cd agent-runtime
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 5. 启动前端 (Node.js)
cd frontend
npm install
npm run dev
# 访问 http://localhost:3000
```

---

## 🤖 Agent 详解

### Coder Agent — 代码生成

Coder Agent 负责根据任务描述生成生产级代码。它支持多文件生成、增量修改，并可利用语义搜索理解现有代码库。

- **默认工具**: 文件读写、代码搜索
- **生命周期**: 分析需求 → 制定计划 → 生成代码 → 自我审查
- **安全限制**: 不允许直接执行生成的代码，通过 LLM 审核质量

### Reviewer Agent — 代码审查

Reviewer Agent 对 Coder 生成的代码进行全面审查，检测 Bug、安全漏洞和风格问题。

### Tester Agent — 测试生成

Tester Agent 为代码自动生成单元测试和集成测试。

### Deployer Agent — 部署配置

Deployer Agent 分析代码并生成 Dockerfile 和 CI/CD 配置。

---

## 📁 项目结构

```
zgy_project/
├── frontend/                    # Next.js 14 前端
│   ├── src/
│   │   ├── app/                 # App Router 页面
│   │   ├── components/          # React 组件
│   │   │   ├── agents/          # Agent 对话/状态组件
│   │   │   ├── code/            # Monaco 编辑器/文件树
│   │   │   ├── dashboard/       # 仪表板组件
│   │   │   ├── layout/          # 布局组件
│   │   │   ├── ui/              # 通用 UI 组件
│   │   │   └── workflow/        # ReactFlow 工作流组件
│   │   ├── lib/                 # 工具库/API 客户端
│   │   │   ├── hooks/           # 自定义 Hooks
│   │   │   └── __tests__/       # API 契约测试
│   │   ├── stores/              # Zustand 状态管理
│   │   └── types/               # TypeScript 类型定义
│   └── package.json
├── api-gateway/                 # Java 21 Spring Boot 3
│   ├── src/main/java/com/deepagent/
│   │   ├── auth/                # 认证 (JWT, 登录/注册)
│   │   ├── common/              # 通用 (异常处理, 限流过滤)
│   │   ├── config/              # 配置 (CORS, Redis, WebSocket)
│   │   ├── orchestrator/        # Agent/Workflow 编排
│   │   ├── project/             # 项目管理
│   │   ├── scheduler/           # DAG 调度器
│   │   └── websocket/           # WebSocket 推送
│   └── src/main/resources/      # 应用配置
├── agent-runtime/               # Python 3.11 FastAPI
│   ├── app/
│   │   ├── agents/              # Agent 实现
│   │   ├── api/                 # API 路由 + 中间件
│   │   ├── graph/               # LangGraph 工作流
│   │   ├── memory/              # Agent 记忆系统
│   │   ├── models/              # 数据模型
│   │   ├── services/            # 服务 (LLM, 事件, 向量)
│   │   ├── tools/               # Agent 工具
│   │   └── utils/               # 工具函数
│   └── tests/                   # 测试
├── vector-engine/               # C++17 HNSW
│   ├── bindings/                # pybind11 绑定
│   ├── include/                 # 公共头文件
│   ├── src/                     # 核心实现
│   │   ├── hnsw/                # HNSW 索引
│   │   ├── embedding/           # 文本嵌入
│   │   ├── storage/             # 存储管理
│   │   └── utils/               # 工具 (线程池, 距离计算)
│   └── tests/                   # 测试
├── scripts/                     # E2E 测试/性能测试
├── .env.example                 # 环境变量模板
├── docker-compose.yml           # 部署编排
└── README.md
```

---

## 🏗️ 开发路线图

### v0.1.x — 功能验证阶段 ✅
- [x] 基础项目结构和模块划分
- [x] 前端页面框架和路由
- [x] Agent 对话和 SSE 流式响应
- [x] 可视化工作流编辑器 (DAG)
- [x] 代码编辑器 (Monaco)
- [x] WebSocket 实时通信
- [x] 终端模拟器 (xterm.js)
- [x] 语言服务 (TypeScript/Python/Java)
- [x] 用户系统 (注册/登录/JWT)
- [x] 项目管理 CRUD
- [x] Semantic code search
- [x] 端到端集成联调
- [x] 性能优化与基准测试
- [x] 全面系统检查与修复
- [x] 移除 Mock 模式

### v0.2.x — 安全加固阶段 ✅
- [x] JWT 密钥强度最小长度校验
- [x] Token 黑名单 Key 一致性修复
- [x] Agent 所有权验证 (IDOR 防护)
- [x] Agent Runtime CORS 限制
- [x] 终端工具白名单精简
- [x] 内部 API 密钥认证
- [x] 速率限制 (Rate Limiting)
- [x] WebSocket 订阅授权
- [x] HTTP 安全响应头
- [x] Cookie 安全标记
- [x] Actuator 端点保护
- [x] 所有 Controller 认证标注
- [x] HNSW 构造函数修复
- [ ] 演示视频与文档

---

## 🌟 项目亮点

> 为什么 DeepAgent 能在同类项目中脱颖而出？

<table>
<tr>
<td width="50%">

### 🔗 多语言深度融合

不是简单拼凑——C++ 引擎通过 **pybind11** 被 Python Agent 直接调用，Java 通过 **gRPC** 调度 Python 服务，形成真正的跨语言协作链路

</td>
<td width="50%">

### 🎨 可视化 Agent 工作流

拖拽式 DAG 编排，用户自定义 Agent 协作流程，而非固定 pipeline——这是大多数同类项目没有的

</td>
</tr>
<tr>
<td width="50%">

### 👁️ 思考过程透明化

实时展示每个 Agent 的推理链 (Chain of Thought)，用户可随时介入修正方向

</td>
<td width="50%">

### ⚡ 自研向量引擎

不直接用现成向量数据库，而是 **C++ 手写 HNSW 索引 + pybind11 绑定**，展示底层工程能力

</td>
</tr>
<tr>
<td width="50%">

### 🧠 记忆与学习能力

Agent 具备项目级长期记忆，随着使用积累越来越了解项目上下文

</td>
<td width="50%">

### 🏗️ 完整工程化实践

Docker 容器化 · GitHub Actions CI/CD · 单元测试 · Flyway 迁移——不是 Demo，是可部署的产品级项目，经过全栈安全审计加固

</td>
</tr>
</table>

---

## 🤝 参与贡献

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 发起 Pull Request

---

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源。

---

## 📋 变更日志

### v0.2.1 - 2026-06-15 — 安全审计修复

详见 [AIREAD.md](./AIREAD.md#v021---2026-06-15--安全审计修复) 完整变更日志。

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
- 所有 Controller 添加 `@AuthenticationPrincipal` 认证标注
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
- Agent/Workflow 列表页增删改操作改为调用后端 API (原仅修改本地 state)
- Code 页面添加 useEffect 自动加载文件树和文件内容
- Docs 页面添加项目选择和文档加载功能
- 修复 `user.id` 始终为空字符串 (改为使用 username 作为临时 ID)
- 移除 Agent/Workflow 创建时硬编码的 `projectId: 'proj-1'`

#### High 修复
- API 客户端 `agentsApi.list()` 和 `workflowsApi.list()` 新增 `projectId` 参数支持
- Dashboard 移除硬编码统计数据 (change/testPassRate/codeLines 估算值)
- Settings 主题切换修复 system 模式 (检测系统偏好)
- Settings 修改密码标记为"开发中" (后端 API 未实现)
- Token refresh 后同步 Zustand store 中的 token
- Workflow 页面移除硬编码 `workflowId="default"`
- 项目详情页 workflows 按 projectId 过滤
- Middleware 添加 `/auth/forgot-password` 到公开路径

#### 代码清理
- 移除 terminal.tsx 中的 API_MODE 条件判断和 simulateCommand
- 移除 code-editor.tsx 中的 mock 注释
- Terminal 本地命令精简为 help/clear/echo/date/whoami

### v0.1.1 - 2026-06-13

#### 安全修复
- 修复SSE流式端点异常信息可能泄露API Key的问题
- Logout时同时黑名单Refresh Token
- Docker Compose JWT Secret不再使用硬编码占位符
- Docker Compose API Key环境变量名与config.py对齐
- LLM Service添加API Key非空验证

#### 功能修复
- 统一SSE流式事件格式（前后端双格式兼容）
- 修复WebSocket消息格式（AgentEventPublisher发送完整AgentEvent对象）
- 添加GET /auth/me端点
- 修复中间件重定向路径（/login → /auth/login）
- 添加React Error Boundary防止白屏崩溃
- Pydantic Response模型添加camelCase别名
- Agent ID改用UUID
- BaseTool.__call__添加异常捕获
- 健康检查实际验证LLM配置
- Ollama Provider超时使用配置值

#### UI/UX优化
- 所有列表页添加空状态提示
- 登录/注册页左侧面板文案中文化
- Dashboard子页面标题统一为中文
- 首页"查看演示"按钮优化（mock模式直接登录）
- Sidebar折叠时显示退出图标
- 版权年份动态化
- Projects页改用store数据源
- Settings页Save Profile添加事件处理

#### 代码质量
- 添加GlobalExceptionHandler缺失的异常处理器（405/415/数据库异常）
- LLMServiceError状态码从400改为502
- useAgent/useWorkflow hooks统一使用store方法
- Workflow Store模块级状态移入store内部
- Agent Runtime添加日志配置初始化
- 添加openai依赖声明到requirements.txt

---

<div align="center">

**用 ❤️ 构建 · 相信 AI Agent 应该像团队一样协作，而非孤军奋战**

</div>
