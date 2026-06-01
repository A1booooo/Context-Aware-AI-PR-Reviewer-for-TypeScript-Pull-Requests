# Context-Aware AI PR Reviewer for TypeScript Pull Requests

## Summary

做一个面向 TypeScript/React 项目的轻量级上下文感知 AI PR Review GitHub Action。它不是替代 ESLint、TypeScript、CodeQL，而是补充传统工具难以覆盖的 PR 语义审查：变更意图、潜在逻辑风险、测试缺口和可维护性问题。

项目必须严格按比赛提交规则开发：公开 GitHub 仓库、持续 commit、持续 PR 合并、主分支始终可运行、README 明确依赖与原创部分、最终提供 demo 视频。

## Key Changes / Implementation

- 核心审查链路：
  - GitHub Event 触发 Action。
  - GitHub Client 获取 PR metadata、changed files、patch、已有 bot 评论。
  - Config Loader 读取 `.ai-pr-review.yml`。
  - Diff Processor 过滤 generated files、lock files、docs-only 改动，并对大 diff 截断。
  - Context Builder 组合 `Patch Diff`、可选 `Full File Context`、项目配置和 React/TypeScript 审查重点。
  - LLM Reviewer 调用真实 LLM API，要求返回结构化 JSON。
  - Review Publisher upsert 总评论，并发布经过校验的少量 inline 评论。

- 上下文增强：
  - 小 PR 默认读取 changed file 的完整文件内容。
  - 大 PR 只读取 patch、文件路径、截断说明。
  - prompt 明确区分：
    - `Pull Request Metadata`
    - `Patch Diff`
    - `Full File Context`
    - `Review Focus`
    - `Output Schema`

- 配置文件 `.ai-pr-review.yml`：
  ```yaml
  language: zh-CN
  max_files: 20
  max_patch_chars_per_file: 6000
  include_full_file_context: true
  exclude:
    - "dist/**"
    - "package-lock.json"
    - "pnpm-lock.yaml"
    - "*.min.js"
  review:
    severity_threshold: medium
    max_inline_comments: 5
    confidence_threshold: 0.75
    focus:
      - bug-risk
      - security
      - test-coverage
      - maintainability
      - react-hooks
      - typescript-types
  ```

- 噪音控制：
  - 总评论使用固定 marker：`<!-- ai-pr-review-assistant -->`。
  - 每次运行先查找旧评论，存在则 update，不重复 create。
  - inline 评论只允许高置信度问题。
  - 不评论纯风格偏好、格式化改动、generated files、lock files。
  - 不把“可以考虑”“建议优化”这类弱建议发成 inline。
  - 如果没有明确风险，输出简短的 no major issues summary。

- inline 定位策略：
  - LLM 不直接决定最终 GitHub 行号。
  - LLM 返回 `file + code_snippet + reason + severity + confidence`。
  - 程序在 patch 新增行中匹配 snippet。
  - 匹配成功才发 inline。
  - 匹配失败则降级到总评论中的 file-level finding。
  - inline 发布失败不影响总评论发布。

- 失败降级：
  - 非 `pull_request` 事件：跳过。
  - 缺少 API key：清晰失败并提示配置 secret。
  - fork PR 无 secret：跳过 AI 调用并说明原因。
  - patch 为空、二进制、删除文件：跳过该文件。
  - changed files 分页获取。
  - diff 超限：截断并在评论中说明。
  - LLM 超时或 rate limit：失败信息清晰。
  - JSON 被 markdown code fence 包住时自动清理。
  - JSON 解析失败：发布文本总评，不发 inline。
  - GitHub inline comment 422：降级为 file-level finding。

## PR / Commit Delivery Plan

- 全周期持续交付，禁止最后一天一次性提交全部代码。
- 所有 commit 时间必须在比赛规定开始与截止时间内。
- 主分支始终保持可运行，PR 合并后评委可以随时查看 demo 效果。
- 每个 PR 只做一件事，粒度尽量小，大功能拆成多个独立 PR。

建议 PR 拆分：

1. `feat: initialize GitHub Action project`
   - 初始化 TypeScript Action 项目。
   - 增加基础 workflow、构建脚本、测试框架。
   - 验证 Action 能在 PR 事件中启动。

2. `feat: fetch pull request metadata and changed files`
   - 获取 PR metadata、changed files、patch。
   - 处理分页、空 patch、二进制和 deleted files。
   - 增加 diff fixture 单元测试。

