# 换个大脑：这套流程到底绑不绑定 Claude？

**结论先说：不绑定。GitHub Actions 是通用底座，AI 只是跑在上面的一个进程。**
而且对国内用户有个很实用的路子——**保留 Claude 那套成熟的胶水层，只把模型换成 Kimi 或 DeepSeek**。

---

## 一、先把分层看清楚

这套「@一下就自动修 bug 开 PR」的能力，其实是 5 层叠出来的：

```
┌──────────────────────────────────────────────┐
│ ① 触发层  GitHub 事件                          │  完全通用
│   issue_comment / pull_request / push / cron  │  任何厂商都用同一套
├──────────────────────────────────────────────┤
│ ② 执行层  GitHub Actions Runner               │  完全通用
│   就是一台临时 Ubuntu 虚拟机，能跑任何命令        │  海外机房，访问任何 API 都通
├──────────────────────────────────────────────┤
│ ③ 胶水层  xxx-code-action                     │  各家自己做 ← 差距主要在这
│   解析@提及 / 建分支 / commit / 开PR / 回评论    │
├──────────────────────────────────────────────┤
│ ④ Agent层  CLI 工具                           │  可换
│   claude / codex / gemini / qwen-code ...     │
├──────────────────────────────────────────────┤
│ ⑤ 模型层  实际推理的模型                        │  可换（关键）
│   Opus 5 / GPT / Gemini / Kimi K2 / DeepSeek  │
└──────────────────────────────────────────────┘
```

**你真正被「锁定」的只有第 ③ 层。** ①②是 GitHub 的，谁都一样；④⑤是可以拆开换的。

自己从零写第 ③ 层也不是不行——本质就是一段脚本：读 `github.event.comment.body` → 起分支 → 调模型 → `git commit` → `gh pr create`。
但成熟的胶水层帮你处理了一堆麻烦事：权限校验（防止路人 @ 一下就能改你代码）、进度评论、diff 上下文、超时控制、并发锁。所以一般不建议自己造。

---

## 二、四条现成的路

| | 胶水层 Action | 触发词 | 凭证 | 能改代码开PR | 备注 |
|---|---|---|---|---|---|
| **Anthropic** | `anthropics/claude-code-action@v1` | `@claude` | `CLAUDE_CODE_OAUTH_TOKEN` 或 `ANTHROPIC_API_KEY` | ✅ | 这条路最成熟，本仓库用的就是它 |
| **OpenAI** | `openai/codex-action`，或直接用 Codex 云端的 GitHub 集成 | `@codex` / `@codex review` | OpenAI 凭证 | ✅ | 云端集成可开「自动 review 每个 PR」；规约写在 `AGENTS.md` |
| **Google** | `google-github-actions/run-gemini-cli` | `@gemini-cli` | `GEMINI_API_KEY` | ✅ | beta，AI Studio 免费额度大方；`gemini` CLI 里跑 `/setup-github` 一键装 |
| **Kimi / DeepSeek** | **复用上面 Anthropic 那个 Action** | `@claude` | 各家自己的 API Key | ✅ | 见下一节，这是国内最省事的路 |

三家都有官方 Action，所以**「只有 Claude 家才行」是个误解**。
它们的差别不在能不能，而在胶水层的打磨程度、以及各自 CLI 的 agent 能力。

---

## 三、国内最实用的一招：Claude 的壳 + Kimi/DeepSeek 的脑

Kimi（月之暗面）和 DeepSeek **都专门提供了「Anthropic 兼容端点」**，就是为了让 Claude Code 能直接接上。
这意味着 `claude-code-action` 那套胶水层你可以原样保留，只需要多设两个环境变量。

`claude-code-action` 官方文档确认它会读取 `ANTHROPIC_BASE_URL`。

### DeepSeek

```yaml
      - uses: anthropics/claude-code-action@v1
        env:
          ANTHROPIC_BASE_URL: https://api.deepseek.com/anthropic
          ANTHROPIC_AUTH_TOKEN: ${{ secrets.DEEPSEEK_API_KEY }}
        with:
          claude_args: |
            --max-turns 25
```

### Kimi

```yaml
      - uses: anthropics/claude-code-action@v1
        env:
          # 国内用 .cn，海外用 https://api.moonshot.ai/anthropic
          ANTHROPIC_BASE_URL: https://api.moonshot.cn/anthropic
          ANTHROPIC_AUTH_TOKEN: ${{ secrets.MOONSHOT_API_KEY }}
        with:
          claude_args: |
            --max-turns 25
```

具体模型名（`ANTHROPIC_MODEL`）各家会随版本变，配之前去官方文档确认当前可用的型号：
- DeepSeek：https://api-docs.deepseek.com/guides/anthropic_api/
- Kimi：https://platform.kimi.ai/docs/guide/claude-code-kimi

### 几个要注意的点

1. **网络不是问题。** Runner 跑在 GitHub 的海外机房，它去访问 `api.deepseek.com` 或 `api.anthropic.com` 都直连，不涉及你本地的网络环境。
   换 Kimi/DeepSeek 的真实动机是**便宜**和**账号好办**（国内支付方式就能充值），不是为了绕网络。

2. **用 `ANTHROPIC_AUTH_TOKEN`，别用 `ANTHROPIC_API_KEY`。** 两个都设会冲突。

3. **这是「兼容」不是「官方支持」。** Anthropic 没有测试过这些组合。协议层是通的，但 agent 的实际表现——多轮工具调用的稳定性、长上下文处理、复杂重构的质量——会和原生 Claude 有差距。
   拿它跑「修个明确的 bug」这类任务通常没问题；跑大规模重构就要多盯着点。

4. **想彻底不依赖任何一家**，就用各自的原生方案（Codex 配 `openai/codex-action`，Gemini 配 `run-gemini-cli`），别走兼容层。

---

## 四、怎么选

- **你已经有 Claude Pro/Max 订阅** → 直接 `claude setup-token`，不额外花钱，能力最强。**本演练推荐这条。**
- **团队共用、要独立账单** → Anthropic API Key，或 Codex。
- **想省钱 / 只有国内支付方式** → DeepSeek 或 Kimi 兼容端点。
- **想要免费额度大** → Gemini（AI Studio 免费额度）。
- **重点是 PR review 而不是自动改代码** → Codex 的云端 GitHub 集成开箱即用，`@codex review` 就行。

**关键是：这几条路的工作流骨架完全一样。** 你在这个仓库里学会的 CI/CD + 触发 + review + merge + 自动部署，换任何一家都直接复用，只有 `.github/workflows/` 里那十几行需要改。
