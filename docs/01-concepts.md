# 一、基础概念：CI/CD 和 GitHub Actions 到底是什么

> 读这篇不需要动手。目标是让你看懂 `.github/workflows/` 里那几个文件的每一行。

## 1. CI 和 CD 是两件事

很多人把 CI/CD 当一个词，其实是两个动作，中间隔着一个**人的决策**：

| | 全称 | 干什么 | 什么时候跑 | 出错了怎样 |
|---|---|---|---|---|
| **CI** | Continuous Integration<br>持续集成 | **验证**代码没坏：跑测试、跑 lint、编译 | 每次提交、每个 PR | 拦住，不让合并 |
| **CD** | Continuous Deployment<br>持续部署 | **发布**代码到线上 | 合并进主分支之后 | 线上没更新（或回滚） |

关键在于：**CI 是门禁，CD 是传送带。**

```
你改代码 → 开 PR ──[CI 跑测试]──→ ✅绿 → 人点 Merge → main ──[CD 部署]──→ 线上
                        └─ ❌红 → 合并按钮变灰，进不去
```

中间那个「人点 Merge」就是你在手机上做的事。**整套自动化的意义不是取消人的判断，而是把人的判断压缩到「看一眼 diff + 看一眼绿勾 + 点一下」**——这三件事手机完全能干。

## 2. GitHub Actions 的四层结构

```yaml
name: CI                    # ← Workflow（工作流）：一个 .yml 文件 = 一个工作流

on:                         # ← 触发条件：什么事件会启动它
  pull_request:
  push:
    branches: [main]

jobs:
  test:                     # ← Job（任务）：跑在一台独立的虚拟机上
    runs-on: ubuntu-latest  #    多个 job 默认并行，除非用 needs 声明依赖
    steps:                  # ← Step（步骤）：job 内部顺序执行
      - uses: actions/checkout@v4    # 用别人写好的 Action（复用组件）
      - run: node --test             # 或者直接跑 shell 命令
```

四个概念的关系：**Workflow ⊃ Job ⊃ Step**，Step 要么 `run` 一条命令，要么 `uses` 一个别人封装好的 Action。

几个容易踩的点：

- **每个 job 是一台全新的空白虚拟机。** job 之间不共享文件系统。所以 `deploy.yml` 里 `test` 和 `deploy` 是两台机器，`deploy` 要自己重新 checkout 代码。
- **`needs:` 是唯一的顺序保证。** 没写 `needs` 的 job 全部并行启动。我们的 `deploy` 写了 `needs: test`，所以测试不过它根本不启动。
- **`runs-on: ubuntu-latest`** 是 GitHub 免费提供的机器。公开仓库无限量免费；私有仓库免费账户每月 2000 分钟。

## 3. 事件驱动：这是「手机应急」的技术基础

`on:` 里能填的事件很多，跟我们相关的几个：

| 事件 | 什么时候触发 | 用途 |
|---|---|---|
| `push` | 代码推到某分支 | 跑 CI、触发部署 |
| `pull_request` | PR 开启/更新 | PR 门禁 |
| `issue_comment` | **有人在 issue 或 PR 下评论** | ← **@claude 就是靠这个** |
| `pull_request_review_comment` | 针对某一行代码的评论 | 行内 @ |
| `workflow_dispatch` | 网页/手机上手动点按钮 | 手动重跑、手动回滚 |
| `schedule` | cron 定时 | 定时巡检 |

**`issue_comment` 是整件事的关键。** 你在手机上敲一句 `@claude 修一下这个 bug`，本质上就是往 GitHub 发了个 comment 事件，触发一台云端虚拟机启动，把 AI 跑起来。

你的手机什么都没干——它只是发了条评论。所有计算都在 GitHub 的机房里。**这就是「把人从桌前解放」的物理原理：你不需要开发环境，因为开发环境在云端按需启动。**

## 4. 权限和密钥

```yaml
permissions:
  contents: write        # 能改代码、建分支
  pull-requests: write   # 能开 PR、写评论
  issues: write          # 能回 issue
  id-token: write        # OIDC 身份令牌（Pages 部署、云厂商免密登录要用）
  actions: read          # 能读其它工作流的日志
```

- **默认最小权限。** 不写 `permissions` 时用仓库默认值，通常是只读。要让 AI 改代码开 PR，必须显式给 `contents: write` + `pull-requests: write`。
- **`secrets.XXX`** 是仓库级加密变量，在 Settings → Secrets and variables → Actions 里配。日志里会自动打码。
- **`vars.XXX`** 是明文变量，适合放非敏感配置（比如 API 的 base URL）。
- **PR 来自 fork 时拿不到 secrets**——这是安全设计，防止陌生人提个 PR 就偷走你的密钥。所以开源项目的 AI 集成要额外小心。

## 5. 术语速查

| 词 | 意思 |
|---|---|
| Runner | 跑工作流的那台虚拟机 |
| Artifact | 工作流产出的文件，可以在 job 之间传递或下载 |
| Environment | 部署目标（如 `github-pages`），可以加审批门禁 |
| Concurrency | 并发控制，防止两次部署互相覆盖 |
| Status Check | PR 页面上那些绿勾红叉，来自各个 job |
| Branch Protection | 分支保护规则，可以强制「必须 CI 绿才能合并」 |

---

**下一篇** → [02-what-i-built.md](02-what-i-built.md)：这个仓库里我具体建了什么，以及已经验证过的运行结果。
