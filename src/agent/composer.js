/**
 * 凑单算法：在预算约束下，从可选餐品中生成 1~3 套搭配。
 *
 * 策略：
 *  - 优先匹配场景 & tag 命中度
 *  - 保证至少有 1 主食 + 1 饮品（场景为 snack 时放宽）
 *  - 在剩余预算内，用价值密度最高的单品填充
 */

function normalizeMeals(raw) {
  if (!raw) return [];
  let list = [];
  // 1) 直接是数组（fallback 数据）
  if (Array.isArray(raw)) list = raw;
  // 2) {meals:[...]} 数组形式
  else if (Array.isArray(raw.meals)) list = raw.meals;
  // 3) 真实 MCP: {data:{meals:{code:{...}}, categories:[...]}}
  else if (raw.data && raw.data.meals && typeof raw.data.meals === 'object' && !Array.isArray(raw.data.meals)) {
    const map = raw.data.meals;
    list = Object.keys(map).map(code => ({ code, ...map[code] }));
  }
  // 4) {meals:{code:{...}}} 同上但不包 data
  else if (raw.meals && typeof raw.meals === 'object' && !Array.isArray(raw.meals)) {
    const map = raw.meals;
    list = Object.keys(map).map(code => ({ code, ...map[code] }));
  }
  // 5) {data:[...]}
  else if (Array.isArray(raw.data)) list = raw.data;

  return list.map(m => {
    const price = Number(m.price ?? m.currentPrice ?? m.salePrice ?? m.listPrice ?? m.originalPrice ?? 0);
    const tags = Array.isArray(m.tags) ? m.tags.map(t => typeof t === 'string' ? t : (t.name || t.tag || '')) : [];
    const name = m.name || m.mealName || m.title || '';
    return {
      code: m.code || m.mealCode || m.sku || m.id,
      name,
      category: m.category || m.categoryName || m.cat || guessCategory(name),
      price,
      kcal: Number(m.kcal ?? m.calorie ?? m.energy ?? 0),
      tags,
      raw: m,
    };
  }).filter(m => m.code && m.name && m.price > 3 && !isSauce(m.name));
}

/**
 * 解析 list-nutrition-foods 返回的 TOON 紧凑格式:
 *   data 字段是一段字符串，第一行声明列名，后续每行一条记录
 *   "[160]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:\n  猪柳麦满分,null,1288,308,..."
 * 返回 Map: productName -> {kcal, protein, fat, ...}
 */
function parseNutrition(rawResp) {
  const text = rawResp && rawResp.data;
  if (typeof text !== 'string') return new Map();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return new Map();
  const headerMatch = lines[0].match(/\{([^}]+)\}/);
  if (!headerMatch) return new Map();
  const cols = headerMatch[1].split(',').map(s => s.trim());
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(s => s.trim());
    if (cells.length < cols.length) continue;
    const row = {};
    cols.forEach((c, k) => { row[c] = cells[k] === 'null' ? null : cells[k]; });
    const name = row.productName;
    if (name) {
      map.set(name, {
        kcal: Number(row.energyKcal) || 0,
        protein: Number(row.protein) || 0,
        fat: Number(row.fat) || 0,
        carbohydrate: Number(row.carbohydrate) || 0,
        sodium: Number(row.sodium) || 0,
        calcium: Number(row.calcium) || 0,
      });
    }
  }
  return map;
}

/** 把营养数据合并进餐品列表（按 name 匹配） */
function enrichWithNutrition(meals, nutritionMap) {
  if (!nutritionMap || !nutritionMap.size) return meals;
  return meals.map(m => {
    // 名字里去掉空格/横线再匹配
    const key1 = (m.name || '').replace(/[\s\-]/g, '');
    for (const [nName, nut] of nutritionMap) {
      const key2 = nName.replace(/[\s\-]/g, '');
      if (key1 === key2 || key1.includes(key2) || key2.includes(key1)) {
        return { ...m, kcal: nut.kcal || m.kcal, nutrition: nut };
      }
    }
    return m;
  });
}

// 过滤酱料/餐具/玩具/不可单点的项
function isSauce(name) {
  return /酱|蘸料|调味料|餐具|纸巾|勺|叉|吸管|盘|杯盖|糖醋|辣酱|番茄酱|蒜香|芥末|芝士酱|牧场酱|贴|玩具|公仔|盲盒|积木|冰箱贴|收纳|杯垫|钥匙扣|徽章|明信片|笔记本|贴纸|马克杯|保温杯|袋/i.test(name);
}

