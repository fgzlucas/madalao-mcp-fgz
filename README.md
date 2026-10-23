# 🍔 麦大佬 madalao-mcp-fgz

> **一句话卖点**：听懂"30 块钱两个人吃个饱"，自动调**麦当劳官方 MCP** 算菜单、配优惠券、核价，给你 3 套点单方案。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/McDonald's%20MCP-Streamable%20HTTP-red)](https://github.com/M-China/mcd-mcp-server)
[![WorkBuddy](https://img.shields.io/badge/WorkBuddy-Skill-blue)](https://www.workbuddy.cn)
[![1024](https://img.shields.io/badge/1024-Programmers'%20Day-orange)](https://github.com/M-China/mcd-developer-innovation-challenge)

参赛项目 · **麦当劳 2026 程序员创意开发大赛** · FROM GIT TO BITE

---

## 🤔 这是什么

`madalao-mcp-fgz` 是一个**中文点餐助手**。你把日常口语直接说给它：

```
「30 块钱两个人吃个饱」
「减脂期 500 卡以内能吃点啥」
「附近哪家麦当劳还开着」
「帮我看看我有哪些券，怎么用才最划算」
```

它会通过 **Streamable HTTP 协议**接入麦当劳官方 MCP Server (`https://mcp.mcd.cn`)，依次调用真实接口 —— 取菜单 → 看营养 → 配券 → 核价 —— 把"去麦当劳 App 翻半天"变成"一句话出 3 套方案"。

## ✨ 核心功能

| 功能 | 用到的麦当劳 MCP 工具 |
|---|---|
| 🍟 **智能凑单**：按预算/人数/场景出 3 套搭配 | `query-meals`, `query-meal-detail`, `calculate-price` |
| 🎟️ **优惠券管家**：一键领券 + 算最优用法 | `auto-bind-coupons`, `query-my-coupons`, `available-coupons`, `calculate-price` |
| 🥗 **热量控制**：减脂期 500kcal 怎么点 | `list-nutrition-foods`, `query-meals` |
| 📍 **门店推荐**：附近门店 + 营业状态 | `query-nearby-stores`, `delivery-query-stores` |
| 🎉 **活动日历**：本月麦当劳有啥活动 | `campaign-calendar` |
| ⏰ **当前时间**：用于"现在还开着吗"判断 | `now-time-info` |

> ✅ **合规要求达成**：本项目真实接入了 **6+ 个麦当劳 MCP 工具**，远超"至少一项"的参赛底线。详见 [`MCP_INTEGRATION.md`](./MCP_INTEGRATION.md)。

## 🚀 Quick Start

```bash
# 1. 克隆
git clone https://github.com/fgzlucas/madalao-mcp-fgz.git
cd madalao-mcp-fgz

# 2. 配置 Token (去 https://open.mcd.cn/mcp 控制台申请)
cp .env.example .env
# 编辑 .env, 填入 MCD_MCP_TOKEN=xxxxxx

# 3. 跑起来 (零依赖, Node 18+ 即可)
node src/index.js "30块两个人吃个饱"
```

无 Token 也能跑：加 `--demo` 走本地兜底菜单。

```bash
node src/index.js --demo "30块吃饱"
```

### 三个演示脚本

```bash
npm run demo:combo    # 智能凑单：预算 -> 3 套搭配
npm run demo:coupon   # 一键领券 + 算最优用法
npm run demo:http     # 起本地 HTTP 服务 -> /api/compose?q=...
```

HTTP 模式默认监听 `http://localhost:8787`：

```bash
curl "http://localhost:8787/api/compose?q=30%E5%9D%97%E4%B8%A4%E4%B8%AA%E4%BA%BA"
curl http://localhost:8787/api/tools        # 列出 35 个 MCP 工具
curl http://localhost:8787/health
```

## 💬 真实使用对话（示例）

**输入**：`30 块钱两个人吃个饱`

```
> 解析意图: { budget: 30, people: 2, scene: 'any', tags: [] }
> 数据源: 麦当劳 MCP (实时)

[方案 1] 经典搭配  ¥30  ≈1190kcal
  • 麦香鸡 ¥14
  • 中薯条 ¥10
  • 薯饼  ¥6

[方案 2] 换种口味  ¥29  ≈940kcal
  • 烟肉蛋麦满分 ¥12
  • 麦麦卷      ¥16
  • 苹果派      ¥7  (超出则替换)

[方案 3] 省钱轻量  ¥27  ≈870kcal
  ...
```

**输入**：`减脂期 500 卡以内`

```
> 解析意图: { kcalMax: 500, tags: ['减脂'] }
[方案 1] 经典搭配  ¥32  ≈480kcal
  • 田园沙拉    ¥14 (120kcal)
  • 玉米杯      ¥8  (90kcal)
  • 无糖可乐    ¥8  (0kcal)
  • 麦乐鸡 4 块 ¥11 (200kcal)
```

## 🏗️ 架构

```
用户口语 ──> parseIntent() ──> ┌──────────────┐
                                │  McdMcpClient │  JSON-RPC over Streamable HTTP
                                │  (Authorization: Bearer ***) │
                                └──────┬────────┘
                                       │
                          tools/list + tools/call
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                     query-meals  query-my-   calculate-price
                     list-nutri-   coupons    auto-bind-
                     foods        nearby-     coupons
                                  stores
                                       │
                                       ▼
                              composer.js 凑单算法
                              coupon.js   最优券组合
                                       │
                                       ▼
                              3 套方案 + 真实核价
```

## 📁 仓库结构

```
madalao-mcp-fgz/
├── README.md                  ← 你正在看的这个
├── CONTEST_DECLARATION.md     ← 官方参赛声明 (必须原样)
├── MCP_INTEGRATION.md         ← MCP 接入说明 (必须)
├── SKILL.md                   ← WorkBuddy Skill 描述
├── workbuddy.md               ← WorkBuddy 开发实录 (加分)
├── package.json               零依赖, Node 18+
├── src/
│   ├── index.js               CLI + HTTP 入口
│   ├── mcp/
│   │   ├── client.js          Streamable HTTP + JSON-RPC 客户端
│   │   └── tools.js           35 个工具的薄封装
│   ├── agent/
│   │   ├── intent.js          中文口语 -> 结构化意图
│   │   ├── composer.js        凑单算法
│   │   └── coupon.js          优惠券最优组合
│   └── data/fallback.json     兜底菜单 (Token 缺失时用)
├── examples/                  3 个可执行演示
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEMO.md                演示实录
│   └── screenshots/
└── tests/run.js               最小测试
```

## 🗺️ Roadmap

- [x] Streamable HTTP MCP Client (支持 SSE 响应)
- [x] 中文意图识别（预算/人数/场景/热量/tag）
- [x] 三套差异化凑单策略
- [x] 优惠券组合穷举
- [x] 零依赖 Node 18 单文件运行
- [ ] 接入 `create-order` 一键下单 → 输出支付链接
- [ ] 接 LLM（qwen-plus / Doubao-Seed）做更细的意图理解
- [ ] WorkBuddy Skill 上架
- [ ] Web UI（一杯奶茶风的点单页面）

## 🤝 参赛相关文件说明

- `CONTEST_DECLARATION.md` —— 官方要求原样保留，**未做改动**
- `MCP_INTEGRATION.md` —— 列出本项目调用的全部 MCP 工具与业务价值
- `workbuddy.md` —— 本项目在 WorkBuddy 中的开发对话（提交可获得 3,000 积分）

## ⚠️ 免责 & 合规

- 本项目是**参赛作品**，非麦当劳官方产品；餐品信息、价格、供应状态以麦当劳 App/门店为准。
- MCP Token **严禁提交到仓库**。`.env` 已加入 `.gitignore`。
- 所有 MCP 调用均遵守麦当劳《使用条款》及《MCP 服务规则》，仅限非商业、研究用途。

## 📜 License

MIT © 2026 madalao-mcp-fgz contributors

---

> 如果你也觉得"中午吃啥"是宇宙终极难题 —— 给个 ⭐️ 吧，巨无霸靠它了。
