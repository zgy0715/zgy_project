package com.deepagent.orchestrator.dto;

import java.util.Map;

/**
 * Agent 对外响应模型（由 agent-runtime 的返回映射而来）。
 *
 * <p>时间字段保持为字符串：agent-runtime（Python）返回 ISO-8601 文本，
 * 网关不做解析以避免格式差异导致的 500。</p>
 */
public record AgentResponse(
        String id,
        String name,
        String description,
        String agentType,
        String status,
        Map<String, Object> config,
        String ownerId,
        String createdAt,
        String updatedAt
) {
}
