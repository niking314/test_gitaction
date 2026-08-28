# 🏪 小卖部结算台 —— CI/CD + AI Agent 手机应急演练

一个刻意做小的真实项目，用来完整走一遍：

> **线上出事故 → 手机上 @一句话 → AI 开 PR → CI 自动验 → 手机上点 Merge → 自动重新上线**

全程不碰电脑。

**线上页面：https://niking314.github.io/test_gitaction/**

---

## 📖 文档（建议按顺序读）

| | 内容 |
|---|---|
| [01 · 基础概念](docs/01-concepts.md) | CI/CD 是什么、GitHub Actions 四层结构、事件驱动、权限与密钥 |
| [02 · 这个仓库有什么](docs/02-what-i-built.md) | 文件清单、四个工作流、**已真实运行的记录 + 那次失败的复盘** |
| [03 · 通知机制](docs/03-notifications.md) | 事故怎么找到你手机、默认机制的严重局限、生产环境该怎么补 |
| [04 · 演练手册](docs/04-runbook.md) | **完整分步操作**，从配密钥到验证恢复 |
| [05 · 接入实录](docs/05-integration-debug.md) | **真实鉴权调试全过程**：env 与 with 的区别、claude-code-action 架构剖析 |
| [06 · 代码跑在哪](docs/06-where-does-it-run.md) | **Jenkins vs GitHub Actions**：CI/CD 系统本身跑在哪、self-hosted runner、容器化 CD 示例、概念对照表 |
| [07 · git/GitHub 实操](docs/07-git-github-practice.md) | 分支与 PR 全流程、三种合并方式、`gh` 命令速查、网页端设置项地图、手机能做什么 |
| [附 · 换个大脑](docs/providers.md) | Claude / Codex / Gemini / Kimi / DeepSeek 对比与切换方式 |

## 🗂 代码结构

| 文件 | 作用 |
|---|---|
| `src/pricing.js` | 算钱的核心逻辑，事故就发生在这里 |
| `src/index.html` `src/app.js` | 结算页，直接部署，无构建步骤 |
| `test/pricing.test.js` | 单元测试，`node --test`，零依赖 |
| `.github/workflows/ci.yml` | **CI**：每个 PR 跑测试，就是 PR 上那个绿勾 |
| `.github/workflows/deploy.yml` | **CD**：合并到 main 自动部署到 GitHub Pages |
| `.github/workflows/claude.yml` | 在 issue/PR 里 @claude 触发它干活 |
| `.github/workflows/claude-review.yml` | 每个 PR 自动 code review |
| `CLAUDE.md` | 给 AI 的项目规约，CI 里的 AI 也会读 |

## 🏃 本地跑

```bash
node --test          # 跑测试（零依赖，8 秒）
npm run serve        # 起本地服务器看页面
```

## ✅ 当前状态

- CI / CD 链路 —— **已真实验证跑通**（CI ~8s，CD ~28s）
- AI 集成（DeepSeek）—— **已真实验证跑通**，冒烟测试 23s 通过
- 事故演练 —— 🔴 **进行中：线上正在算错钱**