3. `feat: add review configuration support`
   - 增加 `.ai-pr-review.yml`。
   - 支持 language、exclude、max files、severity、confidence、focus。
   - README 说明配置字段。

4. `feat: build context-aware review prompt`
   - 加入 patch + full file context。
   - 实现小 PR 完整上下文、大 PR 截断策略。
   - 内置 TypeScript/React review focus。

5. `feat: generate structured AI review results`
   - 接入真实 LLM API。
   - 强制 JSON schema 输出。
   - 处理 code fence、malformed JSON、超时和降级。

6. `feat: upsert pull request summary review`
   - 使用固定 marker 更新旧总评论。
   - 输出摘要、风险、建议、测试缺口、截断说明。
   - 避免每次 push 重复刷屏。

7. `feat: publish validated inline findings`
   - LLM 返回 snippet，程序在 patch 中定位。
   - 只发布新增行、高置信度、数量受限的 inline 评论。
   - 定位失败降级为 file-level finding。

8. `test: add curated review fixtures`
   - 增加 demo fixtures：
     - auth bug
     - React hook stale closure
     - missing error handling
     - unsafe token handling
   - 每个 fixture 配 expected findings。

9. `docs: add README, architecture, and demo guide`
   - README 补齐项目简介、架构图、配置、workflow、第三方依赖、限制说明。
   - 加 demo 视频链接或录制说明。
   - 明确原创部分和依赖来源。

每个 PR 描述必须包含：

- 标题：一句话说明本 PR 新增或修改了什么。
- 功能描述：说明该功能的作用与使用方式。
- 实现思路：简要说明技术选型或核心实现逻辑。
- 测试方式：说明如何验证该功能正常运行。

## Test Plan

- 单元测试：
  - 配置文件解析和默认值。
  - exclude pattern 过滤。
  - patch 截断和截断说明。
  - full file context 开关。
  - LLM JSON 清理与解析。
  - snippet 在 patch 新增行中的匹配。
  - inline 失败降级为 file-level finding。
  - upsert marker 能找到并更新旧评论。

- fixture 质量验证：
  - `demo/fixtures/pr-1-auth-bug.diff`
  - `demo/fixtures/pr-2-react-effect-bug.diff`
  - `demo/fixtures/pr-3-error-handling.diff`
  - `demo/fixtures/pr-4-token-storage.diff`
  - 每个 fixture 配 `expected_findings.json`，用于说明 reviewer 是否能识别常见风险。

- 集成验证：
  - 在公开测试仓库创建 PR。
  - Action 自动运行。
  - 总评论被创建。
  - 再 push 一次后，总评论被更新而不是重复创建。
  - 高置信度问题能产生 inline 评论。
  - 无法定位的 finding 出现在总评论中。
  - 没有 API key、fork PR、大 diff、空 patch 都有清晰降级表现。

## README / Demo Requirements

- README 必须包含：
  - 项目名称：`Context-Aware AI PR Reviewer for TypeScript Pull Requests`。
  - 一句话定位：轻量、透明、可配置、低噪音的 AI PR Review Action。
  - 和 ESLint、TypeScript、CodeQL、reviewdog 的边界说明。
  - 架构处理链路图。
  - GitHub Action workflow 示例。
  - `.ai-pr-review.yml` 配置示例。
  - Secrets 配置说明。
  - 第三方依赖清单和用途。
  - prompt、截断策略、降级策略说明。
  - demo fixtures 和预期风险说明。
  - 已知限制和未来改进。

- demo 视频必须展示：
  - 公开仓库和 README。
  - PR 列表中多个小 PR 的持续提交记录。
  - Action workflow 配置。
  - 创建或更新测试 PR。
  - AI 总评论生成。
  - push 后总评论 update 而不是重复刷屏。
  - inline 评论或 file-level finding 的降级效果。
  - `.ai-pr-review.yml` 如何控制语言、数量、重点和排除文件。

## Assumptions

- 项目主形态是 GitHub Action，不做 Web 控制台。
- 技术栈是 Node.js + TypeScript。
- 使用真实 LLM API，API key 通过 GitHub Secrets 注入。
- 默认面向 TypeScript/React 项目，避免做泛泛的所有语言 reviewer。
- 默认总评论为中文，可通过 `language` 配置切换。
- 72 小时内不做复杂代码索引、跨 repo 知识库、聊天机器人、多平台 GitLab/Gitee 适配。
- 作品重点是工程完整度：上下文增强、配置系统、噪音控制、失败降级、PR 持续交付。