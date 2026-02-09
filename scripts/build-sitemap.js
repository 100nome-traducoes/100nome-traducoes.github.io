#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'sitemap.xml');
const BASE_URL = (process.env.SITE_URL || 'https://100nome-traducoes.github.io').replace(/\/$/, '');

function toUrlPath(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  return '/' + rel.replace(/^\/*/, '');
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

  // Game pages
  const jogoDir = path.join(ROOT, 'jogo');
  if (fs.existsSync(jogoDir)) {
    fs.readdirSync(jogoDir)
      .filter(f => f.endsWith('.html'))
      .forEach(f => files.push(path.join(jogoDir, f)));
  }

  // Wiki pages
  const wikiDir = path.join(ROOT, 'wiki');
  if (fs.existsSync(wikiDir)) {
    fs.readdirSync(wikiDir)
      .filter(f => f.endsWith('.html'))
      .forEach(f => files.push(path.join(wikiDir, f)));

    // subfolders (per game)
    fs.readdirSync(wikiDir)
      .filter(f => fs.statSync(path.join(wikiDir, f)).isDirectory())
      .forEach(dir => {
        const dirPath = path.join(wikiDir, dir);
        fs.readdirSync(dirPath)
          .filter(f => f.endsWith('.html'))
          .forEach(f => files.push(path.join(dirPath, f)));
      });
  }

  return files;
}

function buildSitemap() {
  const files = collectFiles();

  const urls = files.map(filePath => {
    const loc = `${BASE_URL}${toUrlPath(filePath)}`;
    const lastmod = lastmodFor(filePath);
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls.join('\n')}\n` +
    `</urlset>\n`;

  fs.writeFileSync(OUTPUT, xml, 'utf8');
  console.log(`Gerado: ${OUTPUT}`);
}

buildSitemap();
