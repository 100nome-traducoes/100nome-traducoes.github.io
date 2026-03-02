#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { resolveSiteUrl } = require('./site-config');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'robots.txt');
const BASE_URL = resolveSiteUrl();

const content = `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`;

fs.writeFileSync(OUTPUT, content, 'utf8');
console.log(`Gerado: ${OUTPUT}`);
