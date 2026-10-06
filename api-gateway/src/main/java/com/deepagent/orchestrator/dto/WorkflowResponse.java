package com.deepagent.orchestrator.dto;

import java.util.List;
import java.util.Map;

/**
 * Workflow 对外响应模型（由 agent-runtime 的返回映射而来）。
 *
 * <p>时间字段保持字符串（上游返回 ISO-8601 文本），避免解析失败导致 500。</p>
 */
public record WorkflowResponse(
        String id,
        String name,
        String description,
        String status,
        List<Map<String, Object>> nodes,
        List<Map<String, Object>> edges,
        String ownerId,
        String createdAt,
        String updatedAt
) {
}
