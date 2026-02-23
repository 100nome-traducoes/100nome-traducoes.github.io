#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const jogosPath = path.join(__dirname, '..', 'data', 'game-content', 'jogos.json');
const downloadsPath = path.join(__dirname, '..', 'data', 'game-content', 'downloads.json');
const packagesMetadataPath = path.join(__dirname, '..', 'data', 'game-content', 'packages-metadata.json');
const wikiContentDir = path.join(__dirname, '..', 'data', 'wiki-content');
const templatePath = path.join(__dirname, '..', 'templates', 'game-page.html');
const partialsDir = path.join(__dirname, '..', 'templates', 'partials');
const outputDir = path.join(__dirname, '..', 'jogo');
const SITE_URL = (process.env.SITE_URL || 'https://100nome-traducoes.github.io').replace(/\/$/, '');
const ASSET_VERSIONS = {
  gameCss: getAssetVersion('assets/css/pages/game.css'),
  siteAnalyticsJs: getAssetVersion('assets/js/components/site-analytics.js'),
  motionJs: getAssetVersion('assets/js/components/motion.js'),
  siteShellJs: getAssetVersion('assets/js/components/site-shell.js'),
  gamePageJs: getAssetVersion('assets/js/pages/game-page.js'),
  downloadCounterJs: getAssetVersion('assets/js/components/download-counter.js'),
  giscusThemeCss: getAssetVersion('assets/css/components/giscus-theme.css')
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readPartial(name) {
  return fs.readFileSync(path.join(partialsDir, name), 'utf8');
}

function getAssetVersion(relativePath) {
  const fullPath = path.join(__dirname, '..', relativePath);
  const content = fs.readFileSync(fullPath);
  return crypto.createHash('sha1').update(content).digest('hex').slice(0, 10);
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripPrefixTitulo(titulo) {
  return String(titulo || '').replace(/^Tradução:\s*/i, '').trim();
}

function stripPtPt(titulo) {
  return String(titulo || '')
    .replace(/^Tradução:\s*/i, '')
    .replace(/\s*PT-PT\s*$/i, '')
    .trim();
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

function getGameName(jogo) {
  return String(jogo?.nome || stripPtPt(jogo?.titulo || getGameSlug(jogo) || '')).trim();
}

function getLinguaDisplay(jogo) {
  const raw = String(jogo?.lingua_display || 'PT-PT').trim();
  return raw.toLowerCase() === 'português' ? 'em Português' : raw;
}

function splitList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[,;]+/)
    .map(v => v.trim())
    .filter(Boolean);
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
    packageSizeBytes: Number.isFinite(Number(meta.packageSizeBytes)) ? Number(meta.packageSizeBytes) : null,
    packageChecksum: String(meta.packageChecksum || '').trim() || null,
    packageFilename: String(meta.packageFilename || '').trim() || null
  };
}

function formatDatePt(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Data desconhecida';

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();

  return `${day} ${month} ${year}`;
}

function truncate(text, maxLen = 160) {
  const t = String(text || '').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1).trim() + '…';
}

