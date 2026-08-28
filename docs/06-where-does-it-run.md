# 六、代码到底跑在哪台机器上？—— Jenkins vs GitHub Actions

> 这是最值得先搞清楚的一个问题。你说「不知道 Jenkins 运行在哪」——
> 这个困惑非常准确，因为**它和 GitHub Actions 最本质的区别就在这里**。

---

## 1. 一句话对比

| | Jenkins | GitHub Actions |
|---|---|---|
| **CI/CD 系统本身跑在哪** | **你自己的服务器上** | **GitHub 的机房里** |
| 谁负责它不挂 | 你 | GitHub |
| 谁装、谁升级、谁备份 | 你 | GitHub |
| 执行任务的机器 | 你自己的 Agent 机器 | GitHub 临时开的虚拟机 |
| 配置写在哪 | `Jenkinsfile` | `.github/workflows/*.yml` |
| 花钱方式 | 买机器 + 你的运维时间 | 按分钟数（公开仓库免费） |

**Jenkins 是一个你要自己养的软件；GitHub Actions 是一个别人替你养好的服务。**

---

## 2. Jenkins 到底跑在哪

Jenkins 本质上就是**一个 Java Web 应用**。有人（你或你们的运维）在某台服务器上做了这么件事：

```bash
# 某台 Linux 服务器上，很久以前
java -jar jenkins.war          # 或者 docker run jenkins/jenkins
```

然后它监听 8080 端口，你打开 `http://jenkins.公司内网:8080` 看到的那个界面，就是这个进程渲染出来的。

### Jenkins 的两层架构

```
┌─────────────────────────────────────────────────┐
│  Jenkins Controller（主节点）                     │
│  某台服务器上的一个 Java 进程                       │
│  · 提供网页界面                                    │
│  · 存储所有 job 配置、构建历史、凭证                 │
│  · 接收 webhook，决定「该干活了」                   │
│  · 自己一般不干重活，负责调度                       │
└───────────────┬─────────────────────────────────┘
                │ 通过 SSH / JNLP 分派任务
    ┌───────────┼───────────┬───────────┐
    ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│ Agent1 │ │ Agent2 │ │ Agent3 │ │ K8s 动态  │
│物理机   │ │ 虚拟机  │ │ 容器   │ │ Pod Agent │
└────────┘ └────────┘ └────────┘ └──────────┘
     真正执行 Jenkinsfile 的地方，都是你的机器
```

**所以答案是**：Jenkins Controller 跑在你们公司某台服务器（或云主机）上，`Jenkinsfile` 里的命令跑在 Agent 机器上——**这些机器全部是你们自己的，7×24 开着，要付电费/云账单，要有人管**。

### 你说的那条链路，完整展开

```
① 你在 GitLab/GitHub 点 Merge
        ↓ webhook（一个 HTTP POST）
② Jenkins Controller 收到通知：「main 分支有新提交」
        ↓ 查配置，决定跑哪个 job
③ Controller 挑一台空闲 Agent，把任务派过去
        ↓
④ Agent 上开始执行 Jenkinsfile：
     git clone 代码
     mvn package / npm build         ← 编译
     docker build -t myapp:abc123 .  ← 打镜像
     docker push harbor.公司/myapp:abc123  ← 推到镜像仓库
     kubectl set image deploy/myapp myapp=harbor.公司/myapp:abc123
        ↓
⑤ Kubernetes 收到指令，去镜像仓库拉新镜像
        ↓
⑥ K8s 滚动替换 Pod：起新的 → 健康检查通过 → 杀旧的
        ↓
⑦ 新版本上线
```

注意 ④ 里的 `docker` 和 `kubectl` 命令——**它们跑在 Agent 上，所以 Agent 机器上必须装了 docker 和 kubectl，还得配好访问镜像仓库和 K8s 集群的凭证**。这些都是你要维护的东西。

---

## 3. GitHub Actions 跑在哪

```
① 你点 Merge
        ↓ GitHub 内部事件（不用配 webhook，天生就有）
② GitHub 读你仓库里的 .github/workflows/*.yml
        ↓
③ GitHub 从自己的机器池里，临时开一台全新虚拟机
     · Ubuntu / Windows / macOS 任选
     · 预装了 git、node、python、docker、gh 等一堆常用工具
        ↓
④ 在这台机器上按 yml 顺序执行 steps
        ↓
⑤ 跑完，这台机器连同上面所有东西被销毁
```

**关键差异：这台机器是一次性的。**

- 每次运行都是**全新的空白环境**，上次留下的文件、装的软件、缓存，全没了
- 所以 `.yml` 里要写 `actions/checkout` 重新拉代码、写 `setup-node` 重新装 Node
- 也因此不存在「Jenkins Agent 上残留了脏文件导致构建结果诡异」这种经典问题

这就是为什么我们 `deploy.yml` 里 `test` 和 `deploy` 是两个 job 时，`deploy` 要**重新 checkout 一次**——它是另一台机器。

### 我们这个仓库的实际情况

你之前那次 CD 跑了 28 秒。这 28 秒里 GitHub 干了：开一台 Ubuntu 虚拟机 → 拉代码 → 装 Node → 跑测试 → 再开一台 → 拉代码 → 打包 → 上传 → 部署到 Pages → 销毁两台机器。

**这些机器你一台都没见过，也不用管。**

---

