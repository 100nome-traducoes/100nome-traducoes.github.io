#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'sitemap.xml');
const BASE_URL = (process.env.SITE_URL || 'https://100nome-traducoes.github.io').replace(/\/$/, '');
const JOGOS_PATH = path.join(ROOT, 'data', 'game-content', 'jogos.json');

function toUrlPath(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const normalized = '/' + rel.replace(/^\/*/, '');
  if (normalized === '/index.html') return '/';
  if (normalized.endsWith('/index.html')) {
    return normalized.replace(/\/index\.html$/i, '') || '/';
  }
  if (/^\/jogo\/[^/]+\.html$/i.test(normalized)) {
    return normalized.replace(/\.html$/i, '');
  }
  return normalized;
}

function lastmodFor(filePath) {
  const stat = fs.statSync(filePath);
  return stat.mtime.toISOString().split('T')[0];
}

function collectFiles() {
  const files = [];

  const addIfExists = (p) => {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) files.push(p);
  };

  // Root pages
  addIfExists(path.join(ROOT, 'index.html'));
  addIfExists(path.join(ROOT, 'wiki-index.html'));

  // Wiki pages
  const wikiDir = path.join(ROOT, 'wiki');
  if (fs.existsSync(wikiDir)) {
    const walk = (dirPath) => {
      fs.readdirSync(dirPath).forEach(entry => {
        const full = path.join(dirPath, entry);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          walk(full);
        } else if (entry.endsWith('.html')) {
          files.push(full);
        }
      });
    };
    walk(wikiDir);
  }

  return files;
}

function buildSitemap() {
  const files = collectFiles();
  const urls = [];

  if (fs.existsSync(JOGOS_PATH)) {
    const jogosData = JSON.parse(fs.readFileSync(JOGOS_PATH, 'utf8'));
    for (const jogo of (jogosData.jogos || [])) {
      const slug = String(jogo.slug || jogo.guid || '').trim();
      if (!slug) continue;
      const gameFile = path.join(ROOT, 'jogo', slug, 'index.html');
      const lastmod = fs.existsSync(gameFile) ? lastmodFor(gameFile) : new Date().toISOString().split('T')[0];
      urls.push(`  <url>\n    <loc>${BASE_URL}/jogo/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`);
    }
  }

  const fileUrls = files.map(filePath => {
    const loc = `${BASE_URL}${toUrlPath(filePath)}`;
    const lastmod = lastmodFor(filePath);
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });
  urls.push(...fileUrls);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls.join('\n')}\n` +
    `</urlset>\n`;

  fs.writeFileSync(OUTPUT, xml, 'utf8');
  console.log(`Gerado: ${OUTPUT}`);
}

buildSitemap();
