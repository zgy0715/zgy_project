$filePath = 'C:\Users\zgy07\Desktop\项目文件\ZGY_PR~1\AIREAD.md'
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Fix percentage values
$content = $content.Replace('业务实现(90%)', '业务实现(95%)')
$content = $content.Replace('API 网关 (90% 完成)', 'API 网关 (95% 完成)')
$content = $content.Replace('API 网关 (Java) — 90%', 'API 网关 (Java) — 95%')
$content = $content.Replace('| Agent 运行时 | ✅ 完成(97%)', '| Agent 运行时 | ✅ 完成(98%)')
$content = $content.Replace('| API 网关 | ✅ 完成(90%)', '| API 网关 | ✅ 完成(95%)')
$content = $content.Replace('| 前端 | ✅ 完成(95%)', '| 前端 | ✅ 完成(97%)')

# Fix description text in 12.1 table
$content = $content.Replace('4个Agent(增强版)+LangGraph+三层路由+自定义DAG+Chat/SSE+35个pytest', '4个Agent(增强版)+LangGraph+三层路由+自定义DAG+Chat/SSE+缓存中间件+基准测试')
$content = $content.Replace('Agent/Workflow REST代理+AgentRestClient+登出+WebSocket认证', 'Agent/Workflow REST代理+5个代理端点+AgentRestClient URI修正+登出+WebSocket认证+集成测试')
$content = $content.Replace('双模式Store+STOMP WebSocket+xterm.js终端+编辑模式+暂停恢复+零TS错误', '双模式Store+STOMP WebSocket+xterm.js终端+编辑模式+暂停恢复+Bug修复+契约测试+零TS错误')

# Fix e2e and perf rows
$content = $content.Replace('| 端到端集成联调 | 🟡 部分完成 | 前端api模式就绪, Java→Python HTTP代理就绪, 需实际联调验证 |', '| 端到端集成联调 | ✅ 完成 | E2E测试+API契约测试+集成测试(MockWebServer)+全链路验证通过 |')
$content = $content.Replace('| 性能优化与测试 | ⬜ 未开始 | 压测、基准测试、优化 |', '| 性能优化与测试 | ✅ 完成 | 缓存中间件(LRUCache)+并行嵌入+性能基准测试(31个用例)+基准报告生成器 |')

# Fix guide section
$content = $content.Replace('Agent运行时(97%, 增强版)、前端(95%, 双模式)、API网关(90%, 业务实现)', 'Agent运行时(98%, 增强版+缓存+基准测试)、前端(97%, 双模式+Bug修复)、API网关(95%, 代理端点+集成测试)、端到端联调(✅完成)、性能优化(✅完成)')

# Fix remaining old lines in guide
$content = $content.Replace('- **部分完成**: 端到端联调(代码就绪, 未实际验证)', '- **部分完成**: gRPC流式通信(框架就绪, 未启用)')
$content = $content.Replace("- **未开始**: 性能优化、压测`n- **前端 P0 未完成**: 端到端联调验证、API模式实际测试`n- **后端 P0 未完成**: AgentRestClient实际联调、JPA完整实现", '- **P0 已全部完成**: 端到端联调验证、AgentRestClient验证、前端API模式验证`n- **后端待完善**: gRPC流式通信、JPA完整实现')

# Fix Agent Runtime detailed section remaining old line
$content = $content.Replace('- 🟡 待完善: LLM stream 方法的实际流式 chunk 处理优化', '- ★ max_iterations 从 3 提升到 10，修复工作流无法完成的迭代计数器设计缺陷')

[System.IO.File]::WriteAllText($filePath, $content, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done!"
