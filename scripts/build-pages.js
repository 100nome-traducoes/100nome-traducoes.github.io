#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const jogosPath = path.join(__dirname, '..', 'data', 'jogos.json');
const templatePath = path.join(__dirname, '..', 'jogo', 'game-template.html');
const outputDir = path.join(__dirname, '..', 'jogo');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripPrefixTitulo(titulo) {
  return String(titulo).replace(/^Tradução:\s*/i, '').trim();
}

function stripPtPt(titulo) {
  return String(titulo)
    .replace(/^Tradução:\s*/i, '')
    .replace(/\s*PT-PT\s*$/i, '')
    .trim();
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
  const t = String(text).trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1).trim() + '…';
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
    objetosescondidos: 'Objetos Escondidos'
  };

  return (categorias || [])
    .map(cat => {
      const catLower = String(cat).toLowerCase().replace(/[^a-z]/g, '');
      return categoriasMap[catLower];
    })
    .filter(Boolean);
}

function buildBadgesHtml(categorias) {
  const principais = extrairCategoriasPrincipais(categorias).slice(0, 2);
  if (principais.length === 0) return '';

  const labelToId = {
    'Ação': 'acao',
    'Mistério': 'misterio',
    'Quebra-cabeças': 'quebracabecas',
    'Corrida': 'corrida',
    'Estratégia': 'estrategia',
    'Aventura': 'aventura',
    'RPG': 'rpg',
    'Simulação': 'simulacao',
    'Objetos Escondidos': 'objetosescondidos'
  };

  return principais
    .map(nome => {
      const categoriaId = labelToId[nome] || 'gamepad';
      const icon = getCategoriaIcone(categoriaId);
      return `<span class="badge badge-category"><i class="fas fa-${icon}"></i> ${escapeHtml(nome)}</span>`;
    })
    .join('');
}

function buildInfoRows(info) {
  const rows = [];
  if (info.nome) rows.push(['Nome', info.nome]);
  if (info.nomeOriginal) rows.push(['Nome Original', info.nomeOriginal]);
  if (info.nomeAlternativo) rows.push(['Nome Alternativo', info.nomeAlternativo]);
  if (info.criadoPor) rows.push(['Criado por', info.criadoPor]);
  if (info.estilo) rows.push(['Estilo', info.estilo]);

  return rows
    .map(([label, value]) => `<dt>${escapeHtml(label)}:</dt><dd>${escapeHtml(value)}</dd>`)
    .join('\n');
}

function buildAtributos(atributos) {
  const map = {
    ao: { label: 'AO', title: 'Acordo Ortográfico' },
    t: { label: 'T', title: 'Tradução' },
    m: { label: 'M', title: 'Menu' },
    r: { label: 'R', title: 'Revisão' },
    i: { label: 'I', title: 'Imagens' }
  };

  return (atributos || [])
    .map(key => {
      const item = map[key];
      if (!item) return '';
      return `<span class="attribute-badge" title="${escapeHtml(item.title)}">${item.label}</span>`;
    })
    .filter(Boolean)
    .join('');
}

function buildTraducaoRows(info) {
  const rows = [];
  if (info.versao) rows.push(['Versão', info.versao]);
  if (info.fornecidaPor) rows.push(['Fornecida por', info.fornecidaPor]);
  if (info.tradutores) rows.push(['Tradutores', info.tradutores]);
  if (info.revisores) rows.push(['Revisores', info.revisores]);
  if (info.agradecimentos) rows.push(['Agradecimentos', info.agradecimentos]);

  let html = rows
    .map(([label, value]) => `<dt>${escapeHtml(label)}:</dt><dd>${escapeHtml(value)}</dd>`)
    .join('\n');

  const atributosHtml = buildAtributos(info.atributos);
  if (atributosHtml) {
    html += `\n<dt>Atributos:</dt><dd>${atributosHtml}</dd>`;
  }

  return html;
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
    .map(nota => `
      <div class="note-item">
        <i class="fas fa-check-circle"></i>
        <span>${escapeHtml(nota)}</span>
      </div>`)
    .join('');

  return { avisoHtml, notasHtml };
}

