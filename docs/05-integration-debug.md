# 五、接入实录：一次真实的鉴权调试

> 这篇记录把 DeepSeek 接进 `claude-code-action` 的完整过程——**包括失败的那次**。
> 调试过程本身比结论更有价值，因为你以后换任何一家供应商都会遇到同类问题。

## 时间线

| 时刻 | 事件 | 结果 |
|---|---|---|
| 09:23 | 你把 `DEEPSEEK_API_KEY` 加进仓库密钥 | — |
| 09:25 | 我开 issue #1 发第一次冒烟测试 | ❌ **失败**，13.9s |
| 09:25→09:27 | 读日志、定位、查 DeepSeek 官方文档、改配置 | — |
| 09:27 | 第二次冒烟测试 | ✅ **成功**，23s |

## 第一次为什么失败

日志里的关键一行：

```
##[error]Action failed with error: Environment variable validation failed:
  - Either ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN, or workload identity
    federation (ANTHROPIC_FEDERATION_RULE_ID and ANTHROPIC_ORGANIZATION_ID)
    is required when using direct Anthropic API.
```

**注意一个反直觉的地方**：环境变量其实**传进去了**。同一份日志里能看到：

```
env:
  ANTHROPIC_BASE_URL: https://api.deepseek.com/anthropic
  ANTHROPIC_AUTH_TOKEN: ***
  ANTHROPIC_API_KEY:            ← 空的
```

`ANTHROPIC_AUTH_TOKEN` 明明在环境里。**但 Action 在启动 Claude Code CLI 之前，有一道自己的预检**，这道预检只认三样东西之一：`ANTHROPIC_API_KEY`、`CLAUDE_CODE_OAUTH_TOKEN`、或 WIF 那对变量。它不认识 `ANTHROPIC_AUTH_TOKEN`。

于是：**变量传对了，但程序根本没跑到用它的那一步。**

## 核心知识：`env:` 和 `with:` 是两条完全不同的路

这是整件事的关键，也是以后接任何供应商都要理解的：

```yaml
      - uses: anthropics/claude-code-action@v1
        env:                                  # ← 路 A：进程环境变量
          ANTHROPIC_BASE_URL: https://...     #    被 CLI 子进程继承
          ANTHROPIC_MODEL: deepseek-v4-pro    #    用来配置 CLI 的行为
        with:                                 # ← 路 B：Action 的「输入项」
          anthropic_api_key: ${{ secrets... }} #    GitHub 转成 INPUT_* 变量
          claude_args: --max-turns 25          #    Action 自己的代码读它、校验它
```

| | `env:` | `with:` |
|---|---|---|
| 本质 | 操作系统环境变量 | Action 声明的输入参数 |
| 谁读 | **最终的 CLI 子进程** | **Action 自己的 TypeScript 代码** |
| 何时生效 | CLI 启动后 | CLI 启动**之前**（含预检） |
| 能传什么 | 任意变量 | 只能是 `action.yml` 里声明过的名字 |

`action.yml` 里的这行说明了两者的关系：

```yaml
ANTHROPIC_API_KEY: ${{ inputs.anthropic_api_key || env.ANTHROPIC_API_KEY }}
```

**输入项优先，环境变量兜底。** 我第一次两边都没给 `ANTHROPIC_API_KEY`，所以它是空的，预检就挂了。

> 🔑 **通用教训**：一个 Action 失败时，先分清是**它自己的校验**挂了，还是**它调用的程序**挂了。
> 前者要改 `with:`，后者要改 `env:`。这两个搞混会让你在错误的地方反复试。

## 怎么修的

先去查 DeepSeek 官方文档，确认它的兼容端点接受哪种鉴权头。文档里的 HTTP Header 兼容表写着：

> `x-api-key`: **Fully Supported**

Claude Code 在用 `ANTHROPIC_API_KEY` 时发的正是 `x-api-key` 头。所以把密钥从 `env` 挪到 `with` 就能同时满足两边：

```diff
       - uses: anthropics/claude-code-action@v1
         env:
           ANTHROPIC_BASE_URL: https://api.deepseek.com/anthropic
-          ANTHROPIC_AUTH_TOKEN: ${{ secrets.DEEPSEEK_API_KEY }}
+          ANTHROPIC_MODEL: deepseek-v4-pro
+          ANTHROPIC_DEFAULT_OPUS_MODEL: deepseek-v4-pro
+          ANTHROPIC_DEFAULT_SONNET_MODEL: deepseek-v4-pro
+          ANTHROPIC_DEFAULT_HAIKU_MODEL: deepseek-v4-flash
+          CLAUDE_CODE_SUBAGENT_MODEL: deepseek-v4-flash
         with:
+          anthropic_api_key: ${{ secrets.DEEPSEEK_API_KEY }}
           claude_args: |
             --max-turns 25
```

