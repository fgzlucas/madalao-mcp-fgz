/**
 * 优惠券最优解：
 * 给定我的券 + 购物清单，枚举用法，输出"哪几张该用、能省多少"。
 * 由于 calculate-price 可以接 couponIds，我们让 MCP 自己算精确价。
 */

function normalizeCoupons(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : (raw.coupons || raw.data || []);
  return list.map(c => ({
    id: c.id || c.couponId || c.code,
    name: c.name || c.title || '优惠券',
    type: c.type || 'unknown',           // discount / amount / gift
    threshold: Number(c.threshold ?? c.minSpend ?? 0),
    discount: Number(c.discount ?? c.amount ?? 0),  // 满减金额 或 折扣金额
    discountRate: c.discountRate || c.rate || null, // 0.85 = 85折
    expiresAt: c.expiresAt || c.validTo || null,
    raw: c,
  }));
}

/**
 * 给定购物清单小计 + 券池，枚举每种"用几张券"的组合，返回 Top N。
 * 由于算价由 MCP 服务器算（calculate-price 工具），我们这里只是生成
 * 候选方案。调用方再拿候选去打 calculate-price 拿真实价格。
 *
 * @param {Array} items      购物车 [{code,name,price,qty}]
 * @param {Array} coupons    我的券 normalizeCoupons 后的数组
 * @param {number} topK      返回前几个方案
 */
function planCouponUsage(items, coupons, topK = 3) {
  const sub = items.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const usable = normalizeCoupons(coupons)
    .filter(c => sub >= c.threshold);

  // 单券方案
  const singlePlans = usable.map(c => ({
    use: [c],
    expectSave: estimate(c, sub),
    note: c.discountRate
      ? `使用「${c.name}」可享 ${Math.round((1 - c.discountRate) * 100)}% 折扣`
      : `使用「${c.name}」可减 ¥${c.discount}`,
  }));

  // 组合方案：两两组合（避免爆炸）
  const combos = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const pair = [usable[i], usable[j]];
      combos.push({
        use: pair,
        expectSave: pair.reduce((s, c) => s + estimate(c, sub), 0),
        note: `组合使用「${pair[0].name}」+「${pair[1].name}」`,
      });
    }
  }

  const all = [...singlePlans, ...combos]
    .sort((a, b) => b.expectSave - a.expectSave)
    .slice(0, topK);

  return {
    subtotal: Math.round(sub * 100) / 100,
    usableCount: usable.length,
    plans: all,
  };
}

function estimate(c, sub) {
  if (c.discountRate) return sub * (1 - c.discountRate);
  return c.discount || 0;
}

module.exports = { planCouponUsage, normalizeCoupons };
