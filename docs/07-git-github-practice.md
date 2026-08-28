# 七、git 与 GitHub 实操：从改代码到合并上线

> 面向「知道有这些东西但没怎么实操过」的人。
> 全部用本仓库的真实例子，你可以照着敲。

---

## 第一部分：git 的心智模型

### 四个地方，代码在它们之间流动

```
┌──────────┐  git add   ┌──────────┐  git commit ┌──────────┐  git push  ┌──────────┐
│  工作区   │ ─────────▶ │  暂存区   │ ──────────▶ │ 本地仓库  │ ─────────▶ │ 远程仓库  │
│ 你正在改  │            │ 准备提交  │             │ 提交历史  │            │  GitHub  │
│  的文件   │ ◀───────── │  的内容   │             │          │ ◀───────── │          │
└──────────┘  git restore└──────────┘             └──────────┘  git pull  └──────────┘
```

**为什么要有「暂存区」这个多余的东西**？因为它让你能把一次杂乱的修改**拆成几个干净的提交**：

```bash
# 你同时改了 bug 和文档，但想分成两个提交
git add src/pricing.js          # 只暂存代码
git commit -m "fix: 修复满减券门槛判断"
git add docs/                   # 再暂存文档
git commit -m "docs: 补充计价规则说明"
```

**一个提交只做一件事**——这不是洁癖，是为了出事时能精确回滚、能看懂历史。

### 最常用的几条命令

```bash
git status                  # 现在什么情况（最常敲的一条）
git diff                    # 我改了什么（还没 add 的）
git diff --staged           # 我暂存了什么（add 了还没 commit 的）
git log --oneline -10       # 最近 10 条提交
git add .                   # 暂存所有改动
git commit -m "说明"         # 提交
git push                    # 推到 GitHub
git pull                    # 拉别人的改动下来
```

### 查「这行代码是谁什么时候改的」

这是排查事故的核心技能。刚才那次事故就能这么查：

```bash
# 看某个文件的完整改动历史（带 diff）
git log -p src/pricing.js

# 看每一行分别是哪次提交、哪个人写的
git blame src/pricing.js

# 只看提交列表 + 作者
git log --format='%h  %an  %ar  %s' src/pricing.js
```

在我们仓库里跑最后一条，你会看到：

```
ba90b79  zhangwei  x minutes ago  fix: 修复用户反馈的满减券不生效问题
331a65a  wangkang  x hours ago    初始版本：结算页 + CI/CD + Claude 工作流
```

**一眼就看出是 `ba90b79` 那次改的**。这就是为什么 `claude.yml` 里我写了 `fetch-depth: 0`——给它完整历史，它才能这么查。

---

## 第二部分：分支与 PR 的完整流程

### 为什么要开分支

`main` 是「线上正在跑的代码」。你直接在 main 上改，改到一半的半成品就会被部署上线。
**分支 = 一个隔离的工作区**，你在里面随便改，改好了再一次性合回去。

### 标准的一次开发，从头到尾

```bash
# ① 先同步最新的 main（很重要，不然容易冲突）
git checkout main
git pull

# ② 从 main 开一个新分支
git checkout -b fix/coupon-threshold
#   ↑ -b 是 branch，创建并切过去
#   分支名的常见约定：fix/xxx、feat/xxx、docs/xxx、chore/xxx

# ③ 改代码……然后提交
git add src/pricing.js test/pricing.test.js
git commit -m "fix: 满减券恢复门槛判断

现象：9.9 元的订单用 SAVE20 也减了 20，应付变成 1.9 元。
根因：ba90b79 去掉了 subtotal >= threshold 判断。
改法：恢复门槛判断。
测试：新增「未达门槛不减免」用例，该用例在旧代码上会失败。"

# ④ 推到 GitHub（第一次推新分支要 -u）
git push -u origin fix/coupon-threshold

# ⑤ 开 PR
gh pr create --fill
```

### 提交信息怎么写

**第一行是标题**（50 字以内，说清「做了什么」），**空一行**，然后是正文（说清「为什么」）。

```
fix: 满减券恢复门槛判断
↑    ↑
类型  一句话说清做了什么

（空行）

现象 → 根因 → 改法 → 测试
```

常见类型前缀：`fix`（修 bug）、`feat`（新功能）、`docs`（文档）、`refactor`（重构）、`test`（测试）、`chore`（杂活）。

**为什么值得讲究**：三个月后线上出事，你 `git log` 翻历史，那些写着「update」「fix bug」「修改」的提交等于没写。

### PR 的生命周期

