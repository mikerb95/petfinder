const http = require('http');
const app = require('../src/app');

function check(path) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: server.address().port, path }, (res) => {
      // Drain response to free socket
      res.resume();
      resolve({ path, status: res.statusCode });
    });
    req.on('error', (err) => {
      resolve({ path, error: err.message });
    });
  });
}

const server = http.createServer(app);
server.listen(0, async () => {
  try {
    const results = [];
    results.push(await check('/m'));
    results.push(await check('/tech'));
  results.push(await check('/shop'));
  results.push(await check('/blog'));
  results.push(await check('/admin/products'));
  results.push(await check('/admin/blog'));
    results.forEach((r) => {
      if (r.error) {
        console.error(`${r.path} ERROR ${r.error}`);
      } else {
        console.log(`${r.path} ${r.status}`);
      }
    });
  } finally {
    server.close();
  }
});
