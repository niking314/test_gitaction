# 项目说明（给 Claude 看的）

这是一个电商结算页，纯静态，部署在 GitHub Pages 上。

## 结构
- `src/pricing.js` —— **算钱的唯一真相来源**。改这里要格外小心。
- `src/app.js` / `src/index.html` —— 页面，直接被部署，没有构建步骤。
- `test/pricing.test.js` —— 用 Node 自带 test runner，`node --test` 运行。

## 铁律
1. **没有 npm 依赖**。不要引入任何第三方包，不要加构建工具。测试只用 `node:test` + `node:assert`。
2. **改了 `pricing.js` 就必须补测试**。修 bug 时先写一个能复现该 bug 的失败测试，再修代码——这样这个 bug 永远不会回来。
3. 金额一律保留两位小数，用 `round2()`。不要引入浮点误差。
4. 页面必须在手机上能看（375px 宽），要支持深色模式。

## 修线上问题时
- 用 `git log -p src/pricing.js` 找到是哪次提交引入的。
- PR 描述里写清楚：**现象 → 根因 → 改法 → 新增了什么测试**。用中文。
- 只改跟这个问题相关的代码，不要顺手重构。