**两处改动，各自解决一个问题：**

1. **密钥挪进 `with:`** → 过了 Action 的预检，同时 CLI 会用 `x-api-key` 头发给 DeepSeek（该端点完全支持）
2. **补上模型映射** → DeepSeek 虽然会自动把 Claude 型号名映射过去（Opus→`deepseek-v4-pro`，Haiku/Sonnet→`deepseek-v4-flash`），但显式指定更可控。
   `ANTHROPIC_DEFAULT_HAIKU_MODEL` 尤其别漏——Claude Code 会用一个「小快模型」跑后台杂活，不指定的话行为不受你控制。

## claude-code-action 到底是什么？是 agent harness 吗？

**准确的说法：它不是 harness 本身，而是 harness 的「运行时外壳 + 权限沙箱 + GitHub 适配器」。**

真正的 agent harness——agent loop、上下文管理、工具执行——在 **Claude Code CLI** 里。这个 Action 干的是把 CLI 塞进 CI 环境并管住它。

从日志里能直接看到它做的五件事：

### ① 收紧工具权限（最重要的一层）

```
ALLOWED_TOOLS: Glob,Grep,LS,Read,
               mcp__github_comment__update_claude_comment,
               Bash(git add:*),Bash(git commit:*),
               Bash(.../git-push.sh:*),Bash(git rm:*)
DISALLOWED_TOOLS: WebSearch,WebFetch
```

注意这个白名单有多窄：

- Bash **不是**放开的，只允许 `git add` / `git commit` / `git rm` 和一个**包装过的** `git-push.sh`
- 联网工具（WebSearch/WebFetch）直接被禁
- 你在本地 Claude Code 里能用的 Edit/Write 等工具，在这个模式下按需授予

**这就是为什么「让 AI 在 CI 里改代码」是可控的**——它拿到的不是一台想干嘛干嘛的机器，而是一个被削到只剩必要动作的工具集。

### ② 注入 GitHub 上下文

把 issue 正文、评论历史、PR diff、仓库信息整理成 prompt 喂给 CLI。你在 issue 里写的话，就是这么进去的。

### ③ 用 MCP server 回写 GitHub

`mcp__github_comment__update_claude_comment` 这个工具名说明它挂了一个 MCP server 专门负责更新那条进度评论。
所以你看到的「Claude finished @niking314's task in 23s」是通过 MCP 工具调用写回来的，不是 agent 自己去调 REST API。

### ④ 管理 git 分支与提交

自动起 `claude/issue-1-20260828-0925` 这种分支名、提交、推送、开 PR。推送走的是包装脚本，不是裸 `git push`。

### ⑤ 凭证生命周期

跑完立刻 revoke 掉 GitHub App token：

```
curl -X DELETE .../installation/token || true
```

处理不可信内容时还会装 `bubblewrap` + `socat` 做子进程隔离和环境擦洗。

### 一句话总结

```
Claude Code CLI  =  agent harness（loop / 上下文 / 工具执行）
claude-code-action  =  把它装进 CI + 喂上下文 + 锁权限 + 写回 GitHub + 管凭证
```

**换供应商时，你换的是 CLI 背后的模型，harness 和外壳都不变。**
这也解释了为什么 DeepSeek 能接上——它只需要在 HTTP 层伪装成 Anthropic Messages API，上面所有机制都感知不到差别。

## 第二次冒烟测试的结果

23 秒完成，三问全对：

- `calculateDiscount()` 的分支数——答对了 3 个主分支加兜底，**并且主动指出满减券内部的三元判断可以再拆成「达标/未达标」两个子分支**
- 测试用例数——6 个，全部列出
- `CLAUDE.md` 第一条铁律——原文引用准确

而且它**遵守了「只读不写」的约束**，没有建分支、没有开 PR。

> 那个「满减券内部还能再拆两个子分支」的观察，恰好指向了下一步事故的位置——
> **未达标那条子分支正是没有测试覆盖的那条**。它只是在回答问题，还没意识到那里有雷。

## 可复用的排查套路

以后接任何供应商，按这个顺序查：

1. **看 Action 自己的报错**，不是 CLI 的报错。`##[error]Action failed with error:` 开头的那条最关键。
2. **在日志的 `env:` 块里确认变量到底有没有传进去**——传没传进去，和有没有被用上，是两个问题。
3. **分清是预检挂了还是运行时挂了**。预检挂 → 改 `with:`；运行时挂（401/404/模型名错）→ 改 `env:`。
4. **去供应商文档查 HTTP Header 兼容性**，别猜。`x-api-key` 和 `Authorization: Bearer` 是两套东西。
5. **冒烟测试要「只读」**。先证明链路通，再让它动代码。链路没通就派活，你会分不清是工具坏了还是活干砸了。

---

**上一篇** → [04-runbook.md](04-runbook.md) · **下一步**：正式开始事故演练。
