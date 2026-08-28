# 三、通知机制：事故是怎么找到你手机的

> 你收到的那封 CD 失败邮件，是整个「手机应急」故事的**入口**。
> 没有通知，前面所有自动化都是白搭——因为你根本不知道出事了。

## 1. 你为什么会收到那封邮件

GitHub 官方文档的原话是：

> "You can subscribe to notifications about workflow runs that you trigger."
> 通知发给**触发这次运行的人**，不一定是提交代码的人。

我用你的 `gh` 凭证（账号 `niking314`）推的代码，所以那次运行算在你头上 → 邮件到你邮箱。

默认行为是**成功和失败都通知**。所以你可能还收到了几封绿色的，只是失败那封比较扎眼。

## 2. 怎么调

**网页/桌面端**：
```
GitHub → 右上角头像 → Settings → Notifications
       → 找到 "System" 区块 → "Actions"
```
四个选项：

| 选项 | 说明 |
|---|---|
| Don't notify | 完全不通知 |
| On GitHub | 只在网站的通知铃铛里显示 |
| Email | 发邮件 |
| **Only notify for failed workflows** | **只在失败时通知 ← 推荐勾上** |

> ⚠️ **一个坑**：如果你把仓库设成了 **Watching**，仓库订阅状态的优先级最高，会**盖掉**上面的 Actions 设置，导致你照样收到全部通知。
> 收到太多噪音时先检查这里，而不是反复调 Actions 设置。

**手机端（这才是重点）**：
```
GitHub 手机 App → Settings → Configure Notifications
```
打开推送后，工作流成功/失败会直接推到锁屏，同样可以设成「只推失败」。

手机 App 还支持这几类推送：
- **Direct mentions** —— 有人 @ 你
- Assignments to issues or pull requests
- Requests to review a pull request
- **Requests to approve a deployment** ← 见下面第 4 节，这个很有用

## 3. ⚠️ 默认机制有个严重局限，必须知道

**默认只通知「触发运行的人」。**

这意味着：

- 你同事推了个坏代码 → **邮件发给他，不发给你**
- 你在休假，团队里没人看 → 线上挂了没人知道
- 定时任务（`schedule`）的通知，发给「最初创建这个工作流的人」；如果别人改了 cron 表达式，就转给那个人

**所以这套默认通知只够个人玩具项目用。** 真实生产环境必须再加一层。GitHub 社区里关于这个限制的讨论已经挂了好几年（`community/discussions/55379`）。

### 生产环境该怎么补

按投入从小到大：

1. **分支保护 + Required status checks**（最重要，5 分钟配完）
   Settings → Branches → 给 `main` 加规则，勾上「必须 CI 通过才能合并」。
   **这不是通知，是预防**——坏代码根本进不了 main，就不需要事后通知。

2. **在工作流里主动发通知**
   加一个 `if: failure()` 的 step，往钉钉/飞书/企业微信/Slack 的 webhook 推消息：
   ```yaml
       - name: 失败时报警
         if: failure()
         run: |
           curl -X POST "$WEBHOOK" -H 'Content-Type: application/json' \
             -d "{\"text\":\"🔴 部署失败 ${{ github.repository }} ${{ github.sha }}\"}"
         env:
           WEBHOOK: ${{ secrets.ALERT_WEBHOOK }}
   ```
   这样**全组都收到**，不管是谁触发的。

3. **真正的线上监控**
   CI/CD 的通知只覆盖「发布过程」出错。**发布成功但功能是错的，Actions 一无所知**——这正是我们接下来要演练的那种事故。
   真实系统还需要：健康检查探活、错误率告警、业务指标监控（比如「客单价突然掉了 20 元」）。

## 4. 一个被低估的功能：手机上批准部署

GitHub 的 **Environment 保护规则**可以要求部署前必须有人点同意：

```
Settings → Environments → github-pages → Required reviewers
```

配上之后，流程变成：

```
合并 PR → CD 跑到部署那步暂停 → 推送「Requests to approve a deployment」到你手机
        → 你在手机上点 Approve → 才真正上线
```

**这是「远程但可控」的最佳平衡点**：日常小改动全自动，重要发布留一道手机上的确认。
对生产环境我强烈建议开这个——尤其是当 AI 在帮你写代码的时候。

## 5. 手机应急的完整通知链路

把上面串起来，一次真实事故你手机上会依次收到：

```
① 线上监控告警（钉钉/飞书/短信）          ← 「出事了」
        ↓ 你打开 GitHub App
② 你在 issue 里 @agent                    ← 「派活」
        ↓
③ AI 开了 PR → 推送「review 请求」         ← 「活干完了，来看」
        ↓ 你在手机上看 diff、看 CI 绿勾
④ 你点 Merge
        ↓
⑤ 「Requests to approve a deployment」    ← 「确认上线吗」
        ↓ 点 Approve
⑥ 部署完成通知                             ← 「好了」
        ↓
⑦ 手机浏览器刷新页面，看版本号变了没       ← 「亲眼确认」
```

**全程没碰电脑。** ①③⑤⑥ 是自动推给你的，②④⑦ 是你点三下 + 打一句话。

这个仓库现在已经具备 ②③④⑥⑦ 的能力（③ 等配密钥）。① 和 ⑤ 需要额外配置，属于生产环境的功课，演练里我们用「你自己刷新页面发现算错钱」来代替 ①。

---

**下一篇** → [04-runbook.md](04-runbook.md)：完整演练手册，一步步照做。
