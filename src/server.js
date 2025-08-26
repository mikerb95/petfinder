const app = require('./app');
const config = require('./config');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Petfinder server running on http://localhost:${PORT} (env: ${config.env})`);
});