function buildDownloadSection(jogo) {
  const { avisoHtml, notasHtml } = buildNotesSection(jogo.avisos, jogo.notas);
  const downloadLabel = jogo.rebrandlyId ? 'Descarregar Tradução' : 'Abrir Página';
  const downloadIcon = jogo.rebrandlyId ? 'fa-download' : 'fa-external-link-alt';
  const downloadIntro = jogo.rebrandlyId
    ? 'Antes de descarregar, verifica as licenças e os avisos abaixo.'
    : 'Consulta a página original e as licenças antes de continuar.';
  const links = [];
  if (jogo.linkJogo) {
    links.push({ label: 'Página do Jogo', icon: 'fa-gamepad', url: jogo.linkJogo });
  }
  if (jogo.linkWiki) {
    links.push({ label: 'Wiki da Tradução', icon: 'fa-book', url: jogo.linkWiki });
  }
  const linksHtml = links.length
    ? `<div class="download-links">
        ${links.map(l => `
          <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
            <i class="fas ${l.icon}"></i> ${escapeHtml(l.label)}
          </a>`).join('')}
      </div>`
    : '';

  return `
  <section class="game-section download-section" id="download">
    <h2 class="section-title"><i class="fas fa-download"></i> Descargas e Avisos</h2>
    <div class="section-content">
      <p class="download-intro">${escapeHtml(downloadIntro)}</p>
      <div class="download-actions">
        <a href="${escapeHtml(jogo.downloadUrl || jogo.link || '#')}" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
          <i class="fas ${downloadIcon}"></i> ${escapeHtml(downloadLabel)}
        </a>
        <a href="https://drive.google.com/drive/folders/12kypBij0cTK4ih-ug3b4z0H3CcrzTJJY?usp=sharing" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
          <i class="fas fa-folder-open"></i> Licenças
        </a>
      </div>
      ${linksHtml}
      <div class="download-count" data-downloads>
        <i class="fas fa-download"></i>
        <span id="downloadsCount">—</span>
      </div>
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
  const title = stripPtPt(jogo.titulo || jogo.guid || 'Comentários');

  return `
  <section class="game-section comments-section" id="comentarios">
    <h2 class="section-title"><i class="fas fa-comments"></i> Comentários</h2>
    <div class="section-content">
      <p class="comments-intro">Partilha a tua experiência com esta tradução. Se encontraste algum erro, diz-nos aqui.</p>
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
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="https://raw.githubusercontent.com/100nome-traducoes/site-comments/refs/heads/main/giscus-theme.css"
        data-lang="pt"
        crossorigin="anonymous"
        async>
      </script>
    </div>
  </section>`;
}

function buildDescriptionParagraphs(text) {
  const t = String(text || '').trim();
  if (!t) return '<p>Sem descrição disponível.</p>';

  const parts = t.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  return parts.map(p => `<p>${escapeHtml(p)}</p>`).join('\n');
}

function getBreadcrumbCategoria(jogoCategorias, categoriasPrincipais) {
  for (const categoria of categoriasPrincipais) {
    const match = categoria.tags.some(tag => (jogoCategorias || []).includes(tag));
    if (match) return categoria;
  }
  return { id: 'jogo', nome: 'Jogo', icon: 'gamepad' };
}

function buildPageHtml(template, jogo, categoriasPrincipais) {
  const tituloSemPrefixo = stripPrefixTitulo(jogo.titulo || '');
  const breadcrumbTitulo = stripPtPt(jogo.titulo || '');
  const metaDescription = truncate(jogo.descricao || '', 160);
  const categoria = getBreadcrumbCategoria(jogo.categorias, categoriasPrincipais);

  const replacements = {
    '{{PAGE_TITLE}}': escapeHtml(`${tituloSemPrefixo} - Tradução 100Nome`),
    '{{META_DESCRIPTION}}': escapeHtml(metaDescription),
    '{{GUID}}': escapeHtml(jogo.guid),
    '{{BREADCRUMB_CATEGORY_ID}}': escapeHtml(categoria.id),
    '{{BREADCRUMB_CATEGORY_NAME}}': escapeHtml(categoria.nome),
    '{{BREADCRUMB_CATEGORY_ICON}}': escapeHtml(getCategoriaIcone(categoria.id)),
    '{{BREADCRUMB_CURRENT}}': escapeHtml(breadcrumbTitulo),
    '{{COVER_IMAGE}}': escapeHtml(jogo.capa || ''),
    '{{COVER_ALT}}': escapeHtml(`${tituloSemPrefixo} - Tradução PT-PT - 100Nome`),
    '{{BADGES_HTML}}': buildBadgesHtml(jogo.categorias),
    '{{GAME_TITLE}}': escapeHtml(tituloSemPrefixo),
    '{{GAME_SUBTITLE}}': escapeHtml('Tradução em português de Portugal'),
    '{{META_DATE}}': escapeHtml(formatDatePt(jogo.dataPublicacao)),
    '{{META_TRADUTORES}}': escapeHtml(jogo.informacoesTraducao?.tradutores || 'n/d'),
    '{{META_VERSION}}': escapeHtml(`Versão ${jogo.informacoesTraducao?.versao || '1.0'}`),
    '{{DOWNLOAD_LINK}}': escapeHtml(jogo.downloadUrl || jogo.link || '#'),
    '{{DESCRIPTION_PARAGRAPHS}}': buildDescriptionParagraphs(jogo.descricao),
    '{{INFO_JOGO_ROWS}}': buildInfoRows(jogo.informacoesJogo || {}),
    '{{INFO_TRADUCAO_ROWS}}': buildTraducaoRows(jogo.informacoesTraducao || {}),
    '{{DOWNLOAD_SECTION}}': buildDownloadSection(jogo),
    '{{COMMENTS_SECTION}}': buildCommentsSection(jogo)
  };

  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}

function main() {
  if (!fs.existsSync(templatePath)) {
    console.error('Template não encontrado:', templatePath);
    process.exit(1);
  }

  const data = readJson(jogosPath);
  const template = fs.readFileSync(templatePath, 'utf8');
  const categoriasPrincipais = data.categoriasPrincipais || [];

  for (const jogo of data.jogos || []) {
    const html = buildPageHtml(template, jogo, categoriasPrincipais);
    const outPath = path.join(outputDir, `${jogo.guid}.html`);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Gerado: ${outPath}`);
  }
}

main();
