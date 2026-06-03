# Context-Aware AI PR Reviewer

中文 | [English](./README.md)

一个 TypeScript GitHub Action 项目，用于基于结构化 AI 输出生成 Pull Request 评审摘要。

当前仓库已经包含：

- diff 过滤、截断、review context、LLM 解析、摘要 upsert，以及 inline 失败降级等模块
- 打包后的 GitHub Action 入口 [`action.yml`](./action.yml)
- 已实现评审流程对应的单元测试与 demo fixtures

当前仓库已经接入默认的 GitHub Action 运行时，用于处理 GitHub `pull_request` events。默认入口会从 GitHub Actions 环境中读取事件上下文，使用 `GITHUB_TOKEN` 获取变更文件和 patch，构建 `PullRequestContext`，然后进入现有评审流水线。本文档只描述当前已经实现的行为。

## 这个项目是什么

这是一个面向 TypeScript 场景的、具备上下文感知能力的 PR reviewer。当前已实现的流程如下：

1. 在 GitHub `pull_request` events 上，读取 `GITHUB_EVENT_NAME` 和 `GITHUB_EVENT_PATH`
2. 从 `.ai-pr-review.yml` 读取 reviewer 配置，若缺失则使用默认值
3. 使用 `GITHUB_TOKEN` 读取 PR 元数据，并获取变更文件与 patch
4. 构建 `PullRequestContext`
5. 过滤不可评审文件，并对过大的 patch 做截断
6. 为 LLM 构建结构化 review context
7. 向 LLM 请求结构化 JSON
8. 在发布任何内容之前先解析并校验 JSON
9. 以 upsert 方式发布确定性的 PR 摘要评论
10. 仅对那些已经过新增 patch 行校验的 finding 尝试发布 inline 评论
11. 当 inline 发布失败时，安全降级回摘要评论

## 这个项目不是什么

这个项目不是静态分析工具，也不是仓库策略工具的替代品。

`ESLint`
: 用于在源文件内部捕获基于规则的代码风格问题和 bug 模式。这个项目则是基于 PR 上下文做评审，并发布人类可读的摘要评论。

`TypeScript`
: 用于在编译期捕获类型系统问题。这个项目是它的补充，关注的是变更代码、patch 上下文以及更高层次的风险信号。

`CodeQL`
: 用于对整个代码库执行语义和安全分析。这个项目更窄，只面向 PR，生成的是 AI finding，而且发布前仍然必须经过校验。

`reviewdog`
: 是对现有 linter / analyzer 输出进行分发和编排的传输层。这个项目会生成自己的结构化 AI 评审摘要，而不是转发第三方 linter 输出。

它们之间更合适的关系是互补：

- 保留 `TypeScript`、`ESLint` 和 `CodeQL` 作为确定性门禁
- 使用本 Action 为变更代码提供上下文感知的评审摘要
- 如果你想分发 linter 输出，请使用 `reviewdog`；如果你想增加 AI 生成的 PR review 层，请使用本项目

## 当前能力边界

目前已经实现：

- 面向 GitHub `pull_request` events 的默认运行时启动流程
- 基于固定 marker 的摘要评论 upsert
- 仓库级 `.ai-pr-review.yml` 配置加载
- 基于 `GITHUB_EVENT_NAME` 和 `GITHUB_EVENT_PATH` 的运行时 PR 上下文收集
- 基于 `GITHUB_TOKEN` 的变更文件拉取
- 针对 deleted、missing-patch、generated、lock、minified、docs-only 以及配置排除文件的 diff 过滤
- patch 截断元数据
- review context 构建
- OpenAI 请求 / 超时 / 限流 / 失败处理
- 发布前的结构化 JSON 解析与校验
- 基于新增 patch 行的 inline candidate 校验
- inline 发布失败后回落到摘要评论
- 四个小型 PR 风险模式的 demo fixtures

当前运行时尚未实现：

- 对 GitLab、Gitee 或其他非 GitHub 平台的支持
- 已录制的 demo 视频产物
- 超出当前 `package.json` 之外的额外包依赖

## 仓库结构

