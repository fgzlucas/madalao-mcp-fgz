/**
 * 麦当劳 MCP 客户端 (Streamable HTTP + JSON-RPC 2.0)
 * 官方接入文档: https://github.com/M-China/mcd-mcp-server
 *
 * - Server URL : https://mcp.mcd.cn
 * - Transport  : Streamable HTTP
 * - Auth       : Authorization: Bearer <MCP_TOKEN>
 * - Rate limit : 600 req / min / token
 */

const DEFAULT_ENDPOINT = 'https://mcp.mcd.cn';
const PROTOCOL_VERSION = '2025-03-26';

class McpError extends Error {
  constructor(message, code, data) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.data = data;
  }
}

class McdMcpClient {
  /**
   * @param {object} opts
   * @param {string} opts.token   MCP Token (必填，除非你想用 mock)
   * @param {string} [opts.endpoint]
   * @param {number} [opts.timeoutMs]
   */
  constructor(opts = {}) {
    this.token = opts.token || process.env.MCD_MCP_TOKEN || '';
    this.endpoint = opts.endpoint || process.env.MCD_MCP_URL || DEFAULT_ENDPOINT;
    this.timeoutMs = opts.timeoutMs || 30_000;
    this._id = 0;
    this._sessionId = null;
    this._initialized = false;
  }

  get hasToken() {
    return Boolean(this.token);
  }

  _nextId() {
    return ++this._id;
  }

  _headers(extra = {}) {
    const h = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...extra,
    };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    if (this._sessionId) h['Mcp-Session-Id'] = this._sessionId;
    return h;
  }

  /**
   * 发送一个 JSON-RPC 请求。返回 result 字段。
   * 支持服务端返回 application/json 或 text/event-stream(SSE)。
   */
  async _rpc(method, params = {}) {
    const body = {
      jsonrpc: '2.0',
      id: this._nextId(),
      method,
      params,
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let resp;
    try {
      resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    // 记录 session id（服务器可能会下发）
    const sid = resp.headers.get('mcp-session-id');
    if (sid) this._sessionId = sid;

    if (resp.status === 401) {
      throw new McpError('MCP Token 无效或过期 (401)', 401);
    }
    if (resp.status === 429) {
      throw new McpError('触发限流 (>600/min)，请稍后再试 (429)', 429);
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new McpError(`HTTP ${resp.status}: ${text.slice(0, 200)}`, resp.status);
    }

    const ct = resp.headers.get('content-type') || '';
    let payload;
    if (ct.includes('text/event-stream')) {
      payload = await this._readSse(resp);
    } else {
      payload = await resp.json();
    }

    if (payload && payload.error) {
      throw new McpError(payload.error.message || 'MCP error', payload.error.code, payload.error.data);
    }
    return payload ? payload.result : null;
  }

  /** 读取 SSE 流，提取最后一个 JSON-RPC 响应 */
  async _readSse(resp) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';
    let lastData = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE 事件以空行分隔
      const events = buf.split(/\r?\n\r?\n/);
      buf = events.pop() || '';
      for (const ev of events) {
        const lines = ev.split(/\r?\n/);
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const d = line.slice(5).trim();
            if (d) {
              try { lastData = JSON.parse(d); } catch { /* ignore */ }
            }
          }
        }
      }
    }
    return lastData;
  }

  /** 初始化握手。服务端可选；失败也只是警告。 */
  async initialize() {
    if (this._initialized) return;
    try {
      await this._rpc('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'madalao-mcp-fgz', version: '0.1.0' },
      });
      // notification: initialized
      try {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: this._headers(),
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
          }),
        });
      } catch { /* ignore */ }
    } catch (e) {
      // 不阻塞，部分实现可能不需要 init
      if (process.env.DEBUG) console.warn('[mcp] initialize warn:', e.message);
    }
    this._initialized = true;
  }

  /** 列出服务器支持的全部工具 */
  async listTools() {
    await this.initialize();
    const r = await this._rpc('tools/list', {});
    return (r && r.tools) || [];
  }

  /**
   * 调用一个工具
   * @param {string} name 工具名 (例如 'query-meals')
   * @param {object} args 入参
   */
  async callTool(name, args = {}) {
    await this.initialize();
    const r = await this._rpc('tools/call', { name, arguments: args });
    return r;
  }

  /** 关闭会话（可选） */
  async close() {
    if (!this._sessionId) return;
    try {
      await fetch(this.endpoint, {
        method: 'DELETE',
        headers: this._headers(),
      });
    } catch { /* ignore */ }
    this._sessionId = null;
    this._initialized = false;
  }
}

module.exports = { McdMcpClient, McpError, DEFAULT_ENDPOINT };
