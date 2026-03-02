#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveSiteUrl, applyGlobalSiteLinks } = require('./site-config');

const dataPath = path.join(__dirname, '..', 'data', 'game-content', 'jogos.json');
const downloadsPath = path.join(__dirname, '..', 'data', 'game-content', 'downloads.json');
const packagesMetadataPath = path.join(__dirname, '..', 'data', 'game-content', 'packages-metadata.json');
const templatePath = path.join(__dirname, '..', 'templates', 'home.html');
const partialsDir = path.join(__dirname, '..', 'templates', 'partials');
const outputPath = path.join(__dirname, '..', 'index.html');
const wikiContentDir = path.join(__dirname, '..', 'data', 'wiki-content');
const SITE_URL = resolveSiteUrl();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readPartial(name) {
  return fs.readFileSync(path.join(partialsDir, name), 'utf8');
}

function collectAssetContent(fullPath, visited = new Set()) {
  const normalizedPath = path.resolve(fullPath);
  if (visited.has(normalizedPath)) return '';
  visited.add(normalizedPath);

  const content = fs.readFileSync(normalizedPath, 'utf8');
  let combined = `${normalizedPath}\n${content}\n`;

  if (path.extname(normalizedPath) === '.css') {
    const importRegex = /@import\s+url\((['\"]?)([^'\")]+)\1\)\s*;|@import\s+(['\"])([^'\"]+)\3\s*;/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[2] || match[4] || '';
      if (!importPath || /^(https?:|data:)/i.test(importPath)) continue;
      const resolvedImportPath = path.resolve(path.dirname(normalizedPath), importPath);
      if (fs.existsSync(resolvedImportPath)) {
        combined += collectAssetContent(resolvedImportPath, visited);
      }
    }
  }

  return combined;
}

function getAssetVersion(relativePath) {
  const fullPath = path.join(__dirname, '..', relativePath);
  const bundledContent = collectAssetContent(fullPath);
  return crypto.createHash('sha1').update(bundledContent).digest('hex').slice(0, 10);
}

function limparTitulo(titulo) {
  return String(titulo || '')
    .replace(/^Tradução:\s*/i, '')
    .replace(/\s*PT-PT$/i, '')
    .trim();
}

function truncarTexto(texto, maxLength) {
  const t = String(texto || '');
  if (t.length <= maxLength) return t;
  return t.substring(0, maxLength).trim() + '...';
}

function getGameDate(jogo) {
  return jogo.dataPublicacao || '';
}

function getGameVersion(jogo) {
  return jogo.packageVersion || jogo.versao || jogo.informacoesTraducao?.versao || '1.0';
}

function getGameProvider(jogo) {
  return jogo.fornecido_por || jogo.informacoesTraducao?.fornecidaPor || '100Nome';
}

function getGameSlug(jogo) {
  return String(jogo?.slug || '').trim();
}

function getAvailableWikiSlugs() {
  if (!fs.existsSync(wikiContentDir)) return new Set();
  return new Set(
    fs.readdirSync(wikiContentDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name.trim())
      .filter(Boolean)
  );
}

const AVAILABLE_WIKI_SLUGS = getAvailableWikiSlugs();

function encodeWikiPath(pathValue) {
  return String(pathValue || '')
    .split('/')
    .map(part => encodeURIComponent(part.trim()))
    .filter(Boolean)
    .join('/');
}

function resolveGuideLink(jogo) {
  const wikiSlugRaw = String(jogo?.wikiSlug || getGameSlug(jogo) || '').trim();
  if (!wikiSlugRaw) return '';
  if (!AVAILABLE_WIKI_SLUGS.has(wikiSlugRaw)) return '';
  const wikiSlug = encodeWikiPath(wikiSlugRaw);
  if (!wikiSlug) return '';

  const wikiEntryRaw = String(jogo?.wikiEntry || 'index').trim().replace(/^\/+|\/+$/g, '');
  const wikiEntry = encodeWikiPath(wikiEntryRaw || 'index');

  const anchorRaw = String(jogo?.wikiAnchor || '').trim().replace(/^#/, '');
  const anchor = anchorRaw ? `#${encodeURIComponent(anchorRaw)}` : '';

  if (!wikiEntry || wikiEntry.toLowerCase() === 'index') {
    return `/wiki/${wikiSlug}${anchor}`;
  }
  return `/wiki/${wikiSlug}/${wikiEntry}${anchor}`;
}

function readPackagesMetadata() {
  if (!fs.existsSync(packagesMetadataPath)) return {};
  try {
    const raw = readJson(packagesMetadataPath);
    if (!raw || typeof raw !== 'object') return {};
    if (!raw.packages || typeof raw.packages !== 'object') return {};
    return raw.packages;
  } catch {
    return {};
  }
}

function mergePackageMetadata(jogo, packagesMap) {
  const slug = getGameSlug(jogo);
  const meta = packagesMap?.[slug];
  if (!meta || typeof meta !== 'object') return jogo;

  return {
    ...jogo,
    packageVersion: String(meta.packageVersion || '').trim() || null,
    packageLastModified: String(meta.packageLastModified || '').trim() || null,
    packageSizeBytes: Number.isFinite(Number(meta.packageSizeBytes)) ? Number(meta.packageSizeBytes) : null
  };
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
    indie: 'Indie',
    mundoaberto: 'Mundo Aberto',
    plataforma: 'Plataforma',
    terror: 'Terror',
    fisica: 'Física',
    tabuleiro: 'Tabuleiro',
    opensource: 'Open Source',
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
  const linkJogo = `jogo/${getGameSlug(jogo)}`;

  return `
  <div class="featured-card" data-game-id="${getGameSlug(jogo)}" data-link="${linkJogo}">
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
  <i class="fas fa-user-edit"></i> ${getGameProvider(jogo)}
  </span>
  <span class="versao-info">
  <i class="fas fa-code-branch"></i> v${getGameVersion(jogo)}
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
  const isDestaque = destaquesSet.has(getGameSlug(jogo));
  const categoriasTags = extrairCategoriasPrincipais(jogo.categorias).slice(0, 2);
  const descricaoCurta = truncarTexto(jogo.descricao, 90);
  const dataFormatada = formatarData(getGameDate(jogo));
  const linkJogo = `jogo/${getGameSlug(jogo)}`;

  const diasDesdePublicacao = Math.floor(
    (new Date() - new Date(getGameDate(jogo))) / (1000 * 60 * 60 * 24)
  );
  const isNovo = diasDesdePublicacao <= 30;

  return `
  <div class="game-card" data-game-id="${getGameSlug(jogo)}" data-link="${linkJogo}">
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
  <span class="game-meta-item" title="${getGameProvider(jogo)}">
  <i class="fas fa-user-edit"></i> ${truncarTexto(getGameProvider(jogo), 24)}
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
  const jogos = data.jogos || [];
  const jogosPorSlug = new Map(jogos.map(j => [getGameSlug(j), j]));
  const destaques = (data.destaques || [])
    .map(v => String(v || '').trim())
    .filter(slug => jogosPorSlug.has(slug));
  const jogosDestaque = destaques
    .map(slug => jogosPorSlug.get(String(slug || '').trim()))
    .filter(Boolean);

  if (jogosDestaque.length === 0) return '';
  return jogosDestaque.map(criarCardDestaque).join('\n');
}

function buildCategories(data) {
  const categorias = data.categoriasPrincipais || [];
  const jogos = data.jogos || [];
  const destaquesSet = new Set(
    (data.destaques || [])
      .map(v => String(v || '').trim())
      .filter(Boolean)
  );

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

function buildHomeClientData(data, metadataStats) {
  const downloadsData = fs.existsSync(downloadsPath) ? readJson(downloadsPath) : {};

  const jogos = (data.jogos || [])
    .map(jogo => ({
    slug: getGameSlug(jogo),
    titulo: jogo.titulo,
    capa: jogo.capa,
    descricao: truncarTexto(jogo.descricao || '', 280),
    categorias: jogo.categorias || [],
    dataPublicacao: jogo.dataPublicacao || '',
    versao: jogo.packageVersion || jogo.versao || jogo.informacoesTraducao?.versao || '',
    packageLastModified: jogo.packageLastModified || '',
    fornecido_por: jogo.fornecido_por || jogo.informacoesTraducao?.fornecidaPor || '',
    criador: jogo.criador || jogo.informacoesJogo?.criadoPor || '',
    notas: jogo.notas || [],
    guideLink: resolveGuideLink(jogo),
    downloads: typeof downloadsData?.[getGameSlug(jogo)]?.downloads === 'number'
      ? downloadsData[getGameSlug(jogo)].downloads
      : 0
  }))
    .filter(jogo => jogo.slug);

  const validSlugs = new Set(jogos.map(j => j.slug));
  const totalDownloads = Array.from(validSlugs).reduce((acc, slug) => {
    const value = downloadsData?.[slug]?.downloads;
    return acc + (typeof value === 'number' ? value : 0);
  }, 0);

  return {
    destaques: (data.destaques || [])
      .map(v => String(v || '').trim())
      .filter(slug => validSlugs.has(slug)),
    categoriasPrincipais: data.categoriasPrincipais || [],
    jogos,
    stats: {
      totalDownloads,
      latestPackageUpdate: metadataStats?.latestPackageUpdate || ''
    }
  };
}

function main() {
  const rawData = readJson(dataPath);
  const packagesMap = readPackagesMetadata();
  const data = {
    ...rawData,
    jogos: (rawData.jogos || []).map(jogo => mergePackageMetadata(jogo, packagesMap))
  };

  const packageDates = Object.values(packagesMap)
    .map(meta => String(meta?.packageLastModified || '').trim())
    .filter(value => value && !Number.isNaN(Date.parse(value)))
    .map(value => new Date(value).toISOString());

  const metadataStats = {
    latestPackageUpdate: packageDates.length
      ? packageDates.sort((a, b) => new Date(b) - new Date(a))[0]
      : ''
  };

  const template = fs.readFileSync(templatePath, 'utf8');
  const header = readPartial('header.html');
  const footer = readPartial('footer.html');
  const favicon = readPartial('favicon.html');
  const assetVersions = {
    homeCss: getAssetVersion('assets/css/pages/home.css'),
    siteAnalyticsJs: getAssetVersion('assets/js/components/site-analytics.js'),
    motionJs: getAssetVersion('assets/js/components/motion.js'),
    homeJs: getAssetVersion('assets/js/pages/home.js')
  };

  const featuredGrid = buildFeaturedGrid(data);
  const categoriesHtml = buildCategories(data);
  const homeDataJson = JSON.stringify(buildHomeClientData(data, metadataStats)).replace(/<\//g, '<\\/');
  const homeTitle = '100Nome Traduções [Jogos em PT-PT]';
  const homeDescription = 'Traduções em PT-PT! O maior portal de traduções de jogos de Portugal, com traduções dos mais variados jogos em português de Portugal.';
  const homeUrl = `${SITE_URL}/`;
  const homeImage = `${SITE_URL}/assets/images/site/logo.png`;
  const homeJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '100Nome Traduções',
    url: homeUrl,
    inLanguage: 'pt-PT',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${homeUrl}?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  });

  const html = applyGlobalSiteLinks(template
    .replace(/\{\{HOME_CSS_VERSION\}\}/g, assetVersions.homeCss)
    .replace(/\{\{SITE_ANALYTICS_JS_VERSION\}\}/g, assetVersions.siteAnalyticsJs)
    .replace(/\{\{MOTION_JS_VERSION\}\}/g, assetVersions.motionJs)
    .replace(/\{\{HOME_JS_VERSION\}\}/g, assetVersions.homeJs)
    .replace(/\{\{HOME_TITLE\}\}/g, homeTitle)
    .replace(/\{\{HOME_DESCRIPTION\}\}/g, homeDescription)
    .replace(/\{\{HOME_URL\}\}/g, homeUrl)
    .replace(/\{\{HOME_IMAGE\}\}/g, homeImage)
    .replace(/\{\{HOME_JSON_LD\}\}/g, homeJsonLd)
    .replace(/\{\{HOME_DATA_JSON\}\}/g, homeDataJson)
    .replace(/\{\{FAVICON\}\}/g, favicon)
    .replace(/\{\{HEADER\}\}/g, header)
    .replace(/\{\{FOOTER\}\}/g, footer)
    .replace(/\{\{FEATURED_GRID\}\}/g, featuredGrid)
    .replace(/\{\{CATEGORIES_HTML\}\}/g, categoriesHtml));

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`Gerado: ${outputPath}`);
}

main();