实现遵循 [`AGENTS.md`](./AGENTS.md) 中定义的模块边界：

```text
src/
  main.ts
  github/
  config/
  diff/
  context/
  llm/
  review/
  utils/
test/
demo/
docs/
```

架构细节：[`docs/architecture.md`](./docs/architecture.md)

Demo 走查：[`docs/demo-guide.md`](./docs/demo-guide.md)

## 安装与本地验证

前置要求：

- Node.js 20 或更高版本
- npm

安装依赖：

```bash
npm install
```

运行测试：

```bash
npm test
```

构建：

```bash
npm run build
```

如果在当前 Windows 环境里 PowerShell 阻止 `npm.ps1`，请改用：

```bash
npm.cmd test
npm.cmd run build
```

## GitHub Action 打包方式

该仓库被打包为一个 Node 20 GitHub Action：

- action metadata：[`action.yml`](./action.yml)
- 构建后的入口：`dist/src/main.js`
- action inputs：`openai_api_key`、`llm_api_url`、`llm_model`

当前 action metadata：

```yml
name: Context-Aware AI PR Reviewer
description: Minimal TypeScript GitHub Action scaffold for pull request review startup.
inputs:
  openai_api_key:
    description: OpenAI API key for summary-only AI review
    required: false
  llm_api_url:
    description: Optional API URL override for OpenAI-compatible providers
    required: false
  llm_model:
    description: Optional model override for OpenAI-compatible providers
    required: false
runs:
  using: node20
  main: dist/src/main.js
```

重要限制：

- 打包后的 action 通过 `dist/src/main.js` 构建并运行
- 默认运行时只面向 GitHub `pull_request` events
- 非 `pull_request` events 会被安全跳过
- 如果事件 payload 数据缺失、事件 payload JSON 无效，或缺少 `GITHUB_TOKEN`，则无法收集 PR 上下文，并会以明确方式失败

## Workflow 示例

消费者仓库中的 workflow 示例：

```yml
name: AI PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ai-pr-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run reviewer
        uses: your-org/ai-pr-review-assistant@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

OpenAI-compatible provider 覆盖示例：

```yml
      - name: Run reviewer with a compatible provider
        uses: your-org/ai-pr-review-assistant@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          LLM_API_URL: https://api.compatible-provider.example/v1/chat/completions
          LLM_MODEL: compatible-model-name
