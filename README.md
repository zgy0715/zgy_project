<div align="center">

<img src="https://img.shields.io/badge/DeepAgent-v0.1.0-6366f1?style=for-the-badge&logo=robot&logoColor=white" alt="DeepAgent" />

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
│                API 网关 (Java 21 — Spring Boot 3)              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │  认证鉴权   │  │  DAG 调度器  │  │  Agent 编排引擎        │  │
│  │  (JWT+RBAC) │  │ (Kahn+VT)  │  │  (gRPC → Python)      │  │
│  └────────────┘  └────────────┘  └────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │ gRPC / RabbitMQ
┌───────────────────────────┴──────────────────────────────────┐
│              Agent 运行时 (Python 3.11 — FastAPI)              │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐   │
│  │  Coder   │  │ Reviewer │  │  Tester  │  │  Deployer  │   │
│  │  Agent   │  │  Agent   │  │  Agent   │  │   Agent    │   │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  LangGraph 编排 · 记忆系统 · 工具框架 · Prompt 管理     │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────┬──────────────────────────────────┘
                            │ pybind11
┌───────────────────────────┴──────────────────────────────────┐
│            向量引擎 (C++17 — HNSW Index)                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  HNSW 索引      │  │  代码嵌入       │  │  增量更新       │  │
│  │  (近似最近邻)    │  │  (多策略分词)    │  │  (实时索引)     │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧩 技术栈

<table>
<tr>
<th>层级</th>
<th>语言</th>
<th>框架 / 库</th>
<th>职责</th>
</tr>
<tr>
<td>🎨 前端</td>
<td>TypeScript</td>
<td>Next.js 14 · TailwindCSS · Zustand · ReactFlow · Monaco Editor</td>
<td>UI 交互 · 工作流编辑 · 代码预览</td>
</tr>
<tr>
<td>🟠 API 网关</td>
<td>Java 21</td>
<td>Spring Boot 3 · Spring Security · gRPC · WebSocket · RabbitMQ</td>
<td>认证鉴权 · DAG 调度 · Agent 编排</td>
</tr>
<tr>
<td>🟢 Agent 运行时</td>
<td>Python 3.11</td>
<td>FastAPI · LangGraph · LangChain · Pydantic v2</td>
<td>Agent 逻辑 · LLM 编排 · 工具调用</td>
</tr>
<tr>
<td>🔵 向量引擎</td>
<td>C++17</td>
<td>HNSWlib · pybind11 · Google Test</td>
<td>语义代码搜索 · 向量索引</td>
</tr>
<tr>
<td>⚙️ 基础设施</td>
<td>—</td>
<td>Docker · PostgreSQL · Redis · MinIO · RabbitMQ</td>
<td>容器化部署 · 数据持久化</td>
</tr>
</table>

---

## 🚀 快速开始

### 环境要求

| 依赖 | 版本 |
|------|------|
| Docker & Docker Compose | 最新版 |
| Python | 3.11+ |
| Java | 21+ |
| Node.js | 20+ |
| CMake | 3.20+ |
| C++ 编译器 | 支持 C++17 |

### 一键启动（Docker Compose）

```bash
git clone https://github.com/your-username/deepagent.git
cd deepagent

# 复制环境变量
cp .env.example .env

# 启动全部服务
docker compose up -d
```

### 本地开发模式

<details>
<summary>📦 1. 构建向量引擎 (C++)</summary>

```bash
cd vector-engine
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . -j$(nproc)

# 运行测试
ctest --output-on-failure
```

</details>

<details>
<summary>🐍 2. 启动 Agent 运行时 (Python)</summary>

```bash
cd agent-runtime
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

</details>

<details>
<summary>☕ 3. 启动 API 网关 (Java)</summary>

```bash
cd api-gateway
./mvnw spring-boot:run
```

</details>

<details>
<summary>⚛️ 4. 启动前端 (Next.js)</summary>

```bash
cd frontend
npm install
npm run dev
```

</details>

访问 `http://localhost:3000` 开始使用！

---

## 🤖 Agent 详解

<table>
<tr>
<th width="100">Agent</th>
<th>职责</th>
<th>核心能力</th>
</tr>
<tr>
<td><strong>🧑‍💻 Coder</strong></td>
<td>代码生成</td>
<td>接收自然语言需求，生成生产级代码；支持多语言；遵循项目级编码规范（长期记忆）</td>
</tr>
<tr>
<td><strong>🔍 Reviewer</strong></td>
<td>代码审查</td>
<td>自动检测 Bug、安全漏洞、性能问题、代码风格违规；输出结构化反馈供 Coder 修正</td>
</tr>
<tr>
<td><strong>🧪 Tester</strong></td>
<td>测试生成</td>
<td>基于 Coder 产出生成单元测试与集成测试；自动执行测试并报告覆盖率</td>
</tr>
<tr>
<td><strong>🚀 Deployer</strong></td>
<td>部署配置</td>
<td>根据项目技术栈自动生成 Dockerfile、CI/CD 流水线配置、部署脚本</td>
</tr>
</table>