## 4. 交汇点：Self-hosted Runner

GitHub Actions **也可以跑在你自己的机器上**。这是两者的融合点：

```bash
# 在你自己的服务器上跑（GitHub 会给你具体命令）
./config.sh --url https://github.com/你/仓库 --token XXXX
./run.sh
```

之后 workflow 里改一行：

```yaml
jobs:
  build:
    runs-on: self-hosted        # ← 不用 GitHub 的机器，用我自己的
```

**什么时候需要**：

- 要访问公司内网资源（内网数据库、私有镜像仓库、内网 K8s）
- 有特殊硬件需求（GPU、超大内存、特定 CPU 架构）
- 合规要求代码不能离开自己机房
- 构建量巨大，自己的机器更便宜

**代价**：你又开始要养机器了——变回 Jenkins 那套运维负担。而且**公开仓库上用 self-hosted runner 有安全风险**（陌生人提 PR 就能在你的机器上跑代码），GitHub 官方明确警告过。

---

## 5. 为什么我们这个 demo 没有 Docker 和 K8s

因为**部署目标是静态网站**。`src/` 目录里就是 HTML/JS，直接扔给 GitHub Pages 就行，没有「运行中的服务」。

**什么时候才需要容器和 K8s**：

| 你的应用是 | 部署方式 | 需要容器吗 |
|---|---|---|
| 静态页面（HTML/JS/CSS） | 传到 CDN / Pages / OSS | ❌ 不需要 |
| 前端 SPA（React/Vue 打包后） | 同上 | ❌ 不需要 |
| 后端服务（Java/Go/Python API） | 要有进程常驻、要扩缩容 | ✅ 需要 |
| 微服务集群 | 要服务发现、滚动升级、自愈 | ✅ 需要 K8s |

**你在 Jenkins 那边见到的 docker build + kubectl，是因为那是个后端服务。** 换成静态站点，Jenkins 那边也会简化成「打包 + 传文件」。

### 如果这个项目要上 K8s，deploy.yml 会长这样

给你一个能对应上 Jenkins 经验的完整示例：

```yaml
name: Deploy to K8s

on:
  push:
    branches: [main]

permissions:
  contents: read
  packages: write        # 推镜像到 GitHub Container Registry 要这个

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # ① 登录镜像仓库（等价于 Jenkinsfile 里的 docker login）
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}   # 这个 token GitHub 自动给，不用配

      # ② 打镜像并推送（等价于 docker build + docker push）
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}

      # ③ 配置 kubectl 凭证
      - uses: azure/k8s-set-context@v4
        with:
          kubeconfig: ${{ secrets.KUBE_CONFIG }}   # 你把 kubeconfig 存成密钥

      # ④ 滚动更新（等价于 kubectl set image）
      - run: |
          kubectl set image deployment/myapp \
            myapp=ghcr.io/${{ github.repository }}:${{ github.sha }}
          kubectl rollout status deployment/myapp --timeout=120s
```

**和 Jenkinsfile 做的事一模一样**，区别只是：

- 跑在 GitHub 的临时机器上，不是你的 Agent
- `docker` 和 `kubectl` 已经预装好了，不用你在机器上装
- 凭证放 GitHub Secrets，不是 Jenkins Credentials
- **用 `${{ github.sha }}` 当镜像 tag** —— 这是个好习惯，每次提交一个唯一 tag，出事能精确回滚到某个提交

---

## 6. 什么时候该用哪个

| 场景 | 建议 |
|---|---|
| 开源项目、个人项目、创业早期 | **GitHub Actions**，零运维 |
| 代码在 GitHub 上，没有内网依赖 | **GitHub Actions** |
| 代码在公司内网 GitLab，不能外网 | **Jenkins** 或 GitLab CI |
| 需要访问内网 K8s / 内网数据库 | Actions + self-hosted runner，或 Jenkins |
| 已有大量 Jenkinsfile 资产、团队熟 | 别急着迁，迁移成本很实在 |
| 合规要求构建过程完全自持 | **Jenkins** |

**一个常见的现实做法**：CI（跑测试）用 GitHub Actions，因为快且免运维；CD（部署到内网）用 Jenkins 或 self-hosted runner，因为要碰内网资源。两者不冲突。

---

## 7. 概念对照表

熟悉 Jenkins 的话，这张表能帮你快速迁移认知：

| Jenkins | GitHub Actions |
|---|---|
| Jenkinsfile | `.github/workflows/*.yml` |
| Pipeline / Job | Workflow |
| Stage | Job |
| Step | Step |
| Agent / Node | Runner |
| `agent { label 'linux' }` | `runs-on: ubuntu-latest` |
| Credentials | Secrets |
| Shared Library | Reusable workflow / composite action |
| Plugin | Action（Marketplace 上现成的） |
| Build Trigger（配 webhook） | `on:`（天生集成，不用配） |
| Build Artifacts | `actions/upload-artifact` |
| Blue Ocean 界面 | Actions 页面 |

**最大的心智差异**：Jenkins 的 job 配置很多存在 Controller 的数据库里（点界面配的），容易和代码脱节；
GitHub Actions **所有配置都在代码仓库里**，跟着分支走、能 review、能回滚。这是个实实在在的进步。

---

**下一篇** → [07-git-github-practice.md](07-git-github-practice.md)：git 和 GitHub 的实操全流程。
