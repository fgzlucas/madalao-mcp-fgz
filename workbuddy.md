# workbuddy.md

> 本文件记录使用 **WorkBuddy** 开发 `madalao-mcp-fgz` 项目的关键对话上下文，用于核验 WorkBuddy 联动活动奖励条件。

## 开发目标

基于麦当劳官方 MCP 能力开发一款**实用工具型 Skill**，参加麦当劳 2026 程序员创意开发大赛（FROM GIT TO BITE）。

## 开发过程摘要（WorkBuddy 内）

### 第 1 轮：规则理解 + 方案选型

向 WorkBuddy 提供比赛海报（麦当劳创意开发大赛），让其提取：
- 比赛主题：基于麦当劳 MCP 开发 Skill
- 必须真实接入至少一项 MCP 能力
- 报名须包含 README / CONTEST_DECLARATION / MCP_INTEGRATION
- 按 GitHub Star 排行，前 100 名有奖

WorkBuddy 帮助确认参赛方案：
- **方向**：实用工具型（套餐推荐/凑单/优惠券管家）
- **技术栈**：Node.js + JavaScript（评委友好、零依赖、最易传播）
- **仓库名**：`madalao-mcp-fgz`

### 第 2 轮：MCP 接入调研

WorkBuddy 通过 WebFetch 抓取并整理了：

- `https://github.com/M-China/mcd-mcp-server`：MCP 接入文档
- `https://open.mcd.cn/mcp/doc`：MCP 官方平台
- `https://github.com/M-China/mcd-developer-innovation-challenge`：比赛规则、Issue 报名格式、奖项

确认接入参数：
- URL: `https://mcp.mcd.cn`
- Protocol: Streamable HTTP
- Auth: `Authorization: Bearer <TOKEN>`
- 限流：600/min
- 工具数：35 个（list-nutrition-foods / query-meals / calculate-price / query-my-coupons / auto-bind-coupons 等）

### 第 3 轮：架构与代码生成

WorkBuddy 协助生成项目骨架：

```
madalao-mcp-fgz/
├── src/mcp/client.js          # Streamable HTTP + JSON-RPC 客户端（含 SSE 解析）
├── src/mcp/tools.js           # 35 个工具的薄封装
├── src/agent/intent.js        # 中文意图解析
├── src/agent/composer.js      # 凑单算法（3 策略）
├── src/agent/coupon.js        # 优惠券最优组合
├── src/data/fallback.json     # 兜底菜单
└── src/index.js               # CLI + HTTP 入口
```

关键决策点：
- **零外部依赖**：仅用 Node 18+ 原生 `fetch`/`http`，简化评委复现
- **Token 走环境变量**：`.env` 加入 `.gitignore`，避免泄露
- **不接 `create-order`**：演示环境避免误下单，仅做 `calculate-price` 核价
- **降级路径**：MCP 失败时落到 `fallback.json`，保证演示不挂

### 第 4 轮：联调验证

通过 WorkBuddy 内置 Node 22 运行时实测：

```
TOOLS count: 35
delivery-create-address, query-store-coupons, query-nearby-stores,
delivery-query-stores, query-party-store ...
```

确认 `MCD_MCP_TOKEN` 有效，`tools/list` 握手成功。

### 第 5 轮：参赛必备文件

WorkBuddy 生成：

- `README.md`：含一句话卖点 / Quick Start / 真实调用示例 / 架构图 / Roadmap / 合规自查
- `MCP_INTEGRATION.md`：列出 6+ 个真实接入工具与业务价值
- `CONTEST_DECLARATION.md`：从官方仓库**原样拷贝**（未做改动）
- `SKILL.md`：WorkBuddy Skill 描述文件
- `workbuddy.md`：本文件

### 第 6 轮：提交与发布

- 仓库已推送至 GitHub `fgzlucas/madalao-mcp-fgz`（Public）
- 已在 [M-China/mcd-developer-innovation-challenge](https://github.com/M-China/mcd-developer-innovation-challenge) 按标准格式提 Issue 报名
- 持续维护 README、issues、demo 演示，积累 Star

## 结论

本项目从需求分析、架构设计、代码生成、MCP 联调、到参赛合规文件准备，**全部由 WorkBuddy 协助完成**，符合 WorkBuddy 联动活动奖励的提交条件。

— 2026-10-23
