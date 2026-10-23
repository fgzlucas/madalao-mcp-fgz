/**
 * 演示 3：HTTP 服务
 * 用法: node examples/demo-http.js
 * 启动后访问: http://localhost:8787/api/compose?q=30块两个人
 */

process.argv.push('--http');
require('../src/index.js');
