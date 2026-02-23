#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const jogosPath = path.join(__dirname, '..', 'data', 'game-content', 'jogos.json');
const downloadsPath = path.join(__dirname, '..', 'data', 'game-content', 'downloads.json');
const API_BASE = (process.env.DOWNLOADS_API_URL || 'https://100nome-api.netlify.app/.netlify/functions').replace(/\/$/, '');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getGameSlug(jogo) {
  return String(jogo?.slug || '').trim();
}

function normalizeExistingDownloads(existingDownloads, jogosList) {
  const validSlugs = new Set(jogosList.map(getGameSlug).filter(Boolean));
  const normalized = {};

  for (const [key, value] of Object.entries(existingDownloads || {})) {
    const slug = String(key || '').trim();
    if (!validSlugs.has(slug)) continue;
    normalized[slug] = {
      downloads: typeof value?.downloads === 'number' ? value.downloads : null,
      downloadsUpdatedAt: value?.downloadsUpdatedAt || null
    };
  }

  return normalized;
}

async function fetchCountBySlug(slug) {
  const response = await fetch(`${API_BASE}/count?id=${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  return typeof payload?.downloads === 'number' ? payload.downloads : null;
}

async function main() {
  const jogos = readJson(jogosPath);
  const jogosList = (jogos.jogos || []).filter(jogo => getGameSlug(jogo));
  const existingDownloads = fs.existsSync(downloadsPath) ? readJson(downloadsPath) : {};
  const downloads = normalizeExistingDownloads(existingDownloads, jogosList);

  let updated = 0;
  for (const jogo of jogosList) {
    const slug = getGameSlug(jogo);
    if (!downloads[slug]) {
      downloads[slug] = { downloads: null, downloadsUpdatedAt: null };
    }

    try {
      const count = await fetchCountBySlug(slug);
      downloads[slug] = {
        downloads: count,
        downloadsUpdatedAt: new Date().toISOString()
      };
      updated += 1;
      console.log(`Atualizado: ${slug} -> ${count}`);
    } catch (err) {
      console.error(`Erro ao atualizar ${slug}: ${err.message}`);
    }
  }

  writeJson(downloadsPath, downloads);
  console.log(`Total atualizados: ${updated}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
