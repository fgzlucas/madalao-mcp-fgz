/**
 * 极简意图解析：把"30块钱两个人吃"这种中文口语
 * 解析成结构化参数，交给凑单算法。
 */

const NUM_MAP = {
  '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
};

function toNumber(s) {
  if (s == null) return null;
  if (typeof s === 'number') return s;
  const m = String(s).match(/(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  return NUM_MAP[s] || null;
}

/**
 * @param {string} text 用户输入
 * @returns {{
 *   budget: number|null,
 *   people: number,
 *   kcalMax: number|null,
 *   scene: 'breakfast'|'lunch'|'dinner'|'snack'|'any',
 *   tags: string[],
 *   raw: string
 * }}
 */
function parseIntent(text) {
  const raw = String(text || '').trim();
  const lower = raw.toLowerCase();

  // 预算：30块 / 30元 / 30以内 / ¥30 / budget 30
  let budget = null;
  const budgetPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:元|块|¥|rmb)/i,
    /(?:预算|不超过|以内|之内|最多)\D{0,4}(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*以内/,
  ];
  for (const p of budgetPatterns) {
    const m = raw.match(p);
    if (m) { budget = parseFloat(m[1]); break; }
  }

  // 人数
  let people = 1;
  const peoplePatterns = [
    /(\d+)\s*(?:个人|人吃|人份|口)/,
    /(一|二|两|三|四|五|六|七|八|九|十)\s*(?:个人|人吃|人份)/,
    /(一个人|两个人|俩人|仨)/,
  ];
  for (const p of peoplePatterns) {
    const m = raw.match(p);
    if (m) {
      if (m[0] === '一个人') people = 1;
      else if (m[0] === '两个人' || m[0] === '俩人') people = 2;
      else if (m[0] === '仨') people = 3;
      else people = toNumber(m[1]) || 1;
      break;
    }
  }

  // 热量上限
  let kcalMax = null;
  const kcalPatterns = [
    /(\d+)\s*(?:卡|千卡|kcal|大卡)/i,
    /热量\D{0,4}(\d+)/,
  ];
  for (const p of kcalPatterns) {
    const m = raw.match(p);
    if (m) { kcalMax = parseInt(m[1], 10); break; }
  }

  // 场景
  let scene = 'any';
  if (/早餐|早饭|早上|breakfast/i.test(lower)) scene = 'breakfast';
  else if (/午餐|午饭|中午|lunch/i.test(lower)) scene = 'lunch';
  else if (/晚餐|晚饭|加班|夜宵|dinner/i.test(lower)) scene = 'dinner';
  else if (/下午茶|零食|甜品|snack/i.test(lower)) scene = 'snack';

  // 偏好 tag
  const tags = [];
  if (/减脂|低卡|健康|减肥|健身/.test(raw)) tags.push('减脂');
  if (/辣|spicy/i.test(lower)) tags.push('辣');
  if (/素|蔬菜|沙拉/.test(raw)) tags.push('素');
  if (/牛肉/.test(raw)) tags.push('牛肉');
  if (/鸡/.test(raw)) tags.push('鸡肉');
  if (/鱼|鳕/.test(raw)) tags.push('鱼');
  if (/甜|冰淇淋|麦旋风/.test(raw)) tags.push('甜品');
  if (/无糖/.test(raw)) tags.push('无糖');
  if (/招牌|经典|必点/.test(raw)) tags.push('招牌');

  return { budget, people, kcalMax, scene, tags, raw };
}

module.exports = { parseIntent };
