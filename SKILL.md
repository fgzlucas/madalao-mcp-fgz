# Skill: 麦大佬 madalao-mcp-fgz

> WorkBuddy Skill 描述文件。把本仓库的 CLI 能力暴露为 WorkBuddy 可调用技能。

## 元信息

- **name**: `madalao-mcp-fgz`
- **display_name**: 麦大佬 · 麦当劳点餐助手
- **version**: 0.1.0
- **description**: 听懂中文口语（"30块吃饱"/"减脂期500卡"/"我有啥券"），调用麦当劳官方 MCP 给出菜单搭配、优惠券用法、附近门店建议。
- **author**: fgzlucas
- **license**: MIT

## 触发方式

用户以下列方式提问时激活：

- "麦当劳 30 块怎么点"
- "帮我看看我有什么麦当劳券"
- "减脂期在麦当劳能吃什么"
- "附近的麦当劳"
- "麦当劳最近有什么活动"

## 依赖的连接器

| Connector | Endpoint | 必需 |
|---|---|---|
| `mcd-mcp` | `https://mcp.mcd.cn` (Streamable HTTP) | 是 |

配置 JSON：

```json
{
  "toolservers": {
    "mcd-mcp": {
      "type": "streamablehttp",
      "url": "https://mcp.mcd.cn",
      "headers": { "Authorization": "Bearer ${MCD_MCP_TOKEN}" }
    }
  }
}
```

## 输入

```ts
{
  query: string,        // 用户口语输入
  context?: {
    city?: string,      // 可选，提高门店推荐准确度
    location?: { lat:number, lng:number }
  }
}
```

## 输出

```ts
{
  intent: { budget?, people?, kcalMax?, scene?, tags? },
  source: 'mcp' | 'fallback',
  combos: Array<{
    label: string,
    total: number,
    kcal: number,
    items: Array<{code,name,price,kcal}>
  }>,
  couponAdvice?: {
    usableCount: number,
    plans: Array<{ note:string, expectSave:number }>
  }
}
```

## 调用示例

```bash
# 凑单
node src/index.js "30块两个人吃个饱"

# 优惠券
node src/index.js --coupon

# HTTP 服务（供 WorkBuddy 调用）
node src/index.js --http
# GET /api/compose?q=30块两个人
```

## 安全说明

- 所有真实下单、支付、个人地址写入操作均**未启用**。
- 仅做菜单/营养/券/门店/活动等只读查询与算价。
- 用户 Token 通过 `MCD_MCP_TOKEN` 环境变量注入，**不会**写到日志或返回值中。