### Agent 协作流程

```
用户需求 ──→ Coder Agent ──→ Reviewer Agent ──→ Tester Agent ──→ Deployer Agent
               │                  │                  │                 │
               │    不通过 ←───────┘                  │                 │
               │    (返回修改)                         │   测试失败 ←────┘
               │                                      │   (返回修复)     
               ▼                                      ▼                 
           代码生成                               测试通过 ──→ 部署配置
```

---

## 📁 项目结构

<details>
<summary>🔵 向量引擎 — <code>vector-engine/</code> (26 文件)</summary>

```
vector-engine/
├── CMakeLists.txt              # 顶层 CMake (hnswlib/pybind11/Google Test)
├── cmake/FindHnswlib.cmake     # CMake 查找模块
├── third_party/CMakeLists.txt  # FetchContent 依赖管理
├── include/deepagent/
│   └── vector_engine.h         # 对外统一头文件
├── src/
│   ├── hnsw/                   # HNSW 近似最近邻索引
│   │   ├── index_config.h      #   索引配置 (M/ef_construction/ef_search/metric)
│   │   ├── hnsw_index.h        #   HNSWIndex 类 (Pimpl 模式)
│   │   └── hnsw_index.cpp      #   build/search/insert/save/load 实现
│   ├── embedding/              # 代码嵌入生成
│   │   ├── tokenizer.h/cpp     #   代码分词器 (ByFunction/ByClass/ByBlock/ByLine)
│   │   ├── code_embedder.h     #   CodeEmbedder 类 (Pimpl 模式)
│   │   └── code_embedder.cpp   #   Dummy/API/ONNX 后端
│   ├── storage/                # 向量持久化存储
│   │   ├── vector_store.h/cpp  #   VectorStore (CRUD + search + 持久化)
│   │   └── metadata_manager.h/cpp  # 元数据管理 (id→JSON 映射)
│   └── utils/                  # 工具库
│       ├── distance.h/cpp      #   距离计算 (Cosine/Euclidean/InnerProduct)
│       ├── logger.h/cpp        #   线程安全日志系统
│       └── thread_pool.h/cpp   #   线程池 (并行搜索)
├── bindings/
│   ├── pybind_module.cpp       # pybind11 绑定 (暴露给 Python Agent)
│   └── CMakeLists.txt
└── tests/                      # Google Test 单元测试
    ├── test_hnsw.cpp           #   HNSW 索引测试 (9 用例)
    ├── test_embedder.cpp       #   嵌入器测试 (7 用例)
    └── test_distance.cpp       #   距离计算测试 (14 用例)
```

</details>

<details>
<summary>🟢 Agent 运行时 — <code>agent-runtime/</code> (58 文件)</summary>

```
agent-runtime/
├── app/
│   ├── main.py                 # FastAPI 入口 (路由/中间件/生命周期)
│   ├── config.py               # Pydantic BaseSettings 配置
│   ├── models/
│   │   ├── schemas.py          #   Pydantic v2 数据模型
│   │   └── enums.py            #   枚举 (AgentType/TaskStatus/MessageRole)
│   ├── agents/                 # 🤖 四大专业 Agent
│   │   ├── base.py             #   Agent 基类 (init→plan→execute→reflect→respond)
│   │   ├── coder.py            #   Coder Agent (代码生成)
│   │   ├── reviewer.py         #   Reviewer Agent (代码审查)
│   │   ├── tester.py           #   Tester Agent (测试生成)
│   │   ├── deployer.py         #   Deployer Agent (部署配置)
│   │   └── registry.py         #   Agent 注册表
│   ├── graph/                  # 🔗 LangGraph 工作流编排
│   │   ├── workflow.py         #   StateGraph 定义 (Agent 间 DAG)
│   │   ├── nodes.py            #   图节点 (每个 Agent 一个节点)
│   │   ├── edges.py            #   条件边 (根据输出决定路由)
│   │   └── state.py            #   共享状态 (TypedDict)
│   ├── memory/                 # 🧠 记忆系统
│   │   ├── base.py             #   记忆基类
│   │   ├── short_term.py       #   短期记忆 (滑动窗口)
│   │   ├── long_term.py        #   长期记忆 (向量存储)
│   │   └── summarizer.py       #   记忆摘要压缩器
│   ├── tools/                  # 🔧 Agent 工具框架
│   │   ├── base.py             #   BaseTool (ABC)
│   │   ├── file_ops.py         #   文件读写
│   │   ├── terminal.py         #   终端命令执行
│   │   ├── git_ops.py          #   Git 操作
│   │   ├── code_search.py      #   代码语义搜索 (调用 C++ 引擎)
│   │   └── web_search.py       #   网络搜索
│   ├── services/               # 业务服务
│   │   ├── llm_service.py      #   LLM 调用 (OpenAI/Ollama 双 Provider)
│   │   ├── vector_service.py   #   向量引擎服务 (pybind11/HTTP)
│   │   ├── project_service.py  #   项目管理
│   │   └── event_service.py    #   WebSocket 事件推送
│   ├── api/
│   │   ├── routes/             #   API 端点 (agents/workflows/search/health)
│   │   └── middleware/         #   请求日志 + 全局异常处理
│   └── utils/
│       ├── prompt_templates.py #   Prompt 模板管理
│       ├── code_parser.py      #   AST 代码解析
│       └── token_counter.py    #   Token 计数 (tiktoken)
├── tests/                      # pytest 测试
├── requirements.txt
├── pyproject.toml              # black/isort/mypy/pytest/ruff 配置
└── Dockerfile
```

