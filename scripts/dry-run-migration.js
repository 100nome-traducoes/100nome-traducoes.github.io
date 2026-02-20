#!/usr/bin/env node

// DRY RUN - Testa o mapeamento guid → slug sem fazer requests ao Counter API
// Executar ANTES do migrate-to-counter-api.js para verificar

const fs = require('fs');
const path = require('path');

const downloadsPath = path.join(__dirname, 'data', 'game-content', 'downloads.json');
const jogosPath = path.join(__dirname, 'data', 'game-content', 'jogos.json');

function dryRun() {
  console.log('🧪 DRY RUN - Teste de mapeamento guid → slug\n');
  console.log('━'.repeat(100) + '\n');

  // Carregar dados
  const downloadsData = JSON.parse(fs.readFileSync(downloadsPath, 'utf8'));
  const jogosContent = JSON.parse(fs.readFileSync(jogosPath, 'utf8'));
  const jogos = jogosContent.jogos || [];

  // Criar mapa guid → slug
  const guidToSlug = {};
  for (const jogo of jogos) {
    guidToSlug[jogo.guid] = jogo.slug || jogo.guid;
  }

  // Analisar cada entrada
  const results = {
    willMigrate: [],
    willSkipNull: [],
    willSkipZero: [],
    notFoundInJogos: []
  };

  for (const [guid, data] of Object.entries(downloadsData)) {
    const count = data.downloads;
    const slug = guidToSlug[guid];

    if (!slug) {
      results.notFoundInJogos.push({ guid, count });
    } else if (count === null || count === undefined) {
      results.willSkipNull.push({ guid, slug, count });
    } else if (count <= 0) {
      results.willSkipZero.push({ guid, slug, count });
    } else {
      results.willMigrate.push({ guid, slug, count });
    }
  }

  // Mostrar resultados
  console.log(`✅ SERÁ MIGRADO (${results.willMigrate.length} jogos):\n`);
  results.willMigrate
    .sort((a, b) => b.count - a.count)
    .forEach(({ guid, slug, count }) => {
      const countStr = String(count).padStart(5);
      const guidShort = guid.substring(0, 45).padEnd(45);
      console.log(`   ${countStr} downloads: ${guidShort} → ${slug}`);
    });

  if (results.willSkipNull.length > 0) {
    console.log(`\n⊘ SERÁ IGNORADO - downloads null (${results.willSkipNull.length} jogos):\n`);
    results.willSkipNull.forEach(({ guid, slug }) => {
      console.log(`   ${guid.padEnd(50)} → ${slug}`);
    });
  }

  if (results.willSkipZero.length > 0) {
    console.log(`\n⊘ SERÁ IGNORADO - downloads = 0 (${results.willSkipZero.length} jogos):\n`);
    results.willSkipZero.forEach(({ guid, slug, count }) => {
      console.log(`   ${guid.padEnd(50)} → ${slug} (${count})`);
    });
  }

  if (results.notFoundInJogos.length > 0) {
    console.log(`\n⚠️  PROBLEMA - guid não encontrado no jogos.json (${results.notFoundInJogos.length}):\n`);
    results.notFoundInJogos.forEach(({ guid, count }) => {
      console.log(`   ${guid} (${count} downloads) — NÃO SERÁ MIGRADO`);
    });
  }

  // Resumo
  console.log('\n' + '━'.repeat(100));
  console.log('\n📊 RESUMO:\n');
  console.log(`   ✅ ${results.willMigrate.length} jogos serão migrados`);
  console.log(`   ⊘ ${results.willSkipNull.length + results.willSkipZero.length} jogos sem downloads válidos (ignorados)`);
  if (results.notFoundInJogos.length > 0) {
    console.log(`   ⚠️  ${results.notFoundInJogos.length} guids sem correspondência (ERRO)`);
  }

  const totalDownloads = results.willMigrate.reduce((sum, r) => sum + r.count, 0);
  console.log(`\n   📈 Total de downloads a migrar: ${totalDownloads.toLocaleString('pt-PT')}`);

  console.log('\n' + '━'.repeat(100));
  
  if (results.notFoundInJogos.length === 0) {
    console.log('\n✅ Tudo pronto! Podes executar o migrate-to-counter-api.js com segurança.\n');
  } else {
    console.log('\n⚠️  Corrige os problemas acima antes de migrar.\n');
    process.exit(1);
  }
}

dryRun();
