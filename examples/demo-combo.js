/**
 * 演示 1：智能凑单
 * 用法: node examples/demo-combo.js "30块两个人吃个饱"
 */

const path = require('path');
require('fs').readFileSync(path.join(__dirname, '..', '.env'), 'utf-8')
  .split(/\r?\n/).forEach(l => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });

const { McdTools } = require('../src/mcp/tools');
const { parseIntent } = require('../src/agent/intent');
const { compose } = require('../src/agent/composer');
const fallback = require('../src/data/fallback.json');

(async () => {
  const q = process.argv.slice(2).join(' ') || '30块两个人吃个饱';
  const intent = parseIntent(q);
  console.log('输入:', q);
  console.log('意图:', intent);

  const tools = new McdTools();
  let meals = fallback.meals, source = 'fallback';
  if (tools.client.hasToken) {
    try {
      const near = await tools.queryNearbyStores({ beType:1, searchType:2, city:'上海', keyword:'人民广场' });
      const s = near && near.data && near.data[0];
      if (s && s.storeCode) {
        const r = await tools.queryMeals({ storeCode: s.storeCode, orderType: 1, beType: 1 });
        if (r && r.data && r.data.meals && Object.keys(r.data.meals).length) {
          meals = r; source = `mcp · ${s.storeName}`;
        }
      }
    } catch (e) {
      console.log('(mcp 失败，回退本地)', e.message);
    }
  }
  console.log('数据源:', source);

  const combos = compose(meals, intent, 3);
  combos.forEach((c, i) => {
    console.log(`\n[方案${i + 1}] ${c.label}  总价 ¥${c.total}  ${c.kcal}kcal`);
    c.items.forEach(it => console.log(`  · ${it.name} ¥${it.price}`));
  });
})();
