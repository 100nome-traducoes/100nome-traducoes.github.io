#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'game-content', 'packages-metadata.json');
const SOURCE_URL = String(process.env.SHEETS_METADATA_URL || '').trim();

if (!SOURCE_URL) {
  console.error('Falta a env SHEETS_METADATA_URL.');
  process.exit(1);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function normalizeRecord(item) {
  const slug = String(item?.slug || '').trim();
  if (!slug) return null;

  const sizeRaw = Number(item?.tamanho);
  const sizeBytes = Number.isFinite(sizeRaw) && sizeRaw >= 0 ? Math.round(sizeRaw) : null;

  const updatedRaw = String(item?.ultimaModificacao || '').trim();
  const updatedAt = updatedRaw && !Number.isNaN(Date.parse(updatedRaw)) ? new Date(updatedRaw).toISOString() : null;

  const version = String(item?.versao || '').trim() || null;
  const checksum = String(item?.checksum || '').trim() || null;
  const filename = String(item?.nomeFicheiro || '').trim() || null;

  return {
    slug,
    packageVersion: version,
    packageLastModified: updatedAt,
    packageSizeBytes: sizeBytes,
    packageChecksum: checksum,
    packageFilename: filename
  };
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Falha ao obter metadata do Sheets: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const files = Array.isArray(payload?.files) ? payload.files : [];

  const bySlug = {};
  for (const item of files) {
    const normalized = normalizeRecord(item);
    if (!normalized) continue;
    bySlug[normalized.slug] = {
      packageVersion: normalized.packageVersion,
      packageLastModified: normalized.packageLastModified,
      packageSizeBytes: normalized.packageSizeBytes,
      packageChecksum: normalized.packageChecksum,
      packageFilename: normalized.packageFilename
    };
  }

  const output = {
    source: 'google-sheets',
    syncedAt: new Date().toISOString(),
    lastUpdated: payload?.lastUpdated || null,
    totalFiles: Number.isFinite(Number(payload?.totalFiles)) ? Number(payload.totalFiles) : files.length,
    packages: bySlug
  };

  writeJson(OUTPUT_PATH, output);
  console.log(`Metadata de pacotes gerada em ${OUTPUT_PATH} (${Object.keys(bySlug).length} registos).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