```
开分支 → 提交 → push → 开 PR
                          ↓
                    ┌─────────────┐
                    │ CI 自动跑    │ ← 绿勾/红叉出现在 PR 页面
                    └──────┬──────┘
                           ↓
                    ┌─────────────┐
                    │ 有人 review  │ ← 提意见 / Approve
                    └──────┬──────┘
                           ↓
                  改 → 再 push（PR 自动更新，不用重开）
                           ↓
                       点 Merge
                           ↓
                   CD 自动部署上线
                           ↓
                     删掉那个分支
```

**关键点：PR 是「活的」。** push 新提交到同一个分支，PR 会自动更新，CI 重新跑。不需要关掉重开。

### 三种合并方式（这个最容易搞混）

点 Merge 时 GitHub 给你三个选项：

| 方式 | main 上会出现什么 | 什么时候用 |
|---|---|---|
| **Create a merge commit** | 你分支上的**所有提交** + 一个合并提交 | 想保留完整开发过程 |
| **Squash and merge** | **把所有提交压成一个** | ⭐ **推荐默认用这个** |
| **Rebase and merge** | 所有提交**平铺**到 main 上，无合并提交 | 想要绝对线性的历史 |

**为什么推荐 Squash**：你开发时可能提交了「先这样」「改一下」「再改一下」「终于好了」四次。
Squash 之后 main 上只有一条干净的「fix: 满减券恢复门槛判断」。

**main 的历史应该是一部「发生了什么」的清单，不是「我当时怎么想的」的流水账。**

### 冲突了怎么办

当你的分支和 main 都改了同一个地方：

```bash
git checkout main && git pull          # 拿最新的 main
git checkout fix/coupon-threshold
git merge main                          # 把 main 合进你的分支
# 有冲突的话，文件里会出现：
#   <<<<<<< HEAD
#   你的版本
#   =======
#   main 的版本
#   >>>>>>> main
# 手动编辑成你想要的样子，删掉那三行标记，然后：
git add .
git commit
git push
```

**在自己分支上解决冲突，不要在 main 上。** 这样搞砸了也只影响你自己。

---

## 第三部分：`gh` 命令行速查

`gh` 是 GitHub 官方 CLI，很多网页上的操作它都能做，而且更快。

### PR 相关

```bash
gh pr create --fill              # 用提交信息自动填标题和正文
gh pr create --title "..." --body "..."
gh pr list                       # 列出所有 PR
gh pr view 3                     # 看 3 号 PR
gh pr view 3 --web               # 在浏览器里打开
gh pr diff 3                     # 看 3 号 PR 的完整 diff
gh pr checks 3                   # 看 CI 状态
gh pr review 3 --approve         # 批准
gh pr review 3 --comment -b "这里再改下"
gh pr merge 3 --squash --delete-branch   # 压缩合并 + 删分支
gh pr checkout 3                 # 把别人的 PR 拉到本地跑一下
```

### Issue 相关

```bash
gh issue create --title "..." --body "..."
gh issue list
gh issue view 1
gh issue comment 1 --body "@claude 帮我看下"
gh issue close 1
```

### Actions 相关（排查事故最常用）

```bash
gh run list                      # 最近的运行记录
gh run list --workflow=ci.yml    # 只看某个工作流
gh run view 12345                # 看某次运行详情
gh run view 12345 --log          # 完整日志
gh run view 12345 --log-failed   # ⭐ 只看失败的步骤，最实用
gh run rerun 12345               # 重跑
gh run watch                     # 实时盯着当前运行
```

### 仓库和密钥

```bash
gh repo view --web               # 浏览器打开当前仓库
gh repo clone 用户/仓库
gh secret set MY_KEY             # 设密钥（隐藏输入）
gh secret list
gh variable set MY_VAR --body "值"   # 明文变量
gh browse                        # 打开当前仓库主页
gh browse src/pricing.js         # 直接打开某个文件
```

### 万能兜底：`gh api`

网页上能做的、CLI 没封装的，都能用 `gh api` 打 REST API：

```bash
gh api repos/niking314/test_gitaction/pages          # 查 Pages 配置
gh api -X POST repos/OWNER/REPO/pages -f build_type=workflow
gh api repos/OWNER/REPO/branches/main/protection     # 查分支保护
```

---

## 第四部分：GitHub 网页端设置项地图

设置项确实多，但**常用的就那么十来个**。按重要性排：

### 仓库 Settings（`/settings`）

