# 二、这个仓库里有什么 · 已经验证到哪一步

## 1. 仓库地址

| | |
|---|---|
| 代码 | https://github.com/niking314/test_gitaction （public） |
| **线上页面** | **https://niking314.github.io/test_gitaction/** |
| 可见性 | Public —— 这样 Pages 和 Actions 都是完全免费无限量 |

## 2. 文件清单

```
test_gitaction/
├── src/                       ← 这个目录整个就是网站根目录，没有构建步骤
│   ├── index.html             结算页界面（手机优先，支持深色模式）
│   ├── app.js                 页面交互 + 线上兜底自检
│   └── pricing.js             ★ 算钱的核心逻辑，事故将发生在这里
├── test/
│   └── pricing.test.js        6 个单元测试，零依赖（node:test）
├── .github/workflows/
│   ├── ci.yml                 CI：PR 门禁
│   ├── deploy.yml             CD：合并即上线
│   ├── claude.yml             @提及 → AI 干活
│   └── claude-review.yml      每个 PR 自动 code review
├── docs/                      你正在读的文档
├── CLAUDE.md                  ★ 给 AI 看的项目规约
└── package.json               只声明 scripts，没有任何依赖
```

### 为什么零 npm 依赖

用 Node 24 自带的 `node --test`，不装任何包。好处：

- CI 跑 **8 秒**（不用 `npm install`）
- 永远不会因为依赖更新而莫名其妙挂掉
- 你不用先理解 npm 生态就能看懂整个流程

### `src/pricing.js` —— 事故现场

三条计价规则：

```
小计 = Σ(单价 × 数量)
优惠 = SAVE20 满100减20 ／ HALFOFF 五折 ／ 无券则 0
运费 = 小计 ≥ 99 包邮，否则 12 元
应付 = 小计 − 优惠 + 运费
```

### `CLAUDE.md` —— 一个容易被忽略的关键文件

这个文件**会被 CI 里的 AI 读到**。它相当于你留给远程同事的工作守则：

- 不许引入 npm 依赖
- 改 `pricing.js` 必须补测试
- **修 bug 时先写一个能复现的失败测试，再修代码**
- PR 描述要写「现象 → 根因 → 改法 → 新增测试」，用中文

> Codex 用的是同名不同文件的 `AGENTS.md`，Gemini 用 `GEMINI.md`。概念完全一样。
> **这是提升 AI 产出质量性价比最高的地方**——与其在 issue 里反复解释项目规矩，不如写进这个文件一次。

## 3. 四个工作流分别干什么

| 文件 | 触发 | 干什么 | 现在能用吗 |
|---|---|---|---|
| `ci.yml` | 每个 PR、每次 push main | 跑 `node --test` + 检查产物完整 | ✅ **已验证** |
| `deploy.yml` | push 到 main | 先跑测试，过了才部署到 Pages | ✅ **已验证** |
| `claude.yml` | 评论里出现 `@claude` | AI 读代码、改代码、开 PR | ⏸ 等配密钥 |
| `claude-review.yml` | PR 开启/更新 | AI 自动 review | ⏸ 等配密钥 |

`deploy.yml` 里有两个细节值得注意：

```yaml
  deploy:
    needs: test        # ← 测试不过，部署 job 根本不会启动
```
```yaml
concurrency:
  group: pages
  cancel-in-progress: false    # ← 两次合并挨得近时排队，不会互相覆盖
```

还有一个专门为「手机验证」加的：部署时把提交号写进 `version.json`，页面顶部会显示。
**你在手机上刷新后，看那个号变了没有，就知道新版本是不是真上线了**——不用去翻 Actions 日志。

## 4. 已经真实跑过的记录

我不是写完就交差，是真的推上去跑了。全部记录：

| 时间 (UTC) | 提交 | CI | Deploy |
|---|---|---|---|
| 08:20:59 | `331a65a` 初始版本 | ✅ 9s | ❌ **21s 失败** |
| 08:21:56 | `d515392` 修复 | ✅ 8s | ✅ 30s |
| 08:24:25 | `74db427` 加文档 | ✅ | ✅ |

线上现状：`HTTP 200`，`version.json` 显示 `74db427`，和 main HEAD 一致。**链路是通的。**

## 5. 那次失败的完整复盘（你收到邮件的那个）

**现象**：第一次推送后，CI 绿了，Deploy 红了。

**日志原文**：
```
##[error]Get Pages site failed. Please verify that the repository has
Pages enabled and configured to build using GitHub Actions
##[error]HttpError: Not Found
```

**根因**：顺序问题。我先 `git push`（工作流立刻自动启动），**之后**才调 API 启用 GitHub Pages。
部署 job 跑到 `actions/configure-pages` 那一步时去问「这仓库的 Pages 站点在哪」，GitHub 回 404——因为那一刻还没有。

**改法**：给 `configure-pages` 加一行，让它自己去开：

```yaml
      - uses: actions/configure-pages@v5
        with:
          enablement: true   # 仓库没开 Pages 的话自动开
```

**为什么这样改而不是「我手动点一下就完了」**：手动点只解决我这一次。加了这行，你以后把这套工作流复制到任何新仓库，都不用记得去 Settings 里点 Pages。**把一次性的人工操作变成代码，这本身就是 CI/CD 的核心思想。**

**顺带一提**，日志里还有一条无害的提示：
```
Node 20 is being deprecated. This workflow is running with Node 24 by default.
```
这是 GitHub 在提醒 Action 作者升级运行时，不影响我们，不用管。

## 6. 这次失败其实是个好事

它让你**在真事故之前，先体验了一遍完整的事故响应流程**：

```
收到失败邮件 → 打开 Actions 看日志 → 定位根因 → 改 → 推 → 变绿
```

而且它暴露了一个真实教训：**CI 绿 ≠ 一切正常**。
这次是 CI 绿、CD 红（至少红了你能看见）。接下来的演练要给你看更危险的一种：**CI 绿、CD 也绿、但线上是错的**——因为测试没覆盖到。那才是真正难受的事故。

---

**下一篇** → [03-notifications.md](03-notifications.md)：事故是怎么找到你手机的。
