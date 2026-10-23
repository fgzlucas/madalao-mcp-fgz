/**
 * 麦当劳 MCP 工具的高层封装。
 * 每个方法对应官方仓库 README 中的一个 Tool。
 * 仅做薄封装 + 容错，真正的协议细节在 client.js。
 */

const { McdMcpClient } = require('./client');

/**
 * MCP 工具返回的 content[0].text 通常是 markdown 包装：
 *   前面一段字段说明，然后是一个 JSON 字符串
 * 这个函数把 JSON 部分抠出来并解析。
 */
function extractPayload(mcpResult) {
  if (!mcpResult) return null;
  // 1. 已是业务对象（包含 success/data 且非空）
  if (!mcpResult.content
    && (mcpResult.success === true || (mcpResult.data !== undefined && mcpResult.data !== null))) {
    return mcpResult;
  }
  // 2. content[0].text
  const text = mcpResult.content && mcpResult.content[0] && mcpResult.content[0].text;
  if (typeof text === 'string') {
    // 优先找麦当劳业务 JSON 的特征锚点
    for (const anchor of ['{"success"', '{"code"', '{"data"', '{"meals"', '{"stores"', '{"coupons"']) {
      const i = text.indexOf(anchor);
      if (i < 0) continue;
      const r = tryParseAt(text, i);
      if (r) return r.obj;
    }
    // 兜底：任意第一个可解析的 JSON
    const json = extractFirstJson(text);
    if (json != null) return json;
    return { text };
  }
  return mcpResult;
}

/** 在字符串里抠出第一个能成功 JSON.parse 的完整对象/数组 */
function extractFirstJson(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== '{' && c !== '[') continue;
    // 从这个起始位尝试配对；成功则返回，失败则继续下一个 i
    const r = tryParseAt(text, i);
    if (r) return r.obj;
  }
  return null;
}

function tryParseAt(text, i) {
  const open = text[i];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < text.length && j < i + 500000; j++) {
    const ch = text[j];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const slice = text.slice(i, j + 1);
        try { return { obj: JSON.parse(slice), end: j }; }
        catch { return null; }
      }
    }
  }
  return null;
}

class McdTools {
  constructor(clientOrOpts) {
    this.client = clientOrOpts instanceof McdMcpClient
      ? clientOrOpts
      : new McdMcpClient(clientOrOpts || {});
  }

  async _call(name, args) {
    const r = await this.client.callTool(name, args);
    return extractPayload(r);
  }

  // ---------- 菜单 / 商品 ----------
  /** 查询当前门店可售卖的餐品列表 */
  async queryMeals(params = {}) {
    return this._call('query-meals', params);
  }

  /** 查询单个餐品详情（含套餐组成、可替换项） */
  async queryMealDetail(mealCode, params = {}) {
    return this._call('query-meal-detail', { mealCode, ...params });
  }

  /** 营养信息列表（热量/蛋白/脂肪/碳水/钠/钙） */
  async listNutritionFoods(params = {}) {
    return this._call('list-nutrition-foods', params);
  }

  // ---------- 门店 ----------
  /**
   * 查询附近的麦当劳门店
   * @param {object} args { beType:1|5, searchType:1|2, city, keyword }
   *   beType=1 到店自取; 5 得来速
   *   searchType=2 按位置搜（必填 city+keyword）; 1 收藏餐厅
   */
  async queryNearbyStores(args = {}) {
    const a = { beType: 1, searchType: 2, ...args };
    return this._call('query-nearby-stores', a);
  }

  /** 查询某地址可配送的门店 */
  async queryDeliveryStores(addressInfo) {
    return this._call('delivery-query-stores', addressInfo);
  }

  // ---------- 优惠券 ----------
  /** 查询当前门店下可用的优惠券列表 */
  async queryStoreCoupons(storeInfo) {
    return this._call('query-store-coupons', storeInfo);
  }

  /** 查询"我的"优惠券 */
  async queryMyCoupons(params = {}) {
    return this._call('query-my-coupons', params);
  }

  /** 一键领取麦麦省当前所有可领的券 */
  async autoBindCoupons(params = {}) {
    return this._call('auto-bind-coupons', params);
  }

  /** 麦麦省可领取的券列表 */
  async availableCoupons(params = {}) {
    return this._call('available-coupons', params);
  }

  // ---------- 订单 ----------
  /** 价格计算（含券后价） */
  async calculatePrice(orderInfo) {
    return this._call('calculate-price', orderInfo);
  }

  /** 创建订单（返回支付链接 payH5Url） */
  async createOrder(orderInfo) {
    return this._call('create-order', orderInfo);
  }

  /** 查询订单详情 */
  async queryOrder(orderId) {
    return this._call('query-order', { orderId });
  }

  /** 取消订单 */
  async cancelOrder(orderId) {
    return this._call('cancel-order', { orderId });
  }

  /** 历史订单（最近10笔，非商城） */
  async orderList(params = {}) {
    return this._call('order-list', params);
  }

  // ---------- 活动 & 其他 ----------
  /** 当月活动日历 */
  async campaignCalendar(params = {}) {
    return this._call('campaign-calendar', params);
  }

  /** 当前时间 */
  async nowTimeInfo() {
    return this._call('now-time-info', {});
  }

  /** 我的积分 */
  async queryMyAccount() {
    return this._call('query-my-account', {});
  }
}

module.exports = { McdTools };
