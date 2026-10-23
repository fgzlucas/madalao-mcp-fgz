/** 最小自测：意图解析 + 凑单算法 + 优惠券规划（不依赖 Token） */
const assert = require('assert');
const { parseIntent } = require('../src/agent/intent');
const { compose } = require('../src/agent/composer');
const { planCouponUsage } = require('../src/agent/coupon');
const fallback = require('../src/data/fallback.json');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(' ✓', name); }
  catch (e) { fail++; console.error(' ✗', name, '-', e.message); }
}

t('parseIntent 识别预算', () => {
  const r = parseIntent('30块两个人吃个饱');
  assert.strictEqual(r.budget, 30);
  assert.strictEqual(r.people, 2);
});

t('parseIntent 识别热量', () => {
  const r = parseIntent('减脂期500卡以内');
  assert.strictEqual(r.kcalMax, 500);
  assert.ok(r.tags.includes('减脂'));
});

t('parseIntent 识别早餐场景', () => {
  const r = parseIntent('明早想吃个麦当劳早餐');
  assert.strictEqual(r.scene, 'breakfast');
});

t('compose 在预算内返回方案', () => {
  const r = compose(fallback.meals, { budget: 30, people: 2, tags: [], scene: 'any' });
  assert.ok(r.length >= 1);
  assert.ok(r[0].total <= 30);
});

t('compose 在热量约束内', () => {
  const r = compose(fallback.meals, { kcalMax: 500, tags: ['减脂'], scene: 'any' });
  assert.ok(r.length >= 1);
  assert.ok(r[0].kcal <= 500);
});

t('planCouponUsage 找到最优组合', () => {
  const items = [{ code: 'A', price: 25, qty: 1 }, { code: 'B', price: 10, qty: 1 }];
  const coupons = [
    { id: 'c1', name: '满40减8', threshold: 40, discount: 8 },
    { id: 'c2', name: '88折', threshold: 0, discountRate: 0.88 },
  ];
  const r = planCouponUsage(items, coupons);
  assert.ok(r.usableCount >= 1);
  assert.ok(r.plans[0].expectSave > 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
