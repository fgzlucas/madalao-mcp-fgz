# 演示实录（真实 MCP 数据）

> 以下输出均为 **2026-10-23 18:00** 通过 `MCD_MCP_TOKEN` 调 `https://mcp.mcd.cn` 的**真实返回**，非 mock。

## 0. MCP 握手：35 个工具

```bash
$ node -e "const {McdMcpClient}=require('./src/mcp/client'); \
    new McdMcpClient().listTools().then(t=>console.log(t.length))"
35
```

工具包括：`query-meals` / `calculate-price` / `query-nearby-stores` / `query-my-coupons` / `auto-bind-coupons` / `list-nutrition-foods` / `campaign-calendar` / `mall-points-products` / `party-order-create` / `draw-lottery` 等共 35 个。

## 1. 智能凑单（30 块吃饱）

```bash
$ node src/index.js "30块两个人吃个饱"

> 解析意图：{"budget":30,"people":2,"scene":"any","tags":[]}
> 数据源：麦当劳 MCP 实时 · 麦当劳上海黄浦华旭国际大厦餐厅 (144m)

[方案 1] 经典搭配  ¥28.5
  • 牛肉堡单品精选  ¥14    ← MCP 实时价, productCode=9900008747
  • 雪碧            ¥9.5   ← productCode=3010
  • 圆筒冰淇淋      ¥5     ← productCode=515837

[方案 2] 换种口味  ¥25.4
  • 龙焰鸡腿堡      ¥15.9  ← productCode=521952, 原价¥24 促销优惠中
  • 雪碧            ¥9.5

[方案 3] 省钱轻量  ¥19.5
  • 雪碧            ¥9.5
  • 圆筒冰淇淋      ¥5
  • 灰焰圆筒        ¥5

[MCP calculate-price] 真实核价：
  商品原价 ¥28.50  现价 ¥28.50
  优惠 ¥0.00  应付 ¥28.50
  包装费 ¥0.00  餐具费 ¥0.00
```

> ✅ `query-nearby-stores` → `query-meals` → `calculate-price` 三个工具**全链路真实调用**。

## 2. 减脂期 500 卡（联动 list-nutrition-foods）

```bash
$ node src/index.js "减脂期500卡以内"

> 解析意图：{"kcalMax":500,"tags":["减脂"]}
> 数据源：麦当劳 MCP 实时 · 上海华旭国际大厦餐厅

[方案 1] 经典搭配  ¥33.5  ≈198kcal
  • 牛肉堡单品精选  ¥14   (0kcal, MCP 菜单未直接给热量)
  • 雪碧            ¥9.5  (105kcal)  ← list-nutrition-foods 真实数据
  • 圆筒冰淇淋      ¥5    (93kcal)   ← 同上
  • 灰焰圆筒        ¥5
```

> `list-nutrition-foods` 返回 **160 个餐品的 TOON 紧凑格式**营养数据
> （能量 / 蛋白质 / 脂肪 / 碳水 / 钠 / 钙）。本项目用 `parseNutrition()`
> 解析并按 `productName` 匹配到菜单项。

## 3. 一键领券（真实有效）

```bash
$ node src/index.js --coupon

=== Step 1: auto-bind-coupons ===
总计: 3 张优惠券
成功: 3 张
失败: 0 张

- 11.9元麦辣鸡腿堡    couponId=B34E5EC6710BEEECEC8B25C742D3F119
- 19.9元王牌炸鸡任选2  couponId=A03BC156F97B8937213963D7632F3338
- 免费脆薯饼          couponId=0D94B7923332F58026539DB8CCA81275
```

> ✅ `auto-bind-coupons` 真实从麦麦省账户领到了 3 张券（无需指定 couponId，系统自动领取全部可领券）。

## 4. HTTP 服务

```bash
$ node src/index.js --http &
madalao-mcp-fgz HTTP listening on http://localhost:8787

$ curl http://localhost:8787/health
{"ok":true,"hasToken":true}

$ curl "http://localhost:8787/api/compose?q=30块两个人"
{
  "source":"mcp",
  "intent":{"budget":30,"people":2,"scene":"any"},
  "combos":[
    {"label":"经典搭配","total":28.5,"items":[
      {"code":"9900008747","name":"牛肉堡单品精选","price":14,...},
      {"code":"3010","name":"雪碧","price":9.5,...},
      {"code":"515837","name":"圆筒冰淇淋","price":5,...}
    ]},
    ...
  ]
}

$ curl http://localhost:8787/api/tools
{"count":35,"tools":[...]}
```

## 5. 无 Token 兜底（评审不看 Token 也能跑）

```bash
$ unset MCD_MCP_TOKEN
$ node src/index.js --demo "30块吃饱"
> 数据源：本地兜底
[方案 1] 经典搭配  ¥28  ≈670kcal
  • 麦香鸡 ¥14  ...
```

## 6. 单元测试

```bash
$ node tests/run.js
 ✓ parseIntent 识别预算
 ✓ parseIntent 识别热量
 ✓ parseIntent 识别早餐场景
 ✓ compose 在预算内返回方案
 ✓ compose 在热量约束内
 ✓ planCouponUsage 找到最优组合
6 passed, 0 failed
```

## 本次实测调用的 MCP 工具清单

| 工具 | 用途 | 真实调通？ |
|---|---|---|
| `query-nearby-stores` | 上海人民广场附近门店 | ✅ 返回 5 家，含 storeCode/距离/营业时段 |
| `query-meals` | 华旭国际大厦餐厅菜单 | ✅ 122 餐品 / 17 分类 / 含促销价 |
| `calculate-price` | 整单核价 | ✅ 返回原价/现价/优惠/包装费/餐具费 |
| `list-nutrition-foods` | 营养数据 | ✅ 160 餐品 TOON 格式 |
| `auto-bind-coupons` | 一键领券 | ✅ 真实领到 3 张券 |
| `query-my-coupons` | 查我的券 | ✅ 已调通（账号下券数较少） |
| `tools/list` | 工具枚举 | ✅ 返回 35 个 |

> **合计真实接入 ≥ 6 个工具**，远超"至少一项"的参赛合规要求。
