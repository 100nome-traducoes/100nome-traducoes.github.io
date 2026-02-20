#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const API_KEY = process.env.REBRANDLY_API_KEY;

if (!API_KEY) {
  console.error('Falta a env REBRANDLY_API_KEY.');
  process.exit(1);
}

const jogosPath = path.join(__dirname, '..', 'data', 'game-content', 'jogos.json');
const downloadsPath = path.join(__dirname, '..', 'data', 'game-content', 'downloads.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getGameSlug(jogo) {
  return String(jogo?.slug || jogo?.guid || '').trim();
}

function pickMostRecentTimestamp(a, b) {
  const aTime = Date.parse(a || '');
  const bTime = Date.parse(b || '');
  if (Number.isNaN(aTime)) return b || null;
  if (Number.isNaN(bTime)) return a || null;
  return aTime >= bTime ? a : b;
}

function mergeDownloadEntry(current = {}, incoming = {}) {
  const currentDownloads = typeof current.downloads === 'number' ? current.downloads : null;
  const incomingDownloads = typeof incoming.downloads === 'number' ? incoming.downloads : null;

  let downloads = null;
  if (currentDownloads !== null && incomingDownloads !== null) {
    downloads = Math.max(currentDownloads, incomingDownloads);
  } else {
    downloads = currentDownloads ?? incomingDownloads;
  }

  return {
    downloads,
    downloadsUpdatedAt: pickMostRecentTimestamp(current.downloadsUpdatedAt, incoming.downloadsUpdatedAt)
  };
}

function normalizeDownloadsBySlug(existingDownloads, jogosList) {
  const guidToSlug = {};
  const validSlugs = new Set();

  for (const jogo of jogosList) {
    const guid = String(jogo?.guid || '').trim();
    const slug = getGameSlug(jogo);
    if (!slug) continue;
    validSlugs.add(slug);
    if (guid) guidToSlug[guid] = slug;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(existingDownloads || {})) {
    const slug = guidToSlug[key] || (validSlugs.has(key) ? key : null);
    if (!slug) continue;
    normalized[slug] = mergeDownloadEntry(normalized[slug], value || {});
  }

  return normalized;
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
  const jogosList = jogos.jogos || [];
  const existingDownloads = fs.existsSync(downloadsPath) ? readJson(downloadsPath) : {};
  const downloads = normalizeDownloadsBySlug(existingDownloads, jogosList);
  let updated = 0;

  for (const jogo of jogosList) {
    const guid = String(jogo.guid || '').trim();
    const slug = getGameSlug(jogo);
    const rebrandlyId = (jogo.rebrandlyId || '').trim();
    if (!slug) continue;

    if (!downloads[slug]) {
      downloads[slug] = { downloads: null, downloadsUpdatedAt: null };
    }

    if (!rebrandlyId) {
      continue;
    }

    try {
      const info = await fetchRebrandlyLink(rebrandlyId);
      downloads[slug].downloads = typeof info.clicks === 'number' ? info.clicks : null;
      downloads[slug].downloadsUpdatedAt = new Date().toISOString();
      if (info.shortUrl) {
        jogo.downloadUrl = info.shortUrl.startsWith('http') ? info.shortUrl : `https://${info.shortUrl}`;
      }
      updated += 1;
      console.log(`Atualizado: ${slug} (${guid}) -> ${downloads[slug].downloads}`);
    } catch (err) {
      console.error(`Erro ao atualizar ${slug} (${guid}): ${err.message}`);
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
