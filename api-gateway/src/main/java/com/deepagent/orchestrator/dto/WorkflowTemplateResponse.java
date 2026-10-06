package com.deepagent.orchestrator.dto;

import java.util.Map;

/**
 * Workflow 模板。
 *
 * <p>模板由网关内置提供（agent-runtime 没有模板接口），前端据此提供“从模板创建”入口。</p>
 */
public record WorkflowTemplateResponse(
        String id,
        String name,
        String description,
        String category,
        Map<String, Object> definition
) {
}