// 真实 MCP 不返回 category，按名字粗分
function guessCategory(name) {
  const n = String(name || '');
  if (/堡|卷|Big ?Mac|McChicken|Sandwich/i.test(n)) return '汉堡';
  if (/可乐|雪碧|橙汁|咖啡|奶茶|牛奶|柠檬|矿泉水|Coke|Sprite/i.test(n)) return '饮品';
  if (/派|冰淇淋|麦旋风|圣代|圆筒|布丁|蛋糕/i.test(n)) return '甜品';
  if (/薯|鸡|蛋|麦乐|油条|粥|卷饼|麦满分|早/i.test(n)) return '小食';
  if (/沙拉|玉米|水果|蔬菜/i.test(n)) return '小食';
  return '其他';
}

function scoreMeal(meal, intent) {
  let s = 0;
  // tag 命中
  for (const t of intent.tags) {
    if (meal.tags.includes(t) || (meal.name && meal.name.includes(t))) s += 5;
  }
  // 场景命中
  if (intent.scene === 'breakfast' && meal.category === '早餐') s += 8;
  if (intent.scene === 'snack' && (meal.category === '甜品' || meal.category === '小食')) s += 6;
  if ((intent.scene === 'lunch' || intent.scene === 'dinner') && meal.category === '汉堡') s += 4;
  // 性价比（价格越低分越高一点）
  s += Math.max(0, 5 - meal.price / 10);
  return s;
}

function pickTop(meals, intent, exclude = new Set()) {
  return meals
    .filter(m => !exclude.has(m.code))
    .map(m => ({ m, s: scoreMeal(m, intent) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.m);
}

/**
 * 生成一套方案
 */
function buildOneCombo(meals, intent, opts = {}) {
  const budget = intent.budget;
  const kcalMax = intent.kcalMax;
  const picked = [];
  let total = 0;
  let kcal = 0;

  const sorted = pickTop(meals, intent, opts.exclude);

  const tryAdd = (m) => {
    if (picked.find(p => p.code === m.code)) return false;
    if (budget != null && total + m.price > budget) return false;
    if (kcalMax != null && kcal + m.kcal > kcalMax) return false;
    picked.push(m);
    total += m.price;
    kcal += m.kcal;
    return true;
  };

  // 第一步：按场景选主菜
  if (intent.scene === 'breakfast') {
    const m = sorted.find(x => x.category === '早餐');
    if (m) tryAdd(m);
  } else if (intent.scene === 'snack') {
    const m = sorted.find(x => x.category === '甜品' || x.category === '小食');
    if (m) tryAdd(m);
  } else {
    const m = sorted.find(x => x.category === '汉堡');
    if (m) tryAdd(m);
  }

  // 第二步：补一个饮品（除非 snack）
  if (intent.scene !== 'snack' && intent.scene !== 'breakfast') {
    const d = sorted.find(x => x.category === '饮品');
    if (d) tryAdd(d);
  }

  // 第三步：按得分填剩余空间，直到装不下或够 4 样
  for (const m of sorted) {
    if (picked.length >= (opts.maxItems || 4)) break;
    tryAdd(m);
  }

  if (!picked.length) return null;
  return { items: picked, total: round2(total), kcal };
}

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * 对外主入口：生成最多 k 套方案
 */
function compose(mealsRaw, intent, k = 3) {
  const meals = normalizeMeals(mealsRaw);
  if (!meals.length) return [];

  const results = [];
  const usedSignatures = new Set();

  // 方案 1：常规最优
  const c1 = buildOneCombo(meals, intent);
  if (c1) {
    usedSignatures.add(signature(c1));
    results.push({ label: '经典搭配', ...c1 });
  }

  // 方案 2：排除方案 1 主菜，给替代
  if (c1 && results.length < k) {
    const exclude = new Set([c1.items[0].code]);
    const c2 = buildOneCombo(meals, intent, { exclude });
    if (c2 && !usedSignatures.has(signature(c2))) {
      usedSignatures.add(signature(c2));
      results.push({ label: '换种口味', ...c2 });
    }
  }

  // 方案 3：低热量 / 极限性价比
  if (results.length < k) {
    const alt = { ...intent, tags: [...intent.tags, '减脂'], scene: intent.scene };
    const cheap = meals.filter(m => m.price <= 12);
    const c3 = buildOneCombo(cheap.length ? cheap : meals, alt, { maxItems: 3 });
    if (c3 && !usedSignatures.has(signature(c3))) {
      usedSignatures.add(signature(c3));
      results.push({ label: '省钱轻量', ...c3 });
    }
  }

  return results;
}

function signature(combo) {
  return combo.items.map(i => i.code).sort().join('|');
}

module.exports = { compose, normalizeMeals, parseNutrition, enrichWithNutrition };
