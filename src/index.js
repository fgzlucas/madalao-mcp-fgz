#!/usr/bin/env node
/**
 * 麦大佬 madalao-mcp-fgz —— CLI 入口
 *
 * 用法：
 *   node src/index.js "30 块钱两个人吃个饱"
 *   node src/index.js --demo            # 使用本地兜底数据，无需 Token
 *   node src/index.js --http            # 启动 HTTP 服务
 */

const path = require('path');
const fs = require('fs');

// 简单加载 .env
(function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
})();

const { McdTools } = require('./mcp/tools');
const { parseIntent } = require('./agent/intent');
const { compose, parseNutrition, enrichWithNutrition } = require('./agent/composer');
const { planCouponUsage } = require('./agent/coupon');
const fallback = require('./data/fallback.json');

const args = process.argv.slice(2);
const useDemo = args.includes('--demo');
const useHttp = args.includes('--http');
const useCoupons = args.includes('--coupon');
const query = args.filter(a => !a.startsWith('--')).join(' ');

function fmtCombo(c, i) {
  const lines = [`\n[方案 ${i + 1}] ${c.label}  ¥${c.total}  ≈${c.kcal}kcal`];
  for (const it of c.items) {
    lines.push(`  • ${it.name}  ¥${it.price}  (${it.kcal}kcal)`);
  }
  return lines.join('\n');
}

async function getMeals(tools, intent, ctx = {}) {
  if (useDemo || !tools.client.hasToken) {
    return { source: 'fallback', meals: fallback.meals };
  }
  try {
    // 真实链路：query-nearby-stores 拿门店 -> query-meals 拿菜单
    const city = ctx.city || process.env.MCD_CITY || '上海';
    const keyword = ctx.keyword || process.env.MCD_KEYWORD || '人民广场';
    let storeCode = null, beCode = null;
    try {
      const near = await tools.queryNearbyStores({
        beType: 1, searchType: 2, city, keyword,
      });
      const stores = near && (near.data || near.stores || (Array.isArray(near) ? near : null));
      if (Array.isArray(stores) && stores.length) {
        const s = stores[0];
        storeCode = s.storeCode;
        beCode = s.beCode;
        ctx._storeName = s.storeName;
        ctx._distance = s.distance;
      }
    } catch (e) {
      console.log(`(query-nearby-stores 失败: ${e.message})`);
    }
    const params = { orderType: 1, beType: 1 };
    if (storeCode) params.storeCode = storeCode;
    if (beCode) params.beCode = beCode;
    const r = await tools.queryMeals(params);
    // 真实 MCP: r.data.meals 是 map{code:detail}; r.data.categories 是分类
    const hasMcpData = r && r.data && r.data.meals && typeof r.data.meals === 'object'
      && Object.keys(r.data.meals).length > 0;
    if (hasMcpData) {
      ctx._storeCode = storeCode;
      ctx._beCode = beCode;
      return { source: 'mcp', meals: r, storeCode };
    }
    return { source: 'fallback', meals: fallback.meals };
  } catch (e) {
    console.error(`[mcp] query-meals 失败，使用兜底数据：${e.message}`);
    return { source: 'fallback', meals: fallback.meals };
  }
}

