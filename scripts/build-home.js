#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'game-content', 'jogos.json');
const templatePath = path.join(__dirname, '..', 'templates', 'home.html');
const partialsDir = path.join(__dirname, '..', 'templates', 'partials');
const outputPath = path.join(__dirname, '..', 'index.html');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readPartial(name) {
  return fs.readFileSync(path.join(partialsDir, name), 'utf8');
}

function limparTitulo(titulo) {
  return String(titulo || '')
    .replace(/^Tradução:\s*/i, '')
    .replace(/\s*PT-PT$/i, '')
    .trim();
}

function truncarTexto(texto, maxLength) {
  if (!texto) return '';
  if (texto.length <= maxLength) return texto;
  return texto.substring(0, maxLength).trim() + '...';
}

function formatarData(dataString) {
  try {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    return 'Data desconhecida';
  }
}

function extrairCategoriasPrincipais(categorias) {
  const categoriasMap = {
    acao: 'Ação',
    misterio: 'Mistério',
    quebracabecas: 'Quebra-cabeças',
    corrida: 'Corrida',
    estrategia: 'Estratégia',
    aventura: 'Aventura',
    rpg: 'RPG',
    simulacao: 'Simulação',
    objetosescondidos: 'Objetos Escondidos',
    'português-portugal': 'PT-PT',
    'pt-pt': 'Português',
    jogo: 'Jogo',
    traduções: 'Tradução'
  };

  return (categorias || [])
    .map(cat => categoriasMap[cat] || cat)
    .filter(cat => cat && !['Jogo', 'Tradução', 'PT-PT', 'Português'].includes(cat))
    .slice(0, 3);
}

function getCategoriaIcone(categoriaId) {
  const icones = {
    acao: 'fist-raised',
    misterio: 'search',
    corrida: 'car',
    estrategia: 'chess-board',
    quebracabecas: 'puzzle-piece',
    aventura: 'hiking',
    rpg: 'dragon',
    simulacao: 'cogs',
    objetosescondidos: 'binoculars'
  };
  return icones[categoriaId] || 'gamepad';
}

function criarCardDestaque(jogo) {
  const categoriasBadges = extrairCategoriasPrincipais(jogo.categorias);
  const descricaoCurta = truncarTexto(jogo.descricao, 120);
  const linkJogo = `jogo/${jogo.guid}.html`;

  return `
  <div class="featured-card" data-guid="${jogo.guid}" data-link="${linkJogo}">
  <div class="featured-badge">
  <i class="fas fa-star"></i> Destaque
  </div>
  <img src="${jogo.capa}" alt="${limparTitulo(jogo.titulo)} - Tradução PT-PT - 100Nome" class="featured-image" loading="lazy">
  <div class="featured-content">
  <div class="featured-categories">
  ${categoriasBadges.map(cat => `<span class="category-badge">${cat}</span>`).join('')}
  </div>
  <h3 class="featured-title">${limparTitulo(jogo.titulo)}</h3>
  <p class="featured-description">${descricaoCurta}</p>
  <div class="featured-info">
  <span class="tradutor-info">
  <i class="fas fa-user-edit"></i> ${jogo.informacoesTraducao?.fornecidaPor || '100Nome'}
  </span>
  <span class="versao-info">
  <i class="fas fa-code-branch"></i> v${jogo.informacoesTraducao?.versao || '1.0'}
  </span>
  </div>
  <a href="${linkJogo}" class="featured-link" rel="noopener">
  <i class="fas fa-external-link-alt"></i> Ver Tradução Completa
  </a>
  </div>
  </div>
  `;
}

