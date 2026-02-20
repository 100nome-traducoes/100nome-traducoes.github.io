#!/usr/bin/env node

// Script de migração ÚNICA para popular Counter API com dados históricos do Rebrandly
// Executar apenas uma vez após setup inicial
// 
// Mapeia: guid (antigo) → slug (novo) para Counter API

const fs = require('fs');
const path = require('path');

const COUNTER_API_BASE = 'https://api.counterapi.dev/v2/100nome';

// Carregar dados históricos (guid como key)
const downloadsPath = path.join(__dirname, '..', 'data', 'game-content', 'downloads.json');
const jogosPath = path.join(__dirname, '..', 'data', 'game-content', 'jogos.json');

async function setCounter(gameSlug, count) {
  // Counter API: usar /set/{value} para definir valor específico
  console.log(`-> ${gameSlug}: ${count} descargas`);
  const url = `${COUNTER_API_BASE}/${gameSlug}/set?count=${count}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ut_xWtLcGNlytGxdWIaqNPIGPGeMTeIQkJcVAK3PDZS'
      }
    });
    const data = await response.json();
    console.log(`✓ ${gameSlug}: ${data.count} descargas`);
    return true;
  } catch (error) {
    console.error(`✗ ${gameSlug}: ${error.message}`);
    return false;
  }
}

async function migrate() {
  console.log('🔄 Migrando dados históricos do Rebrandly para Counter API...\n');

  // Carregar dados históricos (guid → downloads)
  if (!fs.existsSync(downloadsPath)) {
    console.error('❌ downloads.json não encontrado');
    process.exit(1);
  }
  const downloadsData = JSON.parse(fs.readFileSync(downloadsPath, 'utf8'));
  console.log(`📊 Dados históricos: ${Object.keys(downloadsData).length} entradas\n`);



  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [slug, data] of Object.entries(downloadsData)) {
    const count = data.downloads;
    
    // Skip se não tem downloads ou é null
    if (typeof count !== 'number' || count <= 0) {
      console.log(`⊘ ${slug}: sem downloads (${count}) — ignorado`);
      skipped++;
      continue;
    }
    
    // Obter o slug correspondente
    if (!slug) {
      console.warn(`⚠️  ${slug}: não encontrado no jogos.json — ignorado`);
      errors++;
      continue;
    }

    // Migrar
    const success = await setCounter(slug, count);
    if (success) {
      migrated++;
    } else {
      errors++;
    }

    // Rate limiting gentil (200ms entre requests)
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Migração concluída:`);
  console.log(`   • ${migrated} jogos migrados com sucesso`);
  console.log(`   • ${skipped} jogos sem downloads válidos`);
  if (errors > 0) {
    console.log(`   • ${errors} erros`);
  }
  console.log(`\n⚠️  IMPORTANTE: Este script deve ser executado apenas UMA VEZ.`);
  console.log(`   Os contadores agora são geridos pelo Counter API dinamicamente.`);
  console.log(`   Podes apagar downloads.json após confirmar que tudo funcionou.`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

migrate().catch(console.error);