async function runCombo() {
  const intent = parseIntent(query || '30块吃饱');
  console.log(`> 解析意图：${JSON.stringify({ ...intent, raw: undefined })}`);

  const tools = new McdTools();
  const ctx = {};
  let { source, meals } = await getMeals(tools, intent, ctx);

  // 拉营养数据合并 kcal
  if (!useDemo && tools.client.hasToken) {
    try {
      const nut = await tools.listNutritionFoods();
      const nutMap = parseNutrition(nut);
      if (nutMap.size) {
        const normalized = enrichWithNutrition(
          require('./agent/composer').normalizeMeals(meals),
          nutMap
        );
        meals = normalized;
      }
    } catch (e) { /* ignore */ }
  }
  const srcTxt = source === 'mcp'
    ? `麦当劳 MCP 实时${ctx._storeName ? ` · ${ctx._storeName} (${ctx._distance}m)` : ''}`
    : '本地兜底';
  console.log(`> 数据源：${srcTxt}`);

  const combos = compose(meals, intent, 3);
  if (!combos.length) {
    console.log('没找到合适搭配，试试放宽预算或热量限制。');
    return;
  }
  combos.forEach((c, i) => console.log(fmtCombo(c, i)));

  // 如果走了真实 MCP，让 calculate-price 真实核价（需要 storeCode/orderType/beType）
  if (!useDemo && tools.client.hasToken && ctx._storeCode) {
    try {
      const items = combos[0].items.map(x => ({ productCode: x.code, quantity: 1 }));
      const price = await tools.calculatePrice({
        storeCode: ctx._storeCode,
        orderType: 1,
        beType: 1,
        items,
      });
      const d = price && price.data;
      if (d) {
        const fen = v => (Number(v || 0) / 100).toFixed(2);
        console.log('\n[MCP calculate-price] 真实核价：');
        console.log(`  商品原价 ¥${fen(d.productOriginalPrice)}  现价 ¥${fen(d.productPrice)}`);
        console.log(`  优惠 ¥${fen(d.discountPrice)}  应付 ¥${fen(d.price)}`);
        console.log(`  包装费 ¥${fen(d.packingPrice)}  餐具费 ¥${fen(d.tablewarePrice)}`);
      } else {
        console.log('\n[MCP calculate-price] ', JSON.stringify(price).slice(0, 400));
      }
    } catch (e) {
      console.log(`\n(calculate-price 暂不可用：${e.message})`);
    }
  }
}

async function runCoupon() {
  const tools = new McdTools();
  if (!tools.client.hasToken) {
    console.log('未提供 MCD_MCP_TOKEN，使用演示券数据。');
  }
  // 演示购物车
  const items = [
    { code: 'BIGMAC', name: '巨无霸', price: 25.0, qty: 1 },
    { code: 'FRIES_M', name: '中薯条', price: 10.0, qty: 1 },
    { code: 'COKE_M', name: '中杯可乐', price: 8.0, qty: 1 },
  ];
  const demoCoupons = [
    { id: 'C1', name: '满 40 减 8', threshold: 40, discount: 8 },
    { id: 'C2', name: '汉堡 88 折', threshold: 0, discountRate: 0.88 },
    { id: 'C3', name: '满 30 减 5', threshold: 30, discount: 5 },
  ];

  let coupons = demoCoupons;
  if (tools.client.hasToken) {
    try {
      const r = await tools.queryMyCoupons();
      const list = r && (r.coupons || r.data || r);
      if (Array.isArray(list) && list.length) coupons = list;
    } catch (e) {
      console.log(`(query-my-coupons 不可用：${e.message})`);
    }
  }

  const plan = planCouponUsage(items, coupons);
  console.log(`\n购物车小计 ¥${plan.subtotal}，可用券 ${plan.usableCount} 张`);
  plan.plans.forEach((p, i) => {
    console.log(`  [${i + 1}] ${p.note} —— 预计省 ¥${p.expectSave.toFixed(2)}`);
  });
}

async function runHttp() {
  const port = Number(process.env.PORT || 8787);
  const http = require('http');
  const tools = new McdTools();
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.end(); return; }

    const url = new URL(req.url, `http://localhost:${port}`);
    try {
      if (url.pathname === '/api/compose') {
        const q = url.searchParams.get('q') || '';
        const intent = parseIntent(q);
        const { meals, source } = await getMeals(tools, intent);
        const combos = compose(meals, intent, 3);
        res.end(JSON.stringify({ source, intent, combos }));
      } else if (url.pathname === '/api/coupons') {
        const r = tools.client.hasToken ? await tools.queryMyCoupons() : { demo: true };
        res.end(JSON.stringify(r));
      } else if (url.pathname === '/api/tools') {
        const list = tools.client.hasToken ? await tools.client.listTools() : [];
        res.end(JSON.stringify({ count: list.length, tools: list }));
      } else if (url.pathname === '/health') {
        res.end(JSON.stringify({ ok: true, hasToken: tools.client.hasToken }));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'not found' }));
      }
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  });
  server.listen(port, () => {
    console.log(`madalao-mcp-fgz HTTP listening on http://localhost:${port}`);
    console.log(`  GET /api/compose?q=30块两个人`);
    console.log(`  GET /api/coupons`);
    console.log(`  GET /api/tools`);
    console.log(`  GET /health`);
  });
}

(async () => {
  if (useHttp) return runHttp();
  if (useCoupons) return runCoupon();
  return runCombo();
})().catch(e => {
  console.error('运行失败：', e);
  process.exit(1);
});
