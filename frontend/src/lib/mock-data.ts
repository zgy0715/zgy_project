// Mock data for DeepAgent platform development and demo

import type {
  Project,
  Agent,
  ChatMessage,
  ThinkingChain,
  ThinkingStep,
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  ProjectFile,
  ProjectActivity,
  User,
} from '@/types';

// ============================================================
// User
// ============================================================

export const mockUser: User = {
  id: 'user-1',
  username: 'Demo User',
  email: 'demo@deepagent.dev',
  role: 'admin',
  createdAt: '2025-01-15T08:00:00Z',
};

// ============================================================
// Projects
// ============================================================

export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'E-Commerce API',
    description: '基于 Spring Boot 的电商后端服务',
    status: 'active',
    ownerId: 'user-1',
    members: [
      {
        userId: 'user-1',
        username: 'Demo User',
        role: 'owner',
        joinedAt: '2025-01-15T08:00:00Z',
      },
    ],
    techStack: ['Java', 'Spring Boot', 'PostgreSQL'],
    stats: {
      totalAgents: 4,
      totalWorkflows: 2,
      totalConversations: 47,
      totalTokens: 128000,
      codeFiles: 34,
      lastActivityAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'proj-2',
    name: 'Data Pipeline',
    description: '实时数据处理管道',
    status: 'active',
    ownerId: 'user-1',
    members: [
      {
        userId: 'user-1',
        username: 'Demo User',
        role: 'owner',
        joinedAt: '2025-02-10T10:00:00Z',
      },
    ],
    techStack: ['Python', 'FastAPI', 'Kafka'],
    stats: {
      totalAgents: 4,
      totalWorkflows: 1,
      totalConversations: 23,
      totalTokens: 85000,
      codeFiles: 18,
      lastActivityAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    createdAt: '2025-02-10T10:00:00Z',
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'proj-3',
    name: 'Dashboard UI',
    description: '管理后台前端界面',
    status: 'draft',
    ownerId: 'user-1',
    members: [
      {
        userId: 'user-1',
        username: 'Demo User',
        role: 'owner',
        joinedAt: '2025-03-05T14:00:00Z',
      },
    ],
    techStack: ['React', 'TypeScript', 'TailwindCSS'],
    stats: {
      totalAgents: 3,
      totalWorkflows: 1,
      totalConversations: 12,
      totalTokens: 42000,
      codeFiles: 22,
      lastActivityAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    createdAt: '2025-03-05T14:00:00Z',
    updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

// ============================================================
// Agents
// ============================================================

export const mockAgents: Agent[] = [
  {
    id: 'agent-coder',
    name: 'Coder',
    agentType: 'coder',
    status: 'pending',
    description: '代码生成专家',
    capabilities: ['代码生成', '多语言支持', '重构'],
    model: 'gpt-4o',
    projectId: 'proj-1',
    createdAt: '2025-01-15T09:00:00Z',
    updatedAt: '2025-01-15T09:00:00Z',
  },
  {
    id: 'agent-reviewer',
    name: 'Reviewer',
    agentType: 'reviewer',
    status: 'pending',
    description: '代码审查专家',
    capabilities: ['Bug检测', '安全审查', '风格检查'],
    model: 'gpt-4o',
    projectId: 'proj-1',
    createdAt: '2025-01-15T09:00:00Z',
    updatedAt: '2025-01-15T09:00:00Z',
  },
  {
    id: 'agent-tester',
    name: 'Tester',
    agentType: 'tester',
    status: 'pending',
    description: '测试生成专家',
    capabilities: ['单元测试', '集成测试', '覆盖率分析'],
    model: 'gpt-4o',
    projectId: 'proj-1',
    createdAt: '2025-01-15T09:00:00Z',
    updatedAt: '2025-01-15T09:00:00Z',
  },
  {
    id: 'agent-deployer',
    name: 'Deployer',
    agentType: 'deployer',
    status: 'pending',
    description: '部署配置专家',
    capabilities: ['Dockerfile', 'CI/CD', 'K8s配置'],
    model: 'gpt-4o',
    projectId: 'proj-1',
    createdAt: '2025-01-15T09:00:00Z',
    updatedAt: '2025-01-15T09:00:00Z',
  },
];

// ============================================================
// Chat Messages (with thinking chains)
// ============================================================

const baseTime = Date.now() - 30 * 60 * 1000; // 30 minutes ago

export const mockMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content:
      '请为 E-Commerce API 项目生成一个 Product 实体类，包含 id, name, description, price, stock, category, createdAt, updatedAt 字段，使用 JPA 注解。',
    agentId: 'agent-coder',
    projectId: 'proj-1',
    timestamp: new Date(baseTime).toISOString(),
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: `好的，我来为您生成 Product 实体类。

\`\`\`java
package com.example.ecommerce.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private Integer stock;

    @Column(length = 100)
    private String category;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
\`\`\`

该实体类包含以下特性：
- 使用 Lombok 减少样板代码（@Data, @NoArgsConstructor 等）
- JPA 注解配置表名和字段映射
- BigDecimal 精确表示价格
- @PrePersist / @PreUpdate 自动管理时间戳
- Builder 模式方便对象构建`,
    agentId: 'agent-coder',
    projectId: 'proj-1',
    timestamp: new Date(baseTime + 5 * 1000).toISOString(),
    metadata: {
      tokens: 320,
      model: 'gpt-4o',
      latency: 1800,
      finishReason: 'stop',
    },
  },
  {
    id: 'msg-3',
    role: 'assistant',
    content: `我已经审查了 Coder 生成的 Product 实体类，以下是我的审查意见：

**✅ 优点：**
1. 正确使用了 JPA 注解和 Lombok
2. BigDecimal 处理价格精度问题
3. 生命周期回调自动管理时间戳

**⚠️ 建议改进：**
1. 缺少索引定义 — \`category\` 和 \`name\` 字段建议添加索引以提升查询性能
2. 缺少校验注解 — 建议添加 Jakarta Validation 注解（如 @NotBlank, @Positive 等）
3. \`stock\` 字段建议添加并发控制，使用 \`@Version\` 乐观锁

改进后的代码片段：

\`\`\`java
@Table(name = "products", indexes = {
    @Index(name = "idx_product_category", columnList = "category"),
    @Index(name = "idx_product_name", columnList = "name")
})

@Column(nullable = false, length = 200)
@NotBlank(message = "Product name is required")
private String name;

@Column(nullable = false, precision = 10, scale = 2)
@DecimalMin(value = "0.0", inclusive = false, message = "Price must be positive")
private BigDecimal price;

@Column(nullable = false)
@Min(value = 0, message = "Stock cannot be negative")
private Integer stock;

@Version
private Long version;
\`\`\`

总体评价：**通过** — 代码质量良好，建议采纳上述改进。`,
    agentId: 'agent-reviewer',
    projectId: 'proj-1',
    timestamp: new Date(baseTime + 20 * 1000).toISOString(),
    metadata: {
      tokens: 280,
      model: 'gpt-4o',
      latency: 2100,
      finishReason: 'stop',
    },
  },
  {
    id: 'msg-4',
    role: 'assistant',
    content: `基于 Product 实体类，我已生成对应的单元测试：

\`\`\`java
package com.example.ecommerce.entity;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class ProductTest {

    private static ValidatorFactory factory;
    private Validator validator;

    @BeforeAll
    static void setupFactory() {
        factory = Validation.buildDefaultValidatorFactory();
    }

    @BeforeEach
    void setup() {
        validator = factory.getValidator();
    }

    @AfterAll
    static void teardown() {
        factory.close();
    }

    @Test
    @DisplayName("Should create product with builder")
    void shouldCreateProductWithBuilder() {
        Product product = Product.builder()
            .name("MacBook Pro 16")
            .description("Apple Laptop")
            .price(new BigDecimal("2499.99"))
            .stock(100)
            .category("Electronics")
            .build();

        assertNotNull(product);
        assertEquals("MacBook Pro 16", product.getName());
        assertEquals(new BigDecimal("2499.99"), product.getPrice());
        assertEquals(100, product.getStock());
    }

    @Test
    @DisplayName("Should fail validation when name is blank")
    void shouldFailWhenNameIsBlank() {
        Product product = Product.builder()
            .name("")
            .price(new BigDecimal("99.99"))
            .stock(10)
            .build();

        var violations = validator.validate(product);
        assertFalse(violations.isEmpty());
    }

    @Test
    @DisplayName("Should fail validation when price is negative")
    void shouldFailWhenPriceIsNegative() {
        Product product = Product.builder()
            .name("Test Product")
            .price(new BigDecimal("-1.00"))
            .stock(10)
            .build();

        var violations = validator.validate(product);
        assertFalse(violations.isEmpty());
    }

    @Test
    @DisplayName("Should auto-set timestamps on persist")
    void shouldAutoSetTimestamps() {
        Product product = new Product();
        product.setName("Test");
        product.setPrice(BigDecimal.ONE);
        product.setStock(1);

        product.onCreate();

        assertNotNull(product.getCreatedAt());
        assertNotNull(product.getUpdatedAt());
        assertEquals(product.getCreatedAt(), product.getUpdatedAt());
    }

    @Test
    @DisplayName("Should update updatedAt on update")
    void shouldUpdateTimestampOnUpdate() throws InterruptedException {
        Product product = new Product();
        product.onCreate();
        LocalDateTime created = product.getCreatedAt();

        Thread.sleep(10);
        product.onUpdate();

        assertEquals(created, product.getCreatedAt());
        assertTrue(product.getUpdatedAt().isAfter(created));
    }
}
\`\`\`

测试覆盖了以下场景：
- Builder 模式创建对象
- 字段校验（空名称、负价格）
- 时间戳自动管理
- 创建和更新时间分离

测试通过率预估：**100%**`,
    agentId: 'agent-tester',
    projectId: 'proj-1',
    timestamp: new Date(baseTime + 45 * 1000).toISOString(),
    metadata: {
      tokens: 450,
      model: 'gpt-4o',
      latency: 2500,
      finishReason: 'stop',
    },
  },
];

// Thinking chains for each assistant message
export const mockThinkingChains: ThinkingChain[] = [
  {
    id: 'tc-1',
    messageId: 'msg-2',
    agentId: 'agent-coder',
    agentType: 'coder',
    steps: [
      {
        id: 'tc-1-step-1',
        agentId: 'agent-coder',
        messageId: 'msg-2',
        step: '1',
        thought: '用户需要一个 JPA 实体类，包含8个字段。需要确定合适的注解和数据类型。',
        action: 'analyze',
        actionInput: 'entity requirements',
        observation: '需要 id(Long), name(String), description(String), price(BigDecimal), stock(Integer), category(String), createdAt(LocalDateTime), updatedAt(LocalDateTime)',
        timestamp: new Date(baseTime + 1 * 1000).toISOString(),
      },
      {
        id: 'tc-1-step-2',
        agentId: 'agent-coder',
        messageId: 'msg-2',
        step: '2',
        thought: '选择 BigDecimal 作为价格类型以避免浮点精度问题，使用 GenerationType.IDENTITY 作为主键策略。',
        action: 'design',
        actionInput: 'field types and annotations',
        observation: '确定使用 @Entity, @Table, @Id, @GeneratedValue, @Column 等注解',
        timestamp: new Date(baseTime + 2 * 1000).toISOString(),
      },
      {
        id: 'tc-1-step-3',
        agentId: 'agent-coder',
        messageId: 'msg-2',
        step: '3',
        thought: '添加 Lombok 注解减少样板代码，使用 @PrePersist 和 @PreUpdate 自动管理时间戳。',
        action: 'generate',
        actionInput: 'entity class code',
        observation: '生成完整的 Product.java 实体类代码',
        timestamp: new Date(baseTime + 3 * 1000).toISOString(),
      },
      {
        id: 'tc-1-step-4',
        agentId: 'agent-coder',
        messageId: 'msg-2',
        step: '4',
        thought: '代码生成完成，检查是否遗漏字段或注解。所有8个字段均已包含，JPA 注解配置正确。',
        action: 'verify',
        actionInput: 'generated code',
        observation: '代码完整，输出最终结果',
        timestamp: new Date(baseTime + 4 * 1000).toISOString(),
      },
    ],
    finalAnswer: 'Product entity class generated successfully',
    totalSteps: 4,
    duration: 1800,
  },
  {
    id: 'tc-2',
    messageId: 'msg-3',
    agentId: 'agent-reviewer',
    agentType: 'reviewer',
    steps: [
      {
        id: 'tc-2-step-1',
        agentId: 'agent-reviewer',
        messageId: 'msg-3',
        step: '1',
        thought: '审查 Product 实体类的整体结构和 JPA 注解使用是否正确。',
        action: 'review',
        actionInput: 'entity structure',
        observation: '结构合理，Lombok 和 JPA 注解使用正确',
        timestamp: new Date(baseTime + 16 * 1000).toISOString(),
      },
      {
        id: 'tc-2-step-2',
        agentId: 'agent-reviewer',
        messageId: 'msg-3',
        step: '2',
        thought: '检查是否存在性能问题，特别是数据库索引和查询优化。',
        action: 'check',
        actionInput: 'performance concerns',
        observation: '缺少 category 和 name 字段的索引，可能影响查询性能',
        timestamp: new Date(baseTime + 17 * 1000).toISOString(),
      },
      {
        id: 'tc-2-step-3',
        agentId: 'agent-reviewer',
        messageId: 'msg-3',
        step: '3',
        thought: '检查数据校验和并发控制是否完善。',
        action: 'check',
        actionInput: 'validation and concurrency',
        observation: '缺少 Jakarta Validation 注解，stock 字段无并发控制',
        timestamp: new Date(baseTime + 18 * 1000).toISOString(),
      },
      {
        id: 'tc-2-step-4',
        agentId: 'agent-reviewer',
        messageId: 'msg-3',
        step: '4',
        thought: '检查安全漏洞，如 SQL 注入风险、敏感数据暴露等。',
        action: 'security_scan',
        actionInput: 'security vulnerabilities',
        observation: '未发现安全漏洞，JPA 参数化查询天然防 SQL 注入',
        timestamp: new Date(baseTime + 19 * 1000).toISOString(),
      },
      {
        id: 'tc-2-step-5',
        agentId: 'agent-reviewer',
        messageId: 'msg-3',
        step: '5',
        thought: '综合审查结果：代码质量良好，建议添加索引、校验注解和乐观锁。总体评价：通过。',
        action: 'conclude',
        actionInput: 'review summary',
        observation: '审查完成，给出改进建议和最终评价',
        timestamp: new Date(baseTime + 19.5 * 1000).toISOString(),
      },
    ],
    finalAnswer: 'Code review passed with improvement suggestions',
    totalSteps: 5,
    duration: 2100,
  },
  {
    id: 'tc-3',
    messageId: 'msg-4',
    agentId: 'agent-tester',
    agentType: 'tester',
    steps: [
      {
        id: 'tc-3-step-1',
        agentId: 'agent-tester',
        messageId: 'msg-4',
        step: '1',
        thought: '分析 Product 实体类的所有字段和方法，确定需要测试的场景。',
        action: 'analyze',
        actionInput: 'test scenarios',
        observation: '需要测试：Builder创建、字段校验、时间戳管理、更新逻辑',
        timestamp: new Date(baseTime + 36 * 1000).toISOString(),
      },
      {
        id: 'tc-3-step-2',
        agentId: 'agent-tester',
        messageId: 'msg-4',
        step: '2',
        thought: '设计正向测试用例：Builder 模式创建对象、时间戳自动设置。',
        action: 'design',
        actionInput: 'positive test cases',
        observation: '设计 shouldCreateProductWithBuilder 和 shouldAutoSetTimestamps 测试',
        timestamp: new Date(baseTime + 38 * 1000).toISOString(),
      },
      {
        id: 'tc-3-step-3',
        agentId: 'agent-tester',
        messageId: 'msg-4',
        step: '3',
        thought: '设计反向测试用例：空名称校验、负价格校验、时间戳更新验证。',
        action: 'design',
        actionInput: 'negative test cases',
        observation: '设计 shouldFailWhenNameIsBlank, shouldFailWhenPriceIsNegative, shouldUpdateTimestampOnUpdate 测试',
        timestamp: new Date(baseTime + 40 * 1000).toISOString(),
      },
      {
        id: 'tc-3-step-4',
        agentId: 'agent-tester',
        messageId: 'msg-4',
        step: '4',
        thought: '生成完整的 JUnit 5 测试类，使用 Jakarta Validation 进行校验测试。',
        action: 'generate',
        actionInput: 'test class code',
        observation: '生成 ProductTest.java，包含5个测试方法',
        timestamp: new Date(baseTime + 42 * 1000).toISOString(),
      },
    ],
    finalAnswer: 'Unit tests generated with 100% estimated pass rate',
    totalSteps: 4,
    duration: 2500,
  },
];

// ============================================================
// Workflow DAG
// ============================================================

export const mockWorkflowNodes: WorkflowNode[] = [
  {
    id: 'node-start',
    agentType: 'trigger',
    name: 'Start',
    type: 'trigger',
    position: { x: 50, y: 200 },
    data: { label: 'Start', description: 'Workflow trigger', status: 'pending' },
  },
  {
    id: 'node-coder',
    agentType: 'coder',
    name: 'Coder',
    type: 'agent',
    position: { x: 300, y: 200 },
    data: {
      label: 'Coder',
      agentId: 'agent-coder',
      agentType: 'coder',
      description: 'Generate code',
      status: 'pending',
    },
  },
  {
    id: 'node-reviewer',
    agentType: 'reviewer',
    name: 'Reviewer',
    type: 'agent',
    position: { x: 550, y: 200 },
    data: {
      label: 'Reviewer',
      agentId: 'agent-reviewer',
      agentType: 'reviewer',
      description: 'Review code quality',
      status: 'pending',
    },
  },
  {
    id: 'node-condition',
    agentType: 'condition',
    name: 'Review Passed?',
    type: 'condition',
    position: { x: 800, y: 200 },
    data: {
      label: 'Review Passed?',
      description: 'Check review result',
      status: 'pending',
    },
  },
  {
    id: 'node-tester',
    agentType: 'tester',
    name: 'Tester',
    type: 'agent',
    position: { x: 1050, y: 100 },
    data: {
      label: 'Tester',
      agentId: 'agent-tester',
      agentType: 'tester',
      description: 'Run tests',
      status: 'pending',
    },
  },
  {
    id: 'node-deployer',
    agentType: 'deployer',
    name: 'Deployer',
    type: 'agent',
    position: { x: 1300, y: 100 },
    data: {
      label: 'Deployer',
      agentId: 'agent-deployer',
      agentType: 'deployer',
      description: 'Deploy application',
      status: 'pending',
    },
  },
  {
    id: 'node-end',
    agentType: 'output',
    name: 'End',
    type: 'output',
    position: { x: 1550, y: 100 },
    data: {
      label: 'End',
      description: 'Workflow complete',
      status: 'pending',
    },
  },
];

export const mockWorkflowEdges: WorkflowEdge[] = [
  {
    id: 'edge-start-coder',
    source: 'node-start',
    target: 'node-coder',
    type: 'default',
    animated: true,
  },
  {
    id: 'edge-coder-reviewer',
    source: 'node-coder',
    target: 'node-reviewer',
    type: 'default',
  },
  {
    id: 'edge-reviewer-condition',
    source: 'node-reviewer',
    target: 'node-condition',
    type: 'default',
  },
  {
    id: 'edge-condition-tester',
    source: 'node-condition',
    target: 'node-tester',
    type: 'conditional',
    label: '通过',
    condition: 'review_passed == true',
    animated: true,
  },
  {
    id: 'edge-condition-coder',
    source: 'node-condition',
    target: 'node-coder',
    type: 'conditional',
    label: '不通过',
    condition: 'review_passed == false',
  },
  {
    id: 'edge-tester-deployer',
    source: 'node-tester',
    target: 'node-deployer',
    type: 'default',
  },
  {
    id: 'edge-deployer-end',
    source: 'node-deployer',
    target: 'node-end',
    type: 'default',
  },
];

export const mockWorkflow: Workflow = {
  id: 'wf-1',
  projectId: 'proj-1',
  name: 'Code Generation Pipeline',
  description: '完整的代码生成、审查、测试和部署流水线',
  status: 'created',
  nodes: mockWorkflowNodes,
  edges: mockWorkflowEdges,
  version: 1,
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:00:00Z',
};

// ============================================================
// File Tree + Code Content
// ============================================================

export const mockFileContents: Record<string, string> = {
  'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>ecommerce-api</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <name>E-Commerce API</name>
    <description>E-Commerce Backend Service</description>

    <properties>
        <java.version>17</java.version>
        <lombok.version>1.18.32</lombok.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`,

  'src/main/java/com/example/EcommerceApplication.java': `package com.example.ecommerce;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class EcommerceApplication {

    public static void main(String[] args) {
        SpringApplication.run(EcommerceApplication.class, args);
    }
}`,

  'src/main/java/com/example/entity/Product.java': `package com.example.ecommerce.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "products", indexes = {
    @Index(name = "idx_product_category", columnList = "category"),
    @Index(name = "idx_product_name", columnList = "name")
})
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private Integer stock;

    @Column(length = 100)
    private String category;

    @Version
    private Long version;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}`,

  'src/main/java/com/example/repository/ProductRepository.java': `package com.example.ecommerce.repository;

