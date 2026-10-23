# 架构说明

## 模块职责

| 模块 | 文件 | 职责 |
|---|---|---|
| **入口** | `src/index.js` | 解析 CLI 参数，路由到凑单/优惠券/HTTP 三种模式 |
| **MCP 客户端** | `src/mcp/client.js` | Streamable HTTP + JSON-RPC 2.0；SSE 解析；会话管理；401/429 处理 |
| **工具封装** | `src/mcp/tools.js` | 把 35 个 MCP 工具封装成 `tools.queryMeals()` 这类方法 |
| **意图** | `src/agent/intent.js` | 中文口语 → `{budget, people, kcalMax, scene, tags}` |
| **凑单** | `src/agent/composer.js` | 在预算/热量约束下生成 3 套差异化方案 |
| **优惠券** | `src/agent/coupon.js` | 枚举单券 + 两两组合，估算节省 |
| **兜底** | `src/data/fallback.json` | Token 缺失/网络异常时使用 |

## 关键设计

1. **零依赖**：只用 Node 18+ 原生 `fetch`/`http`，不需要 `npm install`。
2. **协议层 vs 业务层**：`client.js` 不感知业务，只负责 JSON-RPC；`tools.js` 只做名字映射；`agent/*` 才是业务逻辑。三层之间通过 `client.callTool(name,args)` 解耦。
3. **降级策略**：所有 MCP 调用都被 `try/catch` 包裹，失败自动落到本地数据。
4. **危险动作白名单**：`create-order`、`cancel-order`、`delivery-create-address`、`draw-lottery` 在 `tools.js` 中已封装但**入口不暴露**，演示模式不会触发真实下单。

## 数据流

```
                  ┌──────────────────┐
   stdin   ────>  │  parseIntent()   │  {budget:30, people:2}
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │   McdMcpClient   │ ──Authorization: Bearer──> mcp.mcd.cn
                  └────────┬─────────┘
                           │ tools/call query-meals
                  ┌────────▼─────────┐
                  │  normalizeMeals  │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  compose() x3    │  3 个策略生成 3 套方案
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │ calculate-price  │ (可选) MCP 真实核价
                  └────────┬─────────┘
                           │
                          stdout
```

## SSE 响应处理

Streamable HTTP 服务端可能用 SSE 推送。`client._readSse()` 持续读取 `data:` 行，对每个事件 `JSON.parse`，返回**最后一个** JSON-RPC 响应作为结果（符合 MCP spec）。

## 扩展点

要新增一个 MCP 工具调用：

```js
// src/mcp/tools.js 中加一行
async myNewTool(params) {
  return this.client.callTool('tool-name-in-mcp', params);
}
```

要新增一个业务功能：

```js
// src/agent/xxx.js
function myFeature(meals, intent) { ... }
module.exports = { myFeature };

// src/index.js 注册一个新的 --flag 分支
```
