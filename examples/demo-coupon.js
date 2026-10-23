/**
 * 演示 2：一键领券 + 我的券 + 算最优用法
 * 用法: node examples/demo-coupon.js
 */

const path = require('path');
require('fs').readFileSync(path.join(__dirname, '..', '.env'), 'utf-8')
  .split(/\r?\n/).forEach(l => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });

const { McdTools } = require('../src/mcp/tools');
const { planCouponUsage } = require('../src/agent/coupon');

(async () => {
  const tools = new McdTools();
  if (!tools.client.hasToken) {
    console.log('没有 MCD_MCP_TOKEN，无法演示真实券');
    return;
  }

  console.log('=== Step 1: 一键领券 (auto-bind-coupons) ===');
  try {
    const r = await tools.autoBindCoupons();
    console.log(JSON.stringify(r, null, 2).slice(0, 1000));
  } catch (e) { console.log('ERR:', e.message); }

  console.log('\n=== Step 2: 查我的券 (query-my-coupons) ===');
  let coupons = [];
  try {
    const r = await tools.queryMyCoupons();
    coupons = r && (r.coupons || r.data || r.content || r);
    if (!Array.isArray(coupons)) coupons = [];
    console.log(`共 ${coupons.length} 张券`);
    coupons.slice(0, 5).forEach(c => {
      const n = c.name || c.title || c.couponName || JSON.stringify(c).slice(0, 60);
      console.log(' ·', n);
    });
  } catch (e) { console.log('ERR:', e.message); }

  console.log('\n=== Step 3: 购物车算最优用法 ===');
  const items = [
    { code: 'BIGMAC', name: '巨无霸', price: 25.0, qty: 1 },
    { code: 'FRIES_M', name: '中薯条', price: 10.0, qty: 1 },
    { code: 'COKE_M', name: '中可乐', price: 8.0, qty: 1 },
  ];
  const plan = planCouponUsage(items, coupons);
  console.log(`小计 ¥${plan.subtotal}  可用券 ${plan.usableCount} 张`);
  plan.plans.forEach((p, i) => console.log(` [${i + 1}]`, p.note));
})();
