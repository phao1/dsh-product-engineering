import type { Translate } from './locales.ts'
import type { Skill } from './ui.tsx'

const descriptions: Readonly<Record<string, string>> = {
  'pe-start-here': '从想法、新证据、已确认的变更、缺陷或发布任务出发，找出当前阶段与下一步。',
  'pe-propose': '研究新产品想法是否值得做，给出带来源和关键界面的产品提案。',
  'pe-competitor-analysis': '找出竞品和替代方案，比较各自强弱，确定可以拉开差距的方向。',
  'pe-market-segments': '梳理 3–5 个客户细分，比较他们要完成的事、主要痛点与产品匹配度。',
  'pe-beachhead-segment': '按痛点紧迫性、付费意愿、可赢得份额和转介绍潜力选择首个目标市场。',
  'pe-value-curve': '围绕目标客户最看重的需求和价格，对比产品与竞品的价值曲线。',
  'pe-value-proposition': '用目标客户、动机、现状、方法、结果与替代方案写出或检验价值主张。',
  'pe-growth-loops': '设计可自我强化的增长循环，覆盖分享、使用、协作、内容或推荐。',
  'pe-ship-check': '汇总应用文档、测试覆盖、正确性、安全和性能检查及独立审查，供发布评审。',
  'pe-code-review': '优先审查影响正确性的缺陷，逐条核实问题和影响后再报告。',
  'pe-independent-review': '让未参与构建的审查者独立检查发布或修复，修正后重新核对。',
  'pe-intended-vs-implemented': '对照文档、代码与角色权限，引用两侧证据指出实现偏差。',
  'pe-shipping-artifacts': '为交接或评审整理架构、关键流程、权限、配置变量和测试覆盖文档。',
  'pe-release-gate': '发布前预览并记录放行决定，推进后验证实际服务，准备回滚路径。',
  'pe-test-harness': '编写、运行和排查测试，让通过结果真正验证目标行为或修复。',
  'pe-document-app': '根据代码编写或刷新应用文档，也可只检查文档与实现的差异。',
  'pe-derive-tests': '从文档和代码推导测试覆盖、列出缺口，并检查覆盖图是否过期。',
  'pe-security-audit-static': '在明确要求安全审计时，依据文档中的信任边界检查代码。',
  'pe-performance-audit-static': '在明确要求性能审计时，检查 N+1 查询、过量读取、索引与缓存。',
  'pe-delegation': '准备子代理任务说明，选择执行者、安排并行工作、核验结果并交接。',
  'pe-codex-agents': '调用 Codex CLI 参与讨论、构建或独立审查。',
  'pe-grok-agents': '以无界面模式调用 Grok CLI 参与讨论、构建或独立审查。',
  'pe-claude-agents': '以无界面模式调用 Claude Code 参与讨论、构建或独立审查。',
  'pe-handover': '先与磁盘现状核对，再交接目标、证据、待办、未决问题和下一步。',
  'pe-retro': '复盘会话中的阻力和原因，验证指令、路由、钩子或脚本的改动。',
  'pe-agent-instructions': '编写或整理 AGENTS.md 与 CLAUDE.md，让规则在适用时能被执行。',
  'pe-guardrail-hooks': '把反复被违反的规则落实为钩子、工具权限或可执行脚本。',
  'pe-flight-deck': '在长任务、后台作业或等待决策时，记录当前状态并保留进度。',
  'pe-windows-agent-shell': '排查 Windows 命令行的 Git Bash 路径、PowerShell 引号与编码及 CRLF。',
  'pe-app-lifecycle': '规划 SaaS 从想法到生产的阶段，并明确每一阶段的完成条件。',
  'pe-saas-authorization': '为多租户 SaaS 的登录、角色、路由、令牌、Webhook 或作业设计授权。',
  'pe-supabase-production': '处理 Supabase 查询、RPC、迁移、RLS 与授权，保护仅服务端使用的密钥。',
  'pe-clerk-production': '在 Next.js 生产环境配置或排查 Clerk 登录、组织、角色与计费。',
  'pe-environments': '管理开发与生产环境、变量、密钥、域名和备份，并处理泄露等事件。',
  'pe-ui-design': '设计或评审页面、原型和可视交付物，检查组件、字体、颜色和一致性。',
  'pe-transactional-email': '配置或排查事务和告警邮件，处理重复、漏发及一键退订。',
  'pe-legal-pages': '根据产品实际行为起草隐私政策、条款和同意界面，留待负责人确认。',
  'pe-product-analytics': '配置行为分析、会话回放或热图，并由代理读取结果。',
  'pe-uptime-monitoring': '建立内容检查、多地探测、心跳和经过测试的告警链路。',
  'pe-mcp-server': '交付远程 MCP 服务器或工具，处理 OAuth、测试和目录上架。',
  'pe-chatgpt-plugin': '准备 ChatGPT 应用或插件的授权、包、数据规则与目录审核。',
  'pe-embedded-agents-messages-api': '在 Next.js 应用中通过 Messages API 嵌入 Claude 智能体或聊天。',
  'pe-embedded-agents-agent-sdk': '需要 Agent SDK 或 Claude Code 自身工具时，在 Next.js 中嵌入智能体。',
  'pe-work-humanizer': '润色带有 AI 痕迹的工作文稿，保持原意和事实。',
}

export function skillDescription(skill: Skill, t: Translate): { text: string; lang: 'zh-CN' | 'en' } {
  const localized = t('locale') === 'zh-CN' ? descriptions[skill.name] : undefined
  return localized ? { text: localized, lang: 'zh-CN' } : { text: skill.description, lang: 'en' }
}