```

这两个覆盖项都是可选的。不设置时，运行时仍默认使用 OpenAI Chat Completions URL 和默认模型 `gpt-4.1-mini`。`OPENAI_API_KEY` 的认证行为保持不变。

为什么需要 `pull-requests: write`：

- 发布摘要使用的是 PR 上的 issue comments
- 发布 inline 使用的是 pull request review comments

为什么需要 `contents: read`：

- 运行时需要从 GitHub event 和 API 中读取 PR 元数据与变更文件上下文

## Reviewer 配置

仓库级配置文件：`.ai-pr-review.yml`

如果该文件不存在，项目会使用 [`src/config/schema.ts`](./src/config/schema.ts) 中的默认值：

```yml
language: zh-CN
max_files: 20
max_patch_chars_per_file: 6000
include_full_file_context: false
exclude:
  - dist/**
  - build/**
  - coverage/**
  - node_modules/**
  - package-lock.json
  - pnpm-lock.yaml
  - yarn.lock
  - "*.min.js"
  - "*.min.css"
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

配置文件示例：

```yml
language: zh-CN
max_files: 10
max_patch_chars_per_file: 4000
include_full_file_context: false
exclude:
  - vendor/**
  - snapshots/**
review:
  severity_threshold: medium
  max_inline_comments: 3
  confidence_threshold: 0.8
  focus:
    - bug-risk
    - security
    - react-hooks
```

当前支持的字段：

- `language`
- `max_files`
- `max_patch_chars_per_file`
- `include_full_file_context`
- `exclude`
- `review.severity_threshold`
- `review.max_inline_comments`
- `review.confidence_threshold`
- `review.focus`

当前已实现的校验规则：

- 未知的顶层字段或 `review.*` 字段会导致校验失败
- `max_files` 和 `max_patch_chars_per_file` 必须是正整数
- `include_full_file_context` 必须是布尔值
- `exclude` 和 `review.focus` 必须是由非空字符串组成的数组
- `review.max_inline_comments` 必须是非负整数
- `review.confidence_threshold` 必须位于 `0` 到 `1` 之间
- 用户自定义 `exclude` 会叠加合并到默认排除规则之上

当前的 exclude 匹配能力刻意限制在 [`src/diff/filterFiles.ts`](./src/diff/filterFiles.ts) 已实现的范围内：

- 精确路径匹配
- 以 `/**` 结尾的目录前缀模式
- 形如 `*.ext` 的后缀模式

它并没有实现完整的 glob 引擎。

## Secrets 配置

当前运行时从环境变量中读取以下 secrets：

- `GITHUB_TOKEN`
- `OPENAI_API_KEY`
- action input 回退环境变量：`INPUT_OPENAI_API_KEY`
- 可选 provider URL 覆盖：`LLM_API_URL`、`INPUT_LLM_API_URL`
- 可选 model 覆盖：`LLM_MODEL`、`INPUT_LLM_MODEL`

GitHub 中推荐的配置方式：

1. 使用内置的 `${{ secrets.GITHUB_TOKEN }}` 进行 GitHub 评论发布
2. 创建名为 `OPENAI_API_KEY` 的仓库 secret
3. 在 workflow step 的环境变量中暴露这两个值

运行时要求：

- 默认运行时会读取 `GITHUB_EVENT_NAME`
- 只有 GitHub `pull_request` events 才会进入评审流程
- `pull_request` events 需要 `GITHUB_EVENT_PATH`
- `GITHUB_TOKEN` 是获取变更文件和 patch 的必需项
- `OPENAI_API_KEY` 是生成 AI review 的必需项，除非你接受一个 AI-skipped 的摘要状态

关于 fork pull request 的预期行为：

- fork PR 上可能拿不到 OpenAI secrets
- 这种情况下，LLM client 会返回一个安全的 `missing_api_key` skip 结果
- 摘要会报告 skip / degraded 状态，而不会发布原始模型输出

## 处理策略

### Prompt 策略

[`src/llm/client.ts`](./src/llm/client.ts) 中的 OpenAI client 当前会：

- 发送一条强制要求仅输出 JSON 的 system instruction
- 为 `summary_findings` 和 `inline_findings` 提供固定 schema 形状
- 将拼装好的 review context 作为 user message 发送
- 请求 `response_format.type = json_object`
- 默认使用 `gpt-4.1-mini` 模型，除非通过 `LLM_MODEL` 或 `INPUT_LLM_MODEL` 覆盖
- 默认使用 OpenAI Chat Completions URL，除非通过 `LLM_API_URL` 或 `INPUT_LLM_API_URL` 覆盖

Prompt 策略刻意保持保守：

- 要求模型不要把 JSON 包在 markdown code fence 里
- 要求模型不要编造不存在的文件或运行时行为
- 让 review focus 严格受配置与 context 元数据约束

### 截断策略

diff 层会在构建 review context 之前，对过大的 patch 按文件进行截断。

当前已实现的行为：

- 每个被纳入评审的文件最多保留 `max_patch_chars_per_file`
- 每个文件的截断元数据会被保留下来
- 摘要评论会报告哪些文件发生了截断
- review context 元数据会记录截断说明

本仓库并不声称具备 token-aware truncation 或语义分块能力。当前实现基于字符数。

### 故障降级策略

当前已实现的降级规则：

- 非 `pull_request` event：安全跳过，不进入评审流程
- `pull_request` event 缺少 `GITHUB_EVENT_PATH`：明确失败
- GitHub event payload JSON 无效：明确失败
- `pull_request` event 缺少 PR payload 元数据：明确失败
- PR 上下文收集阶段缺少 `GITHUB_TOKEN`：明确失败
- 缺少 OpenAI API key：将 AI review 标记为 `skipped`
- 超时、限流、provider 返回无效结果或请求失败：将 AI review 标记为 `degraded`
- 结构化 JSON 格式错误或无效：丢弃原始模型输出并安全降级
- 无法匹配的 inline finding：降级到摘要输出
- inline 发布失败：将对应的 finding 降级到摘要输出

核心安全规则很简单：

- 永远不会发布原始模型输出
- 只有通过校验的 summary findings 才会作为 AI finding 展示
- 只有通过 snippet 到新增行校验后，才会尝试发布 inline comments

## 摘要 Upsert 行为

摘要发布使用固定 marker：

```html
<!-- ai-pr-review-assistant -->
```

摘要发布器会：

- 列出当前 PR 的 issue comments
- 找到包含该 marker、且由 bot 发布的评论
- 如果存在则更新
- 如果不存在则创建一条新的摘要评论

这样可以在摘要评论这一层保持重复运行的幂等性。

## Inline Comment 边界

Inline 发布属于后续阶段增强能力，但目前已经有一部分实现。

当前已实现：

- inline candidate 必须匹配到变更文件中的新增 patch 行
- 低置信度或无法匹配的 finding 会被降级
- 如果某个已校验 finding 的 GitHub inline 发布失败，该 finding 会被降级，而不是让整个 Action 失败

本文档没有声明：

- 每一个有效 finding 都一定能成功发布 inline
- 多行 inline range
- 超出当前“新增行匹配 + 单条评论发布尝试”之外的行为

## 仓库中的原始项目代码与第三方依赖

仓库中的原始项目代码包括：

- `src/config/*`
- `src/context/*`
- `src/diff/*`
- `src/github/*`
- `src/llm/*`
- `src/review/*`
- `src/utils/*`
- `src/main.ts`
- `test/*`
- `demo/fixtures/*`

来自 `package.json` 的第三方包包括：

- `yaml`
  - 用于解析 `.ai-pr-review.yml` 的运行时依赖
- `typescript`
  - 用于构建 action 的编译器
- `vitest`
  - 用于单元测试和 fixture 校验测试的测试运行器
- `@types/node`
  - Node.js 的 TypeScript 类型定义

已实现流程依赖的外部服务包括：

- GitHub REST API，用于 issue comments 和 pull request review comments
- OpenAI Chat Completions API，用于结构化 review 生成

## Demo Fixtures

[`demo/fixtures`](./demo/fixtures) 下可用的 fixtures：

- `pr-1-auth-bug`
- `pr-2-react-effect-bug`
- `pr-3-error-handling`
- `pr-4-token-storage`

每个 fixture 都包含：

- 一个 `.diff` 文件
- 一个对应的 `.expected.json`

这些 fixtures 由 [`test/unit/fixtures/demoFixtures.test.ts`](./test/unit/fixtures/demoFixtures.test.ts) 负责校验。

Demo 使用说明：[`docs/demo-guide.md`](./docs/demo-guide.md)

## 风险与限制

- 当前运行时只支持 GitHub `pull_request` events。
- 非 `pull_request` events 会按设计被跳过。
- 缺少 `GITHUB_EVENT_PATH`、事件 payload 无效，或缺少 `GITHUB_TOKEN` 时，无法收集 PR 上下文，并会明确失败。
- 当前 exclude 匹配能力是有意收窄的，不是完整的 glob 实现。
- full file context 是可选能力，并受显式安全限制保护。
- 当前 full-file-context 模式还依赖于提供 file reader。
- inline comments 依赖于对新增 patch 行的精确 snippet 匹配。
- provider 侧的 AI 质量无法保证；仓库当前只保证解析 / 校验，以及围绕这些结果的安全降级行为。
- 仓库当前只支持 GitHub。

## 后续改进方向

这些内容目前尚未实现：

- 更完整的 workflow 打包，便于直接被消费方使用
- 更丰富的排除规则匹配
- 更高级的 prompt / token 预算控制
- 更完善的 demo 自动化或录制 demo

## 文档导航

- 项目概览与安装说明：[`README.md`](./README.md)
- 模块边界与数据流：[`docs/architecture.md`](./docs/architecture.md)
- demo 场景与检查清单：[`docs/demo-guide.md`](./docs/demo-guide.md)