import com.example.ecommerce.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByCategory(String category);

    List<Product> findByNameContaining(String name);

    @Query("SELECT p FROM Product p WHERE p.stock < :threshold")
    List<Product> findLowStockProducts(int threshold);
}`,

  'src/main/java/com/example/controller/ProductController.java': `package com.example.ecommerce.controller;

import com.example.ecommerce.entity.Product;
import com.example.ecommerce.repository.ProductRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductRepository productRepository;

    @GetMapping
    public ResponseEntity<List<Product>> getAllProducts() {
        return ResponseEntity.ok(productRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getProduct(@PathVariable Long id) {
        return productRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Product> createProduct(@Valid @RequestBody Product product) {
        Product saved = productRepository.save(product);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Product> updateProduct(
            @PathVariable Long id,
            @Valid @RequestBody Product product) {
        return productRepository.findById(id)
            .map(existing -> {
                product.setId(id);
                return ResponseEntity.ok(productRepository.save(product));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        return productRepository.findById(id)
            .map(product -> {
                productRepository.delete(product);
                return ResponseEntity.noContent().<Void>build();
            })
            .orElse(ResponseEntity.notFound().build());
    }
}`,

  'src/main/resources/application.yml': `server:
  port: 8080

spring:
  application:
    name: ecommerce-api
  datasource:
    url: jdbc:postgresql://localhost:5432/ecommerce
    username: postgres
    password: postgres
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
    properties:
      hibernate:
        format_sql: true
        dialect: org.hibernate.dialect.PostgreSQLDialect

logging:
  level:
    com.example.ecommerce: DEBUG
    org.hibernate.SQL: DEBUG`,

  'Dockerfile': `FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN apk add --no-cache maven && mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/ecommerce-api-0.1.0-SNAPSHOT.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]`,
};

export const mockFileTree: ProjectFile[] = [
  {
    id: 'file-pom',
    projectId: 'proj-1',
    name: 'pom.xml',
    path: 'pom.xml',
    type: 'file',
    language: 'xml',
    size: 2048,
    lastModified: '2025-01-15T10:00:00Z',
  },
  {
    id: 'file-dockerfile',
    projectId: 'proj-1',
    name: 'Dockerfile',
    path: 'Dockerfile',
    type: 'file',
    language: 'dockerfile',
    size: 512,
    lastModified: '2025-01-15T10:00:00Z',
  },
  {
    id: 'dir-src',
    projectId: 'proj-1',
    name: 'src',
    path: 'src',
    type: 'directory',
    lastModified: '2025-01-15T10:00:00Z',
    children: [
      {
        id: 'dir-src-main',
        projectId: 'proj-1',
        name: 'main',
        path: 'src/main',
        type: 'directory',
        lastModified: '2025-01-15T10:00:00Z',
        children: [
          {
            id: 'dir-src-main-java',
            projectId: 'proj-1',
            name: 'java',
            path: 'src/main/java',
            type: 'directory',
            lastModified: '2025-01-15T10:00:00Z',
            children: [
              {
                id: 'dir-src-main-java-com',
                projectId: 'proj-1',
                name: 'com',
                path: 'src/main/java/com',
                type: 'directory',
                lastModified: '2025-01-15T10:00:00Z',
                children: [
                  {
                    id: 'dir-src-main-java-com-example',
                    projectId: 'proj-1',
                    name: 'example',
                    path: 'src/main/java/com/example',
                    type: 'directory',
                    lastModified: '2025-01-15T10:00:00Z',
                    children: [
                      {
                        id: 'dir-src-main-java-com-example-ecommerce',
                        projectId: 'proj-1',
                        name: 'ecommerce',
                        path: 'src/main/java/com/example/ecommerce',
                        type: 'directory',
                        lastModified: '2025-01-15T10:00:00Z',
                        children: [
                          {
                            id: 'file-application',
                            projectId: 'proj-1',
                            name: 'EcommerceApplication.java',
                            path: 'src/main/java/com/example/EcommerceApplication.java',
                            type: 'file',
                            language: 'java',
                            size: 320,
                            lastModified: '2025-01-15T10:00:00Z',
                          },
                          {
                            id: 'dir-entity',
                            projectId: 'proj-1',
                            name: 'entity',
                            path: 'src/main/java/com/example/ecommerce/entity',
                            type: 'directory',
                            lastModified: '2025-01-15T10:00:00Z',
                            children: [
                              {
                                id: 'file-product-entity',
                                projectId: 'proj-1',
                                name: 'Product.java',
                                path: 'src/main/java/com/example/entity/Product.java',
                                type: 'file',
                                language: 'java',
                                size: 1536,
                                lastModified: '2025-01-15T10:00:00Z',
                              },
                            ],
                          },
                          {
                            id: 'dir-repository',
                            projectId: 'proj-1',
                            name: 'repository',
                            path: 'src/main/java/com/example/ecommerce/repository',
                            type: 'directory',
                            lastModified: '2025-01-15T10:00:00Z',
                            children: [
                              {
                                id: 'file-product-repo',
                                projectId: 'proj-1',
                                name: 'ProductRepository.java',
                                path: 'src/main/java/com/example/repository/ProductRepository.java',
                                type: 'file',
                                language: 'java',
                                size: 640,
                                lastModified: '2025-01-15T10:00:00Z',
                              },
                            ],
                          },
                          {
                            id: 'dir-controller',
                            projectId: 'proj-1',
                            name: 'controller',
                            path: 'src/main/java/com/example/ecommerce/controller',
                            type: 'directory',
                            lastModified: '2025-01-15T10:00:00Z',
                            children: [
                              {
                                id: 'file-product-controller',
                                projectId: 'proj-1',
                                name: 'ProductController.java',
                                path: 'src/main/java/com/example/controller/ProductController.java',
                                type: 'file',
                                language: 'java',
                                size: 1792,
                                lastModified: '2025-01-15T10:00:00Z',
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'dir-src-main-resources',
            projectId: 'proj-1',
            name: 'resources',
            path: 'src/main/resources',
            type: 'directory',
            lastModified: '2025-01-15T10:00:00Z',
            children: [
              {
                id: 'file-application-yml',
                projectId: 'proj-1',
                name: 'application.yml',
                path: 'src/main/resources/application.yml',
                type: 'file',
                language: 'yaml',
                size: 512,
                lastModified: '2025-01-15T10:00:00Z',
              },
            ],
          },
        ],
      },
    ],
  },
];

// ============================================================
// Activity Feed
// ============================================================

export const mockActivities: ProjectActivity[] = [
  {
    id: 'act-1',
    projectId: 'proj-1',
    userId: 'agent-tester',
    username: 'Tester',
    action: 'completed_tests',
    target: 'ProductTest.java',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-2',
    projectId: 'proj-1',
    userId: 'agent-reviewer',
    username: 'Reviewer',
    action: 'approved_code',
    target: 'Product.java',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-3',
    projectId: 'proj-1',
    userId: 'agent-coder',
    username: 'Coder',
    action: 'generated_code',
    target: 'Product.java',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-4',
    projectId: 'proj-1',
    userId: 'agent-coder',
    username: 'Coder',
    action: 'generated_code',
    target: 'ProductController.java',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-5',
    projectId: 'proj-1',
    userId: 'agent-deployer',
    username: 'Deployer',
    action: 'created_config',
    target: 'Dockerfile',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-6',
    projectId: 'proj-1',
    userId: 'agent-reviewer',
    username: 'Reviewer',
    action: 'flagged_issue',
    target: 'OrderService.java',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    metadata: { severity: 'medium', type: 'performance' },
  },
  {
    id: 'act-7',
    projectId: 'proj-2',
    userId: 'agent-coder',
    username: 'Coder',
    action: 'refactored_code',
    target: 'pipeline/processor.py',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-8',
    projectId: 'proj-1',
    userId: 'agent-tester',
    username: 'Tester',
    action: 'completed_tests',
    target: 'OrderServiceTest.java',
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    metadata: { passRate: 96.5, totalTests: 12 },
  },
  {
    id: 'act-9',
    projectId: 'proj-3',
    userId: 'agent-coder',
    username: 'Coder',
    action: 'generated_code',
    target: 'Dashboard.tsx',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-10',
    projectId: 'proj-1',
    userId: 'agent-deployer',
    username: 'Deployer',
    action: 'deployed',
    target: 'v0.1.0-alpha',
    timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    metadata: { environment: 'staging' },
  },
];

// ============================================================
// Dashboard Stats
// ============================================================

export const mockDashboardStats = {
  totalProjects: 3,
  totalAgentRuns: 156,
  totalCodeLines: 12847,
  testPassRate: 94.2,
};
