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
    // core
    results.push(await check('/'));
    results.push(await check('/m'));
    results.push(await check('/tech'));
  results.push(await check('/dashboard'));
  results.push(await check('/adopt'));
  results.push(await check('/bnb'));
    // shop
    results.push(await check('/shop'));
    results.push(await check('/shop/test-product'));
    results.push(await check('/cart'));
    results.push(await check('/checkout'));
    results.push(await check('/payment'));
    results.push(await check('/order_confirmed'));
    results.push(await check('/order_lookup'));
    // blog
    results.push(await check('/blog'));
    results.push(await check('/blog/editor'));
    results.push(await check('/blog/hello-world'));
    // auth/static
    results.push(await check('/login'));
    results.push(await check('/register'));
    results.push(await check('/forgot'));
    results.push(await check('/reset'));
    results.push(await check('/contact'));
    results.push(await check('/terms'));
    results.push(await check('/privacy'));
    results.push(await check('/scan'));
    // admin
    results.push(await check('/admin/products'));
    results.push(await check('/admin/blog'));
    // pet public
    results.push(await check('/p/abc123'));
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
