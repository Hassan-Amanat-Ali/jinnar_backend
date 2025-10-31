#!/usr/bin/env node
// Lightweight smoke-test script for public endpoints.
// Run while the dev server is running: `node scripts/smoke.js`

const http = require('http');
const https = require('https');
const urls = [
  'http://localhost:3000/',
  'http://localhost:3000/api-docs',
  'http://localhost:3000/api/gigs',
  'http://localhost:3000/api',
  'http://localhost:3000/uploads'
];

function fetchUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      const { statusCode } = res;
      let body = '';
      res.on('data', (chunk) => (body += chunk.toString()));
      res.on('end', () => resolve({ url, statusCode, body: body.slice(0, 200) }));
    });
    req.on('error', (err) => resolve({ url, error: err.message }));
    req.setTimeout(5000, () => {
      req.abort();
      resolve({ url, error: 'timeout' });
    });
  });
}

(async () => {
  console.log('Running smoke tests (GET) against public endpoints...');
  for (const u of urls) {
    const res = await fetchUrl(u);
    if (res.error) {
      console.log(`FAIL ${u} -> ${res.error}`);
    } else {
      console.log(`OK   ${u} -> ${res.statusCode}`);
      if (res.body) console.log(`      ${res.body.replace(/\n/g, ' ').slice(0, 120)}...`);
    }
  }
  console.log('Smoke tests finished. For protected endpoints or POST routes run manual tests or use Postman with a valid JWT.');
})();
