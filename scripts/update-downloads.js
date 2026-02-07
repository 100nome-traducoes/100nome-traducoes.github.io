#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const API_KEY = process.env.REBRANDLY_API_KEY;

if (!API_KEY) {
  console.error('Falta a env REBRANDLY_API_KEY.');
  process.exit(1);
}

const jogosPath = path.join(__dirname, '..', 'data', 'jogos.json');
const downloadsPath = path.join(__dirname, '..', 'data', 'downloads.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function fetchRebrandlyLink(id) {
  const options = {
    hostname: 'api.rebrandly.com',
    path: `/v1/links/${id}`,
    method: 'GET',
    headers: {
      accept: 'application/json',
      apikey: API_KEY
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Rebrandly ${res.statusCode}: ${data}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const jogos = readJson(jogosPath);
  const downloads = fs.existsSync(downloadsPath) ? readJson(downloadsPath) : {};

  const jogosList = jogos.jogos || [];
  let updated = 0;

  for (const jogo of jogosList) {
    const guid = jogo.guid;
    const rebrandlyId = (jogo.rebrandlyId || '').trim();

    if (!downloads[guid]) {
      downloads[guid] = { downloads: null, downloadsUpdatedAt: null };
    }

    if (!rebrandlyId) {
      continue;
    }

    try {
      const info = await fetchRebrandlyLink(rebrandlyId);
      downloads[guid].downloads = typeof info.clicks === 'number' ? info.clicks : null;
      downloads[guid].downloadsUpdatedAt = new Date().toISOString();
      if (info.shortUrl) {
        jogo.downloadUrl = info.shortUrl.startsWith('http') ? info.shortUrl : `https://${info.shortUrl}`;
      }
      updated += 1;
      console.log(`Atualizado: ${guid} -> ${downloads[guid].downloads}`);
    } catch (err) {
      console.error(`Erro ao atualizar ${guid}: ${err.message}`);
    }
  }

  writeJson(downloadsPath, downloads);
  writeJson(jogosPath, jogos);
  console.log(`Total atualizados: ${updated}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