function getCategoriaIcone(categoriaId) {
  const icones = {
    acao: 'fist-raised',
    sobrevivencia: 'person-shelter',
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

function extrairCategoriasPrincipais(categorias) {
  const categoriasMap = {
    acao: 'Ação',
    sobrevivencia: 'Sobrevivência',
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
    opensource: 'Open Source'
  };

  return (categorias || [])
    .map(cat => {
      const catLower = String(cat).toLowerCase().replace(/[^a-z]/g, '');
      return categoriasMap[catLower];
    })
    .filter(Boolean);
}

function buildBadgesHtml(jogo) {
  const categorias = extrairCategoriasPrincipais(jogo.categorias).slice(0, 1);
  const badges = [];

  if (categorias.length > 0) {
    const labelToId = {
      'Ação': 'acao',
      'Sobrevivência': 'sobrevivencia',
      'Mistério': 'misterio',
      'Quebra-cabeças': 'quebracabecas',
      'Corrida': 'corrida',
      'Estratégia': 'estrategia',
      'Aventura': 'aventura',
      'RPG': 'rpg',
      'Simulação': 'simulacao',
      'Objetos Escondidos': 'objetosescondidos',
      'Indie': 'indie',
      'Mundo Aberto': 'mundoaberto',
      'Plataforma': 'plataforma',
      'Terror': 'terror',
      'Física': 'fisica',
      'Tabuleiro': 'tabuleiro',
      'Open Source': 'opensource'
    };

    const nome = categorias[0];
    const categoriaId = labelToId[nome] || 'gamepad';
    const icon = getCategoriaIcone(categoriaId);
    badges.push(`<span class="badge badge-category"><i class="fas fa-${icon}"></i> ${escapeHtml(nome)}</span>`);
  }

  return badges.join('');
}

function normalizeInfoJogo(jogo) {
  const old = jogo.informacoesJogo || {};
  const nome = jogo.nome || old.nome || stripPtPt(jogo.titulo || getGameSlug(jogo));
  const nomeOriginal = jogo.nome_original || old.nomeOriginal || '';
  const criador = jogo.criador || old.criadoPor || 'n/d';

  const isDifferent =
    nomeOriginal &&
    nomeOriginal.trim().toLowerCase() !== nome.trim().toLowerCase();

  return {
    nome,
    nomeOriginal: isDifferent ? nomeOriginal : '',
    criador
  };
}

function normalizeAutores(jogo) {
  if (!Array.isArray(jogo.autores)) return [];
  return jogo.autores
    .map(a => ({
      nome: String(a?.nome || '').trim(),
      papel: String(a?.papel || '').trim() || 'Contribuição'
    }))
    .filter(a => a.nome);
}

function normalizeTraducao(jogo) {
  const old = jogo.informacoesTraducao || {};
  const fornecidoPor = jogo.fornecido_por || old.fornecidaPor || '';
  const agradecimentos = Array.isArray(jogo.agradecimentos)
    ? jogo.agradecimentos
    : splitList(jogo.agradecimentos || old.agradecimentos);

  return {
    versao: jogo.packageVersion || old.versao || '1.0',
    atributos: Array.isArray(jogo.atributos) ? jogo.atributos : (old.atributos || []),
    autores: normalizeAutores(jogo),
    fornecidoPor,
    agradecimentos
  };
}

function initialsFromName(nome) {
  const parts = String(nome).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function isExternalProvider(provider) {
  const p = String(provider || '').trim();
  if (!p) return false;
  return p.toLowerCase() !== '100nome';
}

function buildWikiButton(jogo) {
  const guideLink = resolveGuideLink(jogo);
  if (!guideLink) return '';

  return `
  <a href="${escapeHtml(guideLink)}" class="btn btn-secondary btn-guide-primary" title="Consultar termos e notas da tradução" aria-label="Guia da Tradução: termos e notas">
  <i class="fas fa-book-open"></i> Guia da Tradução
  </a>`;
}

function buildNotesSection(avisos = [], notas = []) {
  const avisoHtml = (avisos || [])
    .map(aviso => `
    <div class="alert alert-warning">
      <i class="fas fa-exclamation-triangle"></i>
      <strong>Aviso:</strong> ${escapeHtml(aviso)}
    </div>`)
    .join('');

  const notasHtml = (notas || [])
    .map(nota => String(nota || '').trim())
    .filter(Boolean)
    .map(nota => `
      <div class="note-item">
        <i class="fas fa-check-circle"></i>
        <span>${escapeHtml(nota)}</span>
      </div>`)
    .join('');

  return { avisoHtml, notasHtml };
}

function formatNumberPt(value) {
  return new Intl.NumberFormat('pt-PT').format(value);
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1024) return `${value} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const decimals = size >= 10 ? 1 : 2;
  return `${size.toFixed(decimals)} ${units[unit]}`;
}

function resolvePrimaryAction(jogo) {
  const rawType = String(jogo?.primaryActionType || '').trim().toLowerCase();
  const type = rawType || 'download';

  if (!type) return null;

  const explicitUrl = String(jogo?.primaryActionUrl || '').trim();
  const fallbackUrl = String(jogo?.linkJogo || '').trim();
  const url = explicitUrl || fallbackUrl || '';
  const viaApiDefault = type === 'download';
  const viaApi = typeof jogo?.primaryActionViaApi === 'boolean'
    ? jogo.primaryActionViaApi
    : viaApiDefault;

  const label = String(jogo?.primaryActionLabel || '').trim()
    || (type === 'play' ? 'Jogar Agora' : type === 'error' ? 'Link Indisponível' : 'Descarregar Tradução');

  const message = String(jogo?.primaryActionMessage || '').trim()
    || 'Esta ação está temporariamente indisponível. Contacta a equipa no Discord para apoio.';
  const helpUrl = String(jogo?.primaryActionHelpUrl || 'https://discord.gg/Xv7ax2VkEp').trim();

  if (type === 'play' && !viaApi && !url) return null;
  if (type !== 'download' && type !== 'play' && type !== 'error') return null;

  return {
    type,
    label,
    url,
    viaApi,
    message,
    helpUrl,
    icon: type === 'play' ? 'fa-gamepad' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-download',
    counterLabel: type === 'play' ? 'acessos' : 'descargas'
  };
}

function buildDownloadSection(jogo, downloadsData) {
  const { avisoHtml, notasHtml } = buildNotesSection(jogo.avisos, jogo.notas);
  const primaryAction = resolvePrimaryAction(jogo);
  const slug = getGameSlug(jogo);
  const downloads = downloadsData?.[slug]?.downloads;
  const showCounter = !!primaryAction && primaryAction.type !== 'error';
  const counterLabel = primaryAction?.counterLabel || 'descargas';
  const downloadsText = showCounter && typeof downloads === 'number'
    ? `${formatNumberPt(downloads)} ${counterLabel}`
    : '';
  const downloadsStatStyle = downloadsText ? '' : ' style="display:none"';
  const links = [];
  if (jogo.linkJogo) {
    links.push({ label: 'Página do Jogo', icon: 'fa-gamepad', url: jogo.linkJogo });
  }
  const linksHtml = links.length
    ? `<div class="download-links">
        ${links.map(l => `
          <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
            <i class="fas ${l.icon}"></i> ${escapeHtml(l.label)}
          </a>`).join('')}
      </div>`
    : '';
  const guideLink = resolveGuideLink(jogo);
  const guideActionHtml = guideLink
    ? `<a href="${escapeHtml(guideLink)}" class="btn btn-secondary btn-guide-inline" title="Consultar termos e notas da tradução" aria-label="Guia da Tradução: termos e notas">
          <i class="fas fa-book-open"></i> Guia da Tradução
        </a>`
    : '';
  const primaryActionHtml = primaryAction
    ? `<a href="${escapeHtml(primaryAction.url || '#')}" class="btn btn-primary download-btn"
          data-game-id="${escapeHtml(slug)}"
          data-action-type="${escapeHtml(primaryAction.type)}"
          data-action-url="${escapeHtml(primaryAction.url)}"
          data-action-via-api="${primaryAction.viaApi ? 'true' : 'false'}"
          data-counter-label="${escapeHtml(primaryAction.counterLabel)}"
          data-action-message="${escapeHtml(primaryAction.message)}"
          data-action-help-url="${escapeHtml(primaryAction.helpUrl)}"
          aria-label="${escapeHtml(primaryAction.label)}">
          <i class="fas ${primaryAction.icon}"></i>
          <div class="download-btn-text">
            <div>${escapeHtml(primaryAction.label)}</div>
            <div class="download-stats-number" aria-hidden="true"${downloadsStatStyle}>${escapeHtml(downloadsText)}</div>
          </div>
        </a>`
    : '';

  return `
  <section class="game-section download-section" id="download">
    <h2 class="section-title"><i class="fas fa-download"></i> Descargas e Avisos</h2>
    <div class="section-content">
      <div class="download-actions">
        ${primaryActionHtml}
        ${guideActionHtml}
        <a href="https://drive.google.com/drive/folders/12kypBij0cTK4ih-ug3b4z0H3CcrzTJJY?usp=sharing" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
          <i class="fas fa-folder-open"></i> Licenças
        </a>
      </div>
      ${linksHtml}
      <div class="license-warning">
        <i class="fas fa-scale-balanced"></i>
        <div>
          <strong>Licença atualizada:</strong> consulta a pasta oficial antes de usar esta tradução.
        </div>
      </div>
      ${avisoHtml}
      ${notasHtml ? `<div class="notes-list">${notasHtml}\n      </div>` : ''}
    </div>
  </section>`;
}

function buildCommentsSection(jogo) {
  const title = stripPtPt(jogo.titulo || getGameSlug(jogo) || 'Comentários');
  const prompts = [
    'Testado em: [versão do jogo/sistema]',
    'Problema encontrado: [texto/menu/contexto]',
    'Sugestão de melhoria: [explicação curta]'
  ];
  const promptButtonsHtml = prompts.map(prompt => `
        <button type="button" class="comment-prompt-chip" data-copy-comment="${escapeHtml(prompt)}">
          <i class="fas fa-copy"></i> ${escapeHtml(prompt)}
        </button>
      `).join('');

  return `
  <section class="game-section comments-section" id="comentarios">
    <h2 class="section-title"><i class="fas fa-comments"></i> Comentários</h2>
    <div class="section-content">
      <div class="comments-nudge" data-comments-nudge aria-live="polite">
        <p class="comments-empty-note" data-comments-empty-note>
          <strong>Se esta discussão ainda estiver vazia,</strong> o teu feedback pode definir a próxima atualização.
        </p>
        <div class="comment-prompt-list">
          ${promptButtonsHtml}
        </div>
      </div>
      <div class="giscus-wrap">
        <div class="giscus" data-giscus-title="${escapeHtml(title)}"></div>
      </div>
      <script src="https://giscus.app/client.js"
        data-repo="100nome-traducoes/site-comments"
        data-repo-id="R_kgDORK-2Yg"
        data-category="Comentários"
        data-category-id="DIC_kwDORK-2Ys4C2BON"
        data-mapping="specific"
        data-term="${escapeHtml(title)}"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="1"
        data-input-position="bottom"
        data-theme="/assets/css/components/giscus-theme.css?v=${escapeHtml(ASSET_VERSIONS.giscusThemeCss)}"
        data-lang="pt"
        crossorigin="anonymous"
        async>
      </script>
    </div>
  </section>`;
}

function buildAtributosTooltip(atributos) {
  const map = {
    ao: { img: 'ao.png', alt: 'AO90', tip: "Acordo ortográfico de '90" },
    ao90: { img: 'ao.png', alt: 'AO90', tip: "Acordo ortográfico de '90" },
    t: { img: 't.png', alt: 'Textos', tip: 'Textos e legendas traduzidos' },
    textos: { img: 't.png', alt: 'Textos', tip: 'Textos e legendas traduzidos' },
    m: { img: 'm.png', alt: 'Menus', tip: 'Menus traduzidos' },
    menus: { img: 'm.png', alt: 'Menus', tip: 'Menus traduzidos' },
    r: { img: 'r.png', alt: 'Revisão', tip: 'Revisão aprovada pelo 100Nome' },
    revisao: { img: 'r.png', alt: 'Revisão', tip: 'Revisão aprovada pelo 100Nome' },
    i: { img: 'i.png', alt: 'Imagens', tip: 'Imagens traduzidas' },
    imagens: { img: 'i.png', alt: 'Imagens', tip: 'Imagens traduzidas' }
  };

  return (atributos || [])
    .map(key => map[String(key).toLowerCase()])
    .filter(Boolean)
    .map(item => `
      <span class="gp-tooltip-wrap">
        <img class="attribute-badge" alt="${escapeHtml(item.alt)}" src="/data/site-assets/atributos/${item.img}">
        <span class="gp-tooltip">${escapeHtml(item.tip)}</span>
      </span>
    `)
    .join('');
}

function resolveImageList(jogo) {
  const fromField = Array.isArray(jogo.imagens)
    ? jogo.imagens
    : (Array.isArray(jogo.translationImages) ? jogo.translationImages : []);

  if (fromField.length > 0) {
    return fromField
      .map((item) => {
        if (typeof item === 'string') return { src: item };
        return {
          src: item.url || item.src || ''
        };
      })
      .filter(item => item.src);
  }

  const gameSlug = getGameSlug(jogo);
  if (!gameSlug) return [];
  const folder = path.join(__dirname, '..', 'data', 'game-content', gameSlug, 'translation');
  if (!fs.existsSync(folder)) return [];

  const files = fs.readdirSync(folder)
    .filter(file => /\.(png|jpe?g|webp|gif)$/i.test(file))
    .sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));

  return files.map((file) => ({
    src: `/data/game-content/${gameSlug}/translation/${file}`
  }));
}

function buildTranslationSection(jogo) {
  const traducao = normalizeTraducao(jogo);
  const imagens = resolveImageList(jogo);
  const hasImages = imagens.length > 0;

  const slidesHtml = hasImages
    ? imagens
      .map((img, idx) => `
        <div class="carousel-slide">
          <img src="${escapeHtml(img.src)}" alt="Captura ${idx + 1}" loading="lazy">
        </div>
      `)
      .join('')
    : '';

  const atributosHtml = buildAtributosTooltip(traducao.atributos);
  const autoresChips = traducao.autores
    .map(a => `
      <span class="gp-tooltip-wrap">
        <span class="gp-author-chip">${escapeHtml(initialsFromName(a.nome))}</span>
        <span class="gp-tooltip">${escapeHtml(a.papel)}</span>
      </span>
    `)
    .join('');
  const autoresNames = traducao.autores.map(a => a.nome).join(' · ');

  const providerHtml = isExternalProvider(traducao.fornecidoPor)
    ? `<div class="gp-info-item">
        <i class="fas fa-link"></i>
        <div>
          <span class="gp-info-label">Fornecida por</span>
          <span class="gp-info-value">${escapeHtml(traducao.fornecidoPor)}</span>
        </div>
      </div>`
    : '';

  const thanksText = traducao.agradecimentos.join(' · ');
  const thanksHtml = thanksText
    ? `<div class="gp-info-item gp-info-item--thanks">
        <i class="fas fa-heart"></i>
        <div>
          <span class="gp-info-label">Agradecimentos</span>
          <span class="gp-info-value">${escapeHtml(thanksText)}</span>
        </div>
      </div>`
    : '';
  const packageSizeText = formatBytes(jogo.packageSizeBytes);
  const packageLastModifiedText = jogo.packageLastModified ? formatDatePt(jogo.packageLastModified) : '';
  const packageInfoText = [packageSizeText, packageLastModifiedText].filter(Boolean).join(' · ');
  const packageInfoHtml = packageInfoText
    ? `<div class="gp-info-item">
        <i class="fas fa-box-archive"></i>
        <div>
          <span class="gp-info-label">Pacote</span>
          <span class="gp-info-value">${escapeHtml(packageInfoText)}</span>
        </div>
      </div>`
    : '';

  const carouselColHtml = hasImages
    ? `<div class="gp-carousel-col">
        <p class="gp-col-label"><i class="fas fa-images"></i> Capturas de ecrã</p>
        <div class="carousel-wrap" id="screenshotsCarousel" tabindex="0">
          <div class="carousel-track" id="carouselTrack">
            ${slidesHtml}
          </div>
          <button class="carousel-btn carousel-btn-prev" id="carouselPrev" aria-label="Anterior"><i class="fas fa-chevron-left"></i></button>
          <button class="carousel-btn carousel-btn-next" id="carouselNext" aria-label="Seguinte"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="carousel-dots" id="carouselDots"></div>
      </div>`
    : '';

  return `
  <section class="game-section gp-translation${hasImages ? '' : ' gp-translation--info-only'}">
    <div class="gp-translation-inner${hasImages ? '' : ' gp-translation-inner--info-only'}">
      ${carouselColHtml}

      <div class="gp-trans-info-col${hasImages ? '' : ' gp-trans-info-col--full'}">
        <p class="gp-col-label"><i class="fas fa-language"></i> Tradução</p>

        <div class="gp-info-row gp-info-row--col">
          <div class="gp-info-item">
            <i class="fas fa-code-branch"></i>
            <div>
              <span class="gp-info-label">Versão</span>
              <span class="gp-info-value">${escapeHtml(String(traducao.versao))}</span>
            </div>
          </div>

          ${atributosHtml ? `
          <div class="gp-info-item">
            <i class="fas fa-certificate"></i>
            <div>
              <span class="gp-info-label">Atributos</span>
              <div class="gp-badges">${atributosHtml}</div>
            </div>
          </div>` : ''}

          ${traducao.autores.length ? `
          <div class="gp-info-item">
            <i class="fas fa-users"></i>
            <div>
              <span class="gp-info-label">Autores</span>
              <div class="gp-authors">${autoresChips}</div>
              <p class="gp-authors-names">${escapeHtml(autoresNames)}</p>
            </div>
          </div>` : ''}

          ${providerHtml}
          ${packageInfoHtml}
          ${thanksHtml}
        </div>
      </div>
    </div>
  </section>`;
}

function getGameDate(jogo) {
  return jogo.dataPublicacao || '';
}

function getGameProvider(jogo) {
  return jogo.fornecido_por || jogo.informacoesTraducao?.fornecidaPor || '100Nome';
}

function getGameCreator(jogo) {
  return jogo.criador || jogo.informacoesJogo?.criadoPor || '';
}

function computeRelatedGames(jogoAtual, allGames, quantidade = 4) {
  if (!jogoAtual || !Array.isArray(allGames)) return [];
  const categoriasAtual = Array.isArray(jogoAtual.categorias) ? jogoAtual.categorias : [];
  const providerAtual = String(getGameProvider(jogoAtual) || '').trim().toLowerCase();
  const creatorAtual = String(getGameCreator(jogoAtual) || '').trim().toLowerCase();

  return allGames
    .filter(jogo => getGameSlug(jogo) !== getGameSlug(jogoAtual))
    .map(jogo => {
      let similaridade = 0;

      const categorias = Array.isArray(jogo.categorias) ? jogo.categorias : [];
      const categoriasComum = categorias.filter(cat => categoriasAtual.includes(cat)).length;
      similaridade += categoriasComum * 20;

      const provider = String(getGameProvider(jogo) || '').trim().toLowerCase();
      if (provider && providerAtual && provider === providerAtual) {
        similaridade += 15;
      }

      const creator = String(getGameCreator(jogo) || '').trim().toLowerCase();
      if (creator && creatorAtual && creator === creatorAtual) {
        similaridade += 25;
      }

      const diasDesdePublicacao = Math.floor(
        (new Date() - new Date(getGameDate(jogo))) / (1000 * 60 * 60 * 24)
      );
      if (Number.isFinite(diasDesdePublicacao) && diasDesdePublicacao <= 90) {
        similaridade += 5;
      }

      return { jogo, similaridade };
    })
    .sort((a, b) => b.similaridade - a.similaridade)
    .slice(0, quantidade)
    .map(item => item.jogo);
}

function buildRelatedGamesHtml(jogoAtual, allGames) {
  const relacionados = computeRelatedGames(jogoAtual, allGames, 4);
  if (relacionados.length === 0) {
    return '<p class="loading-text">Sem sugestões disponíveis.</p>';
  }

  return relacionados
    .map(jogo => {
      const categorias = extrairCategoriasPrincipais(jogo.categorias).slice(0, 2);
      const titulo = getGameName(jogo);
      const slug = getGameSlug(jogo);
      return `
      <a class="related-game-card" href="../${escapeHtml(slug)}">
        <img src="../../${escapeHtml(jogo.capa || '')}" alt="${escapeHtml(titulo)}" class="related-game-image" loading="lazy">
        <div class="related-game-info">
          <h4 class="related-game-title">${escapeHtml(titulo)}</h4>
          <div class="related-game-categories">
            ${categorias.map(cat => `<span class="category-tag-small">${escapeHtml(cat)}</span>`).join('')}
          </div>
        </div>
      </a>`;
    })
    .join('');
}

function getBreadcrumbCategoria(jogoCategorias, categoriasPrincipais) {
  const withIcon = (categoria) => ({
    ...categoria,
    icon: categoria?.icon || getCategoriaIcone(categoria?.id)
  });

  const gameCats = Array.isArray(jogoCategorias) ? jogoCategorias : [];
  const principais = Array.isArray(categoriasPrincipais) ? categoriasPrincipais : [];

  for (const gameCat of gameCats) {
    const cat = String(gameCat || '').toLowerCase().trim();
    if (!cat) continue;

    const match = principais.find(categoria => {
      const tags = Array.isArray(categoria.tags) ? categoria.tags : [];
      return tags.some(tag => String(tag || '').toLowerCase().trim() === cat);
    });

    if (match) return withIcon(match);
  }

  for (const categoria of principais) {
    const tags = Array.isArray(categoria.tags) ? categoria.tags : [];
    const match = tags.some(tag => gameCats.includes(tag));
    if (match) return withIcon(categoria);
  }

  return { id: 'jogo', nome: 'Jogo', icon: 'gamepad' };
}

function buildPageHtml(template, jogo, allGames, categoriasPrincipais, downloadsData, header, footer, favicon) {
  const nome = getGameName(jogo);
  const titulo = stripPtPt(jogo.titulo) || nome;
  const linguaDisplay = getLinguaDisplay(jogo);
  const gameSlug = getGameSlug(jogo);
  const breadcrumbTitulo = nome;
  const infoJogo = normalizeInfoJogo(jogo);
  const traducao = normalizeTraducao(jogo);

  const dateRaw = jogo.dataPublicacao;
  const descriptionText = String(jogo.descricao || 'Sem descrição disponível.').replace(/\s+/g, ' ').trim();
  const metaSuffix = ` Tradução ${linguaDisplay} de ${nome} para PC.`;
  const descMax = Math.max(24, 155 - metaSuffix.length);
  const metaDescription = truncate(`${truncate(descriptionText, descMax)}${metaSuffix}`, 155);
  const breadcrumbCategoria = getBreadcrumbCategoria(jogo.categorias, categoriasPrincipais);
  const badgesHtml = buildBadgesHtml(jogo);
  const pageUrl = `${SITE_URL}/jogo/${encodeURIComponent(gameSlug)}`;
  const coverPath = String(jogo.capa || '').replace(/^\/+/, '');
  const ogImage = coverPath ? `${SITE_URL}/${coverPath}` : `${SITE_URL}/data/site-assets/logo-image.png`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: nome,
    description: metaDescription,
    url: pageUrl,
    image: ogImage,
    inLanguage: 'pt-PT',
    author: {
      '@type': 'Organization',
      name: '100Nome'
    }
  });
  const gameOriginalHtml = infoJogo.nomeOriginal
    ? `<span class="gp-info-original">${escapeHtml(infoJogo.nomeOriginal)}</span>`
    : '';

  const replacements = {
    '{{FAVICON}}': favicon || '',
    '{{HEADER}}': header || '',
    '{{FOOTER}}': footer || '',
    '{{GAME_CSS_VERSION}}': escapeHtml(ASSET_VERSIONS.gameCss),
    '{{SITE_ANALYTICS_JS_VERSION}}': escapeHtml(ASSET_VERSIONS.siteAnalyticsJs),
    '{{MOTION_JS_VERSION}}': escapeHtml(ASSET_VERSIONS.motionJs),
    '{{SITE_SHELL_JS_VERSION}}': escapeHtml(ASSET_VERSIONS.siteShellJs),
    '{{GAME_PAGE_JS_VERSION}}': escapeHtml(ASSET_VERSIONS.gamePageJs),
    '{{DOWNLOAD_COUNTER_JS_VERSION}}': escapeHtml(ASSET_VERSIONS.downloadCounterJs),
    '{{PAGE_TITLE}}': escapeHtml(`${titulo} — Tradução ${linguaDisplay} | 100Nome Traduções`),
    '{{META_DESCRIPTION}}': escapeHtml(metaDescription),
    '{{PAGE_URL}}': escapeHtml(pageUrl),
    '{{OG_IMAGE}}': escapeHtml(ogImage),
    '{{GAME_JSON_LD}}': jsonLd,
    '{{SLUG}}': escapeHtml(gameSlug),
    '{{BREADCRUMB_CURRENT}}': escapeHtml(breadcrumbTitulo),
    '{{BREADCRUMB_CATEGORY_ID}}': escapeHtml(breadcrumbCategoria.id),
    '{{BREADCRUMB_CATEGORY_NAME}}': escapeHtml(breadcrumbCategoria.nome),
    '{{BREADCRUMB_CATEGORY_ICON}}': escapeHtml(breadcrumbCategoria.icon),
    '{{COVER_IMAGE}}': escapeHtml(jogo.capa || ''),
    '{{COVER_ALT}}': escapeHtml(`${nome} - Tradução ${linguaDisplay} - 100Nome`),
    '{{GAME_TITLE}}': escapeHtml(`${titulo} — Tradução ${linguaDisplay}`),
    '{{GAME_SUBTITLE_HTML}}': '',
    '{{META_DATE}}': escapeHtml(formatDatePt(dateRaw)),
    '{{META_VERSION}}': escapeHtml(`v${traducao.versao || '1.0'}`),
    '{{BADGES_HTML}}': badgesHtml,
    '{{DESCRIPTION_TEXT}}': escapeHtml(descriptionText),
    '{{GAME_NAME}}': escapeHtml(infoJogo.nome),
    '{{GAME_ORIGINAL_HTML}}': gameOriginalHtml,
    '{{GAME_CREATOR}}': escapeHtml(infoJogo.criador),
    '{{TRANSLATION_SECTION}}': buildTranslationSection(jogo),
    '{{DOWNLOAD_SECTION}}': buildDownloadSection(jogo, downloadsData),
    '{{RELATED_GAMES_HTML}}': buildRelatedGamesHtml(jogo, allGames),
    '{{WIKI_BUTTON}}': buildWikiButton(jogo),
    '{{COMMENTS_SECTION}}': buildCommentsSection(jogo)
  };

  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}

async function fetchDownloadsData(slugs) {
  const API_BASE = process.env.DOWNLOADS_API_URL || 'https://100nome-api.netlify.app/.netlify/functions';
  const downloadsData = {};

  await Promise.all(slugs.map(async (slug) => {
    try {
      const res = await fetch(`${API_BASE}/count?id=${slug}`);
      if (res.ok) {
        const data = await res.json();
        downloadsData[slug] = { downloads: data.downloads ?? null };
      }
    } catch (err) {
      console.warn(`[downloads] Falha ao obter contador para ${slug}:`, err.message);
    }
  }));

  return downloadsData;
}

async function main() {
  if (!fs.existsSync(templatePath)) {
    console.error('Template não encontrado:', templatePath);
    process.exit(1);
  }

  const data = readJson(jogosPath);
  const template = fs.readFileSync(templatePath, 'utf8');
  const header = readPartial('header.html');
  const footer = readPartial('footer.html');
  const favicon = readPartial('favicon.html');
  const categoriasPrincipais = data.categoriasPrincipais || [];
  const packagesMap = readPackagesMetadata();
  const allGames = (data.jogos || [])
    .filter(jogo => getGameSlug(jogo))
    .map(jogo => mergePackageMetadata(jogo, packagesMap));

  // Buscar contadores ao Netlify (com fallback para downloads.json local)
  let downloadsData = {};
  try {
    const slugs = allGames.map(getGameSlug);
    downloadsData = await fetchDownloadsData(slugs);
    console.log('[downloads] Contadores obtidos do Netlify');
  } catch (err) {
    console.warn('[downloads] Falha ao obter contadores, a usar ficheiro local:', err.message);
    downloadsData = fs.existsSync(downloadsPath) ? readJson(downloadsPath) : {};
  }

  const legacyNames = new Set();
  for (const jogo of allGames) {
    const slug = getGameSlug(jogo);
    if (slug) legacyNames.add(`${slug}.html`);
  }
  for (const name of legacyNames) {
    const legacyFile = path.join(outputDir, name);
    if (fs.existsSync(legacyFile)) {
      fs.unlinkSync(legacyFile);
    }
  }

  for (const jogo of allGames) {
    const html = buildPageHtml(template, jogo, allGames, categoriasPrincipais, downloadsData, header, footer, favicon);
    const slug = getGameSlug(jogo);

    const pageDir = path.join(outputDir, slug);
    fs.mkdirSync(pageDir, { recursive: true });
    const outPath = path.join(pageDir, 'index.html');
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Gerado: ${outPath}`);
  }
}

main();