| 位置 | 干什么 | 重要性 |
|---|---|---|
| **Branches** → Rulesets | **分支保护**：强制走 PR、强制 CI 通过 | ⭐⭐⭐ 最重要 |
| **Secrets and variables** → Actions | 存 API Key、部署凭证 | ⭐⭐⭐ |
| **Actions** → General | 谁能跑 Actions、默认权限、允许哪些第三方 Action | ⭐⭐⭐ |
| **Pages** | 静态站点部署来源 | ⭐⭐ |
| **Environments** | 部署环境 + **部署前人工审批** | ⭐⭐ |
| **Collaborators** | 谁能改这个仓库 | ⭐⭐ |
| **Webhooks** | 事件推给外部系统（比如推给 Jenkins） | ⭐ |
| **General** → Danger Zone | 改名、改公开/私有、删仓库 | ⚠️ |

**`Actions → General` 里有两个值得特别注意的**：

- **Workflow permissions**：默认给 `GITHUB_TOKEN` 只读还是读写。**建议设成只读**，需要写权限的工作流在自己的 `permissions:` 块里显式声明——最小权限原则。
- **Fork pull request workflows**：控制 fork 来的 PR 能不能跑工作流。公开仓库要谨慎。

### 个人 Settings（`/settings` 在头像菜单里）

| 位置 | 干什么 |
|---|---|
| **Notifications** → System → Actions | ⭐ 工作流通知（建议选 Only notify for failed workflows） |
| **Developer settings** → Personal access tokens | 生成给脚本用的 token |
| **SSH and GPG keys** | 配 SSH 免密推送 |
| **Appearance** | 主题、字体 |

### PR 页面上的关键区域

```
┌────────────────────────────────────────┐
│ Conversation  Commits  Checks  Files   │ ← 四个标签页
├────────────────────────────────────────┤
│ [讨论区：描述、评论、review 意见]         │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ ✅ All checks have passed           │ │ ← ⭐ CI 结果，先看这个
│ │    单元测试 — successful in 8s      │ │
│ └────────────────────────────────────┘ │
│                                        │
│ [ Merge pull request ▾ ]  ← 点这里合并  │
│    └ 下拉可选 squash / rebase           │
└────────────────────────────────────────┘
```

**Files changed 标签页**是 review 的主战场：

- 点某一行左边的 `+` 可以针对那一行留评论（这会触发 `pull_request_review_comment` 事件，也就是**你可以在某一行上 @claude**）
- 右上角 `Viewed` 勾选框帮你标记看过的文件
- 齿轮图标可以切换「统一视图 / 分栏视图」，手机上用统一视图更好读

---

## 第五部分：手机上到底能做什么

GitHub 手机 App 能做的比想象中多：

| 能做 | 不能做 |
|---|---|
| ✅ 看代码、看 diff | ❌ 直接编辑多文件 |
| ✅ 开 issue、评论、@ 别人 | ❌ 跑本地测试 |
| ✅ Review PR、逐行评论、Approve | ❌ 解决复杂冲突 |
| ✅ **Merge PR**（三种方式都能选） | ❌ 复杂的 rebase 操作 |
| ✅ 看 Actions 运行状态和日志 | |
| ✅ 重跑失败的工作流 | |
| ✅ 批准部署（Environment 审批） | |
| ✅ 改单个文件（小修改可以） | |
| ✅ 管理 issue 标签、指派 | |

**「不能做」的那些，正好就是让 AI 在云端做的事。** 这就是整套流程的分工逻辑：

```
需要环境、需要跑命令、需要改多个文件  →  云端的 AI 干
需要判断、需要拍板、需要担责任        →  手机上的你干
```

---

## 附：本次事故相关的实操命令

演练时你可能想在电脑上核对，这些命令直接可用：

```bash
# 看事故是哪次提交引入的
git log --format='%h  %an  %ar  %s' src/pricing.js

# 看那次提交具体改了什么
git show ba90b79

# 对比线上代码和你本地
curl -s https://niking314.github.io/test_gitaction/pricing.js | grep -A2 full_reduction

# 看 CI 为什么是绿的（测试没覆盖到）
node --test

# 紧急回滚（生成一个反向提交，比 reset 安全）
git revert ba90b79
git push
```

**`git revert` vs `git reset`**：
`revert` 是**新增一个把改动撤销掉的提交**，历史完整、可追溯、能安全推到共享分支。
`reset` 是**抹掉历史**，推到共享分支需要 force push，会破坏别人的本地仓库。
**线上事故一律用 `revert`。**

---

**上一篇** → [06-where-does-it-run.md](06-where-does-it-run.md) · **回到** → [演练手册](04-runbook.md)
