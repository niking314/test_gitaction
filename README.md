# 🏪 小卖部结算台 —— CI/CD + @claude 手机应急演练

一个刻意做小的真实项目，用来完整走一遍：

> **线上出事故 → 手机上 @claude → 它开 PR → CI 自动验 → 手机上点 Merge → 自动重新上线**

全程不碰电脑。

## 这个仓库里有什么

| 文件 | 作用 |
|---|---|
| `src/pricing.js` | 算钱的核心逻辑，事故就发生在这里 |
| `src/index.html` `src/app.js` | 结算页，直接部署，无构建步骤 |
| `test/pricing.test.js` | 单元测试，`node --test`，零依赖 |
| `.github/workflows/ci.yml` | **CI**：每个 PR 跑测试，就是 PR 上那个绿勾 |
| `.github/workflows/deploy.yml` | **CD**：合并到 main 自动部署到 GitHub Pages |
| `.github/workflows/claude.yml` | 在 issue/PR 里 @claude 触发它干活 |
| `.github/workflows/claude-review.yml` | 每个 PR 自动 code review |
| `CLAUDE.md` | 给 Claude 的项目规约，CI 里的 Claude 也会读 |

## 本地跑

```bash
node --test          # 跑测试
npm run serve        # 起本地服务器看页面
```

## 完整演练步骤

见 [`docs/手机应急演练.md`](docs/手机应急演练.md)。
