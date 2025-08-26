const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Static landing and assets
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));

// Placeholder routes referenced by the landing
app.get('/login', (req, res) => {
  res.send('<!doctype html><html><body><p>Login placeholder. <a href="/">Back</a></p></body></html>');
});
app.get('/register', (req, res) => {
  res.send('<!doctype html><html><body><p>Register placeholder. <a href="/">Back</a></p></body></html>');
});
app.get('/p/:qrId', (req, res) => {
  const { qrId } = req.params;
  res.send(`<!doctype html><html><body><h1>Public Pet Page</h1><p>QR ID: ${qrId}</p><p>(Placeholder)</p><p><a href="/">Back to landing</a></p></body></html>`);
});

// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Petfinder server running on http://localhost:${PORT}`);
});