function criarCardJogo(jogo, destaquesSet) {
  const isDestaque = destaquesSet.has(jogo.guid);
  const categoriasTags = extrairCategoriasPrincipais(jogo.categorias).slice(0, 2);
  const descricaoCurta = truncarTexto(jogo.descricao, 90);
  const dataFormatada = formatarData(jogo.dataPublicacao);
  const linkJogo = `jogo/${jogo.guid}.html`;

  const diasDesdePublicacao = Math.floor(
    (new Date() - new Date(jogo.dataPublicacao)) / (1000 * 60 * 60 * 24)
  );
  const isNovo = diasDesdePublicacao <= 30;

  return `
  <div class="game-card" data-guid="${jogo.guid}" data-link="${linkJogo}">
  ${isNovo ? '<span class="new-badge">NOVO!</span>' : ''}
  ${isDestaque ? '<div class="destaque-badge"><i class="fas fa-star"></i></div>' : ''}
  <div class="game-image-container">
  <img src="${jogo.capa}" alt="${limparTitulo(jogo.titulo)} - Tradução PT-PT - 100Nome" class="game-image" loading="lazy">
  <div class="game-overlay">
  <span class="game-link-text">
  <i class="fas fa-external-link-alt"></i> Ver Tradução
  </span>
  </div>
  </div>
  <div class="game-info">
  <div class="game-categories">
  ${categoriasTags.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
  </div>
  <h3 class="game-title">${limparTitulo(jogo.titulo)}</h3>
  <p class="game-description">${descricaoCurta}</p>
  <div class="game-meta">
  <span class="game-meta-item" title="${jogo.informacoesTraducao?.fornecidaPor || '100Nome'}">
  <i class="fas fa-user-edit"></i> ${truncarTexto(jogo.informacoesTraducao?.fornecidaPor || '100Nome', 24)}
  </span>
  <span class="game-meta-item" title="Publicado em ${dataFormatada}">
  <i class="fas fa-calendar"></i> ${dataFormatada}
  </span>
  </div>
  <a href="${linkJogo}" class="game-link" rel="noopener">
  <i class="fas fa-download"></i> Ver Tradução
  </a>
  </div>
  </div>
  `;
}

function criarSecaoCategoria(categoria, jogos, destaquesSet) {
  const categoriaId = `carousel-${categoria.id}`;
  const jogosHTML = jogos.map(jogo => criarCardJogo(jogo, destaquesSet)).join('');

  return `
  <section class="category-section" id="${categoria.id}">
  <div class="category-header">
  <h2 class="category-title">
  <i class="fas fa-${getCategoriaIcone(categoria.id)}"></i>
  ${categoria.nome}
  <span class="game-count">(${jogos.length})</span>
  </h2>
  <div class="category-nav">
  <button class="nav-btn prev" data-carousel="${categoriaId}" aria-label="Anterior">
  <i class="fas fa-chevron-left"></i>
  </button>
  <button class="nav-btn next" data-carousel="${categoriaId}" aria-label="Seguinte">
  <i class="fas fa-chevron-right"></i>
  </button>
  </div>
  </div>
  <div class="carousel-container">
  <div class="carousel-track" id="${categoriaId}">
  ${jogosHTML}
  </div>
  </div>
  </section>
  `;
}

function filtrarJogosPorCategoria(jogos, categoria) {
  const tags = categoria.tags || [];
  return jogos.filter(jogo => (jogo.categorias || []).some(cat => tags.includes(cat)));
}

function buildFeaturedGrid(data) {
  const destaques = data.destaques || [];
  const jogos = data.jogos || [];
  const jogosDestaque = destaques
    .map(guid => jogos.find(j => j.guid === guid))
    .filter(Boolean);

  if (jogosDestaque.length === 0) return '';
  return jogosDestaque.map(criarCardDestaque).join('\n');
}

function buildCategories(data) {
  const categorias = data.categoriasPrincipais || [];
  const jogos = data.jogos || [];
  const destaquesSet = new Set(data.destaques || []);

  if (categorias.length === 0) {
    return `
    <div class="no-data">
      <i class="fas fa-th-large"></i>
      <p>Sem categorias disponíveis.</p>
    </div>
    `;
  }

  const sections = categorias
    .map(categoria => {
      const jogosDaCategoria = filtrarJogosPorCategoria(jogos, categoria);
      if (jogosDaCategoria.length === 0) return '';
      return criarSecaoCategoria(categoria, jogosDaCategoria, destaquesSet);
    })
    .filter(Boolean)
    .join('\n');

  return sections || '';
}

function main() {
  const data = readJson(dataPath);
  const template = fs.readFileSync(templatePath, 'utf8');
  const header = readPartial('header.html');
  const footer = readPartial('footer.html');
  const favicon = readPartial('favicon.html');

  const featuredGrid = buildFeaturedGrid(data);
  const categoriesHtml = buildCategories(data);

  let html = template
    .replace(/\{\{FAVICON\}\}/g, favicon)
    .replace(/\{\{HEADER\}\}/g, header)
    .replace(/\{\{FOOTER\}\}/g, footer)
    .replace(/\{\{FEATURED_GRID\}\}/g, featuredGrid)
    .replace(/\{\{CATEGORIES_HTML\}\}/g, categoriesHtml);

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Gerado: ${outputPath}`);
}

main();
