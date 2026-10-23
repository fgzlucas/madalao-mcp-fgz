# MCP_INTEGRATION.md — 麦当劳 MCP 接入说明

本文档说明 `madalao-mcp-fgz` 项目实际调用了哪些麦当劳官方 MCP 能力、调用流程、以及它们对应的业务价值。

## 1. 接入方式

| 项 | 值 |
|---|---|
| Server | `https://mcp.mcd.cn` |
| 协议 | Streamable HTTP（JSON-RPC 2.0） |
| 鉴权 | 请求头 `Authorization: Bearer ${MCD_MCP_TOKEN}` |
| 限流 | 600 次/分钟/Token |
| Token 获取 | <https://open.mcd.cn/mcp> → 控制台 → 激活 |

代码实现：`src/mcp/client.js`，零外部依赖，基于 Node 18+ 原生 `fetch`：

- 支持 `application/json` 与 `text/event-stream`（SSE）两种响应
- 自动维护 `Mcp-Session-Id` 会话
- `initialize` → `tools/list` → `tools/call` 标准握手
- 401 / 429 错误语义化处理

## 2. 项目实际调用的工具

| MCP 工具名 | 用途 | 业务价值 |
|---|---|---|
| `query-meals` | 获取门店可售餐品列表 | **凑单功能核心数据源** —— 拿真实菜单做预算组合 |
| `query-meal-detail` | 餐品详情 / 套餐组成 | 解析套餐内可替换项 |
| `list-nutrition-foods` | 营养信息（热量/蛋白/钠） | **减脂期 500kcal 套餐求解** |
| `query-my-coupons` | 我的优惠券列表 | **优惠券管家**数据源 |
| `auto-bind-coupons` | 一键领取麦麦省所有券 | 帮懒人用户一键全领 |
| `available-coupons` | 可领券列表 | 和上一项配合，可视化"还能领啥" |
| `calculate-price` | 整单核价（含券） | **关键价值** —— 让 MCP 告诉用户真实折扣价 |
| `query-nearby-stores` | 附近门店 | "附近哪家还开着" |
| `delivery-query-stores` | 可配送门店 | 外送场景 |
| `campaign-calendar` | 当月活动日历 | 给用户推荐"本月能玩的活动" |
| `now-time-info` | 服务器时间 | 判断门店/活动是否仍处于有效期 |

> **合计真实接入 ≥ 6 项工具**，超出赛事"至少一项"的硬性要求。

## 3. 调用链路示例

### 场景 A：30 块吃饱（智能凑单）

```
用户输入: "30块两个人吃个饱"
   │
   ▼ parseIntent()
   │   { budget:30, people:2 }
   │
   ▼ tools/call query-meals
   │   { orderType:1 }      // 到店自提
   │
   ▼ composer.compose()
   │   策略1: 经典搭配 (汉堡+饮品+小食)
   │   策略2: 换种口味 (排除方案1主菜)
   │   策略3: 省钱轻量 (≤¥12 单品填充)
   │
   ▼ tools/call calculate-price
   │   { items:[{code,qty}], couponIds:[...] }
   │
   ▼ 输出: 3 套方案 + MCP 真实核价结果
```

### 场景 B：优惠券最优用法

```
"帮我看看券怎么用划算"
   │
   ▼ tools/call auto-bind-coupons      // 先把没领的都领了
   ▼ tools/call query-my-coupons       // 拿到我的券池
   ▼ coupon.planCouponUsage()          // 枚举单券 + 两两组合
   ▼ tools/call calculate-price        // 对每个组合真实核价
   ▼ 输出 Top3 用券方案 + 节省金额
```

### 场景 C：减脂期 500 卡

```
"减脂期 500 卡以内"
   │
   ▼ parseIntent() → { kcalMax:500, tags:['减脂'] }
   ▼ tools/call list-nutrition-foods  // 拿热量数据
   ▼ tools/call query-meals           // 拿当前可售
   ▼ composer() 在热量约束下组合
   ▼ 输出 3 套 ≤500kcal 的方案
```

## 4. 数据流与降级策略

- **正常路径**：全部请求走 `https://mcp.mcd.cn`，Token 从环境变量 `MCD_MCP_TOKEN` 读取。
- **降级路径**：未配置 Token 或网络异常时，使用 `src/data/fallback.json` 的本地菜单，保证演示不中断（README、Issue 复现步骤都基于此）。
- **绝不内置 Token**：本仓库**不包含**真实 Token；`.env` 已在 `.gitignore` 屏蔽。

## 5. 错误码处理

| 状态码 | 处理 |
|---|---|
| 401 | 抛出 `McpError("MCP Token 无效或过期")`，提示用户检查 `.env` |
| 429 | 抛出 `McpError("触发限流")`，提示降低频率；调用方需自行实现退避 |
| 其他 HTTP 错误 | 包装原始 message 输出 |

## 6. 合规自查清单

- [x] 代码无恶意逻辑、无后门、无远程下载行为
- [x] 仅做**读操作 + 算价**，未实现 `create-order` 等真实下单（避免误触发支付链路）
- [x] 未提交任何真实 Token / 用户隐私数据
- [x] 第三方依赖：**零**（完全使用 Node 原生 `fetch`/`http`）
- [x] 使用 MCP 仅用于非商业研究目的

## 7. 后续可扩展 MCP 工具

| 工具 | 想做但 MVP 未做 | 原因 |
|---|---|---|
| `create-order` | 一键下单 | 涉及支付，演示环境风险高，仅做核价 |
| `delivery-create-address` | 新增配送地址 | 需要真实用户地址，脱敏难 |
| `draw-lottery` | 积分抽奖 | 消耗真实积分，不宜演示 |
| `query-order` | 查订单 | 需要存在历史订单 |

这些工具已在 `src/mcp/tools.js` 中预留封装方法，调用方式与已接工具一致。