</details>

<details>
<summary>🟠 API 网关 — <code>api-gateway/</code> (53 文件)</summary>

```
api-gateway/
├── pom.xml                     # Maven (Spring Boot 3.2/gRPC/Redis/RabbitMQ)
├── src/main/java/com/deepagent/
│   ├── DeepAgentApplication.java  # 启动类
│   ├── config/                 # 配置类
│   │   ├── SecurityConfig.java #   Spring Security + JWT
│   │   ├── WebSocketConfig.java#   STOMP WebSocket
│   │   ├── GrpcConfig.java     #   gRPC 客户端
│   │   ├── RedisConfig.java    #   Redis 序列化
│   │   ├── RabbitMQConfig.java #   交换机/队列定义
│   │   └── CorsConfig.java     #   CORS 跨域
│   ├── auth/                   # 🔐 认证模块 (JWT 双令牌 + Redis 黑名单)
│   ├── project/                # 📁 项目管理 (CRUD)
│   ├── scheduler/              # ⏱ DAG 任务调度 (Kahn 拓扑排序 + Virtual Threads 并行)
│   ├── orchestrator/           # 🎼 Agent 编排 (gRPC 调用 Python)
│   ├── websocket/              # 📡 实时推送 (STOMP)
│   └── common/                 # 通用组件 (异常处理/统一响应/参数校验)
├── src/main/resources/
│   ├── application.yml         # 主配置
│   ├── application-dev.yml     # 开发环境
│   ├── application-prod.yml    # 生产环境
│   ├── db/migration/V1__init_schema.sql  # Flyway 数据库迁移
│   └── proto/agent_service.proto          # gRPC Protobuf 定义
└── src/test/                   # JUnit 5 测试
```

</details>

<details>
<summary>⚛️ 前端 — <code>frontend/</code> (63 文件)</summary>

```
frontend/
├── src/
│   ├── app/                    # 📄 App Router 页面
│   │   ├── layout.tsx          #   根布局
│   │   ├── page.tsx            #   Landing Page
│   │   ├── (auth)/             #   登录/注册
│   │   └── (dashboard)/        #   仪表盘 (项目列表/详情/工作流/Agent/代码)
│   ├── components/
│   │   ├── ui/                 # 🧩 基础 UI 组件 (Button/Input/Card/Badge/Dialog/Toast/Spinner)
│   │   ├── layout/             # 📐 布局组件 (Sidebar/Header/UserMenu)
│   │   ├── workflow/           # 🎨 工作流编辑器 (ReactFlow DAG/Agent 节点/条件边/工具栏)
│   │   ├── agents/             # 🤖 Agent 交互 (对话面板/消息气泡/状态指示/思考链/选择器)
│   │   ├── code/               # 💻 代码编辑器 (Monaco/Diff/文件树/终端)
│   │   └── dashboard/          # 📊 仪表盘 (统计卡片/活动流/性能图表)
│   ├── stores/                 # 📦 Zustand 状态管理 (auth/project/agent/workflow/editor)
│   ├── lib/                    # 🔧 工具库 (API 客户端/WebSocket/工具函数/Hooks)
│   └── types/                  # 📝 TypeScript 类型定义
└── Dockerfile
```

</details>

---

## 🗺️ 开发路线

- [x] 项目架构设计
- [x] 项目骨架搭建 (200+ 文件)
- [ ] 向量引擎核心 (C++ HNSW + pybind11)
- [ ] Agent 运行时 (LangGraph + FastAPI)
- [ ] Coder & Reviewer Agent
- [ ] API 网关 (Spring Boot)
- [ ] 前端界面 (Next.js)
- [ ] 可视化工作流编辑器
- [ ] Tester & Deployer Agent
- [ ] 端到端集成联调
- [ ] 性能优化与基准测试
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

Docker 容器化 · GitHub Actions CI/CD · 单元测试 · Flyway 迁移——不是 Demo，是可部署的产品级项目

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

<div align="center">

**用 ❤️ 构建 · 相信 AI Agent 应该像团队一样协作，而非孤军奋战**

</div>
