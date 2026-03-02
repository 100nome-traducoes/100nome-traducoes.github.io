#!/usr/bin/env node

/**
 * Build Script - Wiki Generator
 * Converte ficheiros .wikimd em páginas HTML completas
 * 
 * Uso: node build-wiki.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const marked = require('marked'); // npm install marked
const { resolveSiteUrl, applyGlobalSiteLinks } = require('./site-config');

// Configuração
const CONFIG = {
    inputDir: '../data/wiki-content',
    outputDir: '../wiki',
    templateFile: '../templates/wiki-page.html',
    dataFile: '../data/game-content/jogos.json',
    packagesMetadataFile: '../data/game-content/packages-metadata.json'
};
const SITE_URL = resolveSiteUrl();
const SITE_HOST = (() => {
    try {
        return new URL(SITE_URL).hostname.replace(/^www\./i, '');
    } catch {
        return '';
    }
})();
const ASSET_VERSIONS = {
    wikiCss: getAssetVersion('assets/css/pages/wiki.css'),
    siteAnalyticsJs: getAssetVersion('assets/js/components/site-analytics.js'),
    motionJs: getAssetVersion('assets/js/components/motion.js'),
    siteShellJs: getAssetVersion('assets/js/components/site-shell.js'),
    wikiPageJs: getAssetVersion('assets/js/pages/wiki-page.js')
};

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

function truncateText(text, maxLen = 170) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= maxLen) return t;
    return `${t.slice(0, maxLen - 1).trim()}…`;
}

function readPackagesMetadata() {
    const metadataPath = path.join(__dirname, CONFIG.packagesMetadataFile);
    if (!fs.existsSync(metadataPath)) return {};
    try {
        const raw = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        if (!raw || typeof raw !== 'object') return {};
        if (!raw.packages || typeof raw.packages !== 'object') return {};
        return raw.packages;
    } catch {
        return {};
    }
}

function mergePackageMetadata(jogoData, gameSlug, packagesMap) {
    const baseData = (jogoData && typeof jogoData === 'object') ? jogoData : {};
    const meta = packagesMap?.[gameSlug];
    if (!meta || typeof meta !== 'object') return baseData;

    return {
        ...baseData,
        packageVersion: String(meta.packageVersion || '').trim() || null,
        packageLastModified: String(meta.packageLastModified || '').trim() || null
    };
}

function isExternalHttpUrl(href) {
    try {
        const parsed = new URL(String(href || '').trim(), SITE_URL);
        if (!/^https?:$/i.test(parsed.protocol)) return false;
        const hrefHost = parsed.hostname.replace(/^www\./i, '');
        if (!hrefHost || !SITE_HOST) return false;
        return hrefHost !== SITE_HOST;
    } catch {
        return false;
    }
}

function addExternalLinkAttributes(html) {
    return html.replace(/<a\b([^>]*?)>/gi, (fullMatch, attrs) => {
        const hrefMatch = attrs.match(/\bhref\s*=\s*(['"])(.*?)\1/i);
        if (!hrefMatch) return fullMatch;

        const href = hrefMatch[2].trim();
        if (!isExternalHttpUrl(href)) return fullMatch;

        let updatedAttrs = attrs;
        if (!/\btarget\s*=/i.test(updatedAttrs)) {
            updatedAttrs += ' target="_blank"';
        }

        if (/\brel\s*=/i.test(updatedAttrs)) {
            updatedAttrs = updatedAttrs.replace(/\brel\s*=\s*(['"])(.*?)\1/i, (relMatch, quote, relValue) => {
                const relTokens = new Set(String(relValue || '').split(/\s+/).filter(Boolean));
                relTokens.add('noopener');
                relTokens.add('noreferrer');
                return `rel=${quote}${[...relTokens].join(' ')}${quote}`;
            });
        } else {
            updatedAttrs += ' rel="noopener noreferrer"';
        }

        return `<a${updatedAttrs}>`;
    });
}

// Parser de frontmatter YAML
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return { metadata: {}, content: content };
    }
    
    const metadata = {};
    const lines = match[1].split('\n');
    
    lines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
            metadata[key.trim()] = valueParts.join(':').trim();
        }
    });
    
    return {
        metadata,
        content: match[2]
    };
}

// Converter tabela markdown em HTML com classes bonitas
function convertTablesToHTML(html) {
    // Encontrar todas as tabelas
    const tableRegex = /<table([^>]*)>([\s\S]*?)<\/table>/g;
    
    return html.replace(tableRegex, (match, tableAttrs = '', tableContent) => {
        // Verificar se tem coluna de imagens
        const hasImages = tableContent.includes('<img') || tableContent.toLowerCase().includes('imagem');
        const isVerticalHeader = /data-vertical-header=["']?true["']?/i.test(tableAttrs);
        
        let classes = 'translation-table';
        if (hasImages) {
            classes += ' has-images';
        }
        if (isVerticalHeader) {
            classes += ' vertical-header-table';
        }
        
        // Adicionar wrapper e classes
        return `
            <div class="translation-table-wrapper">
                <table class="${classes}">
                    ${tableContent}
                </table>
            </div>
        `;
    });
}

// Converter grelha de botões via bloco :::grid ... ::: (ou :::grid-featured ... :::)
function convertButtonGrids(markdown) {
    const gridRegex = /:::(grid(?:-featured)?)\s*([\s\S]*?)\s*:::/gi;
    return markdown.replace(gridRegex, (match, gridType, body) => {
        const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
        const items = [];

        lines.forEach(line => {
            // formato markdown normal: [Texto](link)
            const mdLinkMatch = line.match(/^-?\s*\[([^\]]+)\]\(([^)]+)\)\s*$/);
            if (mdLinkMatch) {
                items.push({ text: mdLinkMatch[1].trim(), href: mdLinkMatch[2].trim() });
                return;
            }

            // formato simples: Texto (link) - permite [icon:...] no texto
            const simpleMatch = line.match(/^-?\s*(.+?)\s*\(([^)]+)\)\s*$/);
            if (simpleMatch) {
                items.push({ text: simpleMatch[1].trim(), href: simpleMatch[2].trim() });
            }
        });

        if (items.length === 0) return match;

        const linksHtml = items
            .map(item => {
                const iconMatch = item.text.match(/^\[icon:([a-z0-9-]+)\]\s*(.*)$/i);
                if (iconMatch) {
                const icon = iconMatch[1];
                    const text = iconMatch[2] || '';
                    return `<a class="wiki-button" href="${item.href}"><i class="mdi mdi-${icon}"></i><span>${text}</span></a>`;
                }
                return `<a class="wiki-button" href="${item.href}">${item.text}</a>`;
            })
            .join('');

        const extraClass = gridType === 'grid-featured' ? ' wiki-button-grid--featured' : '';
        return `<div class="wiki-button-grid${extraClass}">${linksHtml}</div>`;
    });
}

// Converter embed de YouTube via sintaxe:
// :::youtube VIDEO_ID
// :::
function extractYouTubeId(value) {
    const input = String(value || '').trim();
    if (!input) return '';

    if (/^[\w-]{8,}$/.test(input)) return input;

    const shortMatch = input.match(/youtu\.be\/([\w-]{8,})/i);
    if (shortMatch) return shortMatch[1];

    const watchMatch = input.match(/[?&]v=([\w-]{8,})/i);
    if (watchMatch) return watchMatch[1];

    const embedMatch = input.match(/youtube\.com\/embed\/([\w-]{8,})/i);
    if (embedMatch) return embedMatch[1];

    return '';
}

function buildYouTubeIframe(videoId, title = 'Vídeo YouTube') {
    return `
<div class="wiki-video">
  <iframe
    src="https://www.youtube.com/embed/${videoId}"
    title="${title}"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen>
  </iframe>
</div>
`;
}

// Converter grupo de vídeos via sintaxe:
// :::youtube-group
// VIDEO_ID ou URL
// VIDEO_ID ou URL | Título opcional
// :::
function convertYouTubeGroups(markdown) {
    const groupRegex = /:::youtube-group\s*([\s\S]*?)\s*:::/gi;
    return markdown.replace(groupRegex, (match, body) => {
        const lines = body.split('\n').map(line => line.trim()).filter(Boolean);
        const items = [];

        lines.forEach(line => {
            const cleanLine = line.replace(/^-+\s*/, '').trim();
            if (!cleanLine) return;

            const [videoRaw, titleRaw] = cleanLine.split('|').map(part => part.trim());
            const videoId = extractYouTubeId(videoRaw);
            if (!videoId) return;

            items.push({
                videoId,
                title: titleRaw || 'Vídeo YouTube'
            });
        });

        if (!items.length) return match;

        const videosHtml = items.map(item => buildYouTubeIframe(item.videoId, item.title)).join('');
        return `<div class="wiki-video-group">${videosHtml}</div>`;
    });
}

function convertYouTubeEmbeds(markdown) {
    const ytRegex = /:::youtube\s+([\w-]+)\s*:::/gi;
    return markdown.replace(ytRegex, (match, videoInput) => {
        const videoId = extractYouTubeId(videoInput);
        if (!videoId) return match;
        return buildYouTubeIframe(videoId);
    });
}

// Adicionar captions a tabelas via linha ":caption: texto" antes da tabela
function convertTableCaptions(html) {
    return html.replace(/<p>\s*:caption:\s*([\s\S]*?)\s*<\/p>\s*<table>/gi, (match, captionHtml) => {
        const safeHtml = captionHtml.trim();
        return `<table><caption>${safeHtml}</caption>`;
    });
}

// Ativar cabeçalho vertical quando o primeiro <th> começa com "^"
// Ativar cabeçalho vertical quando o primeiro <th> começa com "^"
// Se o primeiro <th> for apenas "^", remove o thead (títulos laterais apenas)
function convertVerticalHeaderTables(html) {
    const tableRegex = /<table>([\s\S]*?)<\/table>/g;

    return html.replace(tableRegex, (match, tableContent) => {
        const headerMatch = tableContent.match(/<thead>[\s\S]*?<\/thead>/i);
        if (!headerMatch) return match;

        const thead = headerMatch[0];
        const firstThMatch = thead.match(/<th>([\s\S]*?)<\/th>/i);
        if (!firstThMatch) return match;

        const rawHeader = firstThMatch[1] || '';
        if (!rawHeader.trim().startsWith('^')) return match;

        const cleanedHeader = rawHeader.replace(/^\s*\^\s*/, '');
        const onlyCaret = cleanedHeader.trim() === '';
        const newThead = onlyCaret
            ? ''
            : thead.replace(firstThMatch[0], `<th>${cleanedHeader}</th>`);

        let newTableContent = onlyCaret
            ? tableContent.replace(thead, '')
            : tableContent.replace(thead, newThead);

        // Converter primeira célula de cada linha do tbody em <th>
        newTableContent = newTableContent.replace(/<tbody>([\s\S]*?)<\/tbody>/i, (tbodyMatch, tbodyContent) => {
            const updatedBody = tbodyContent.replace(/<tr>([\s\S]*?)<\/tr>/g, (trMatch, trContent) => {
                return trMatch.replace(/<td>([\s\S]*?)<\/td>/i, '<th>$1</th>');
            });
            return `<tbody>${updatedBody}</tbody>`;
        });

        return `<table data-vertical-header="true">${newTableContent}</table>`;
    });
}

// Converter headings com ícones e aplicar classe
function convertIconHeadings(html) {
    const slugify = (text) => {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    };

    const applyHeading = (level, className) => {
        const regex = new RegExp(`<h${level}([^>]*)>([\\s\\S]*?)<\\/h${level}>`, 'gi');
        return html.replace(regex, (match, attrs, inner) => {
            let content = inner.trim();

            let manualId = null;
            const manualMatch = content.match(/\s*\{#([a-z0-9\-_]+)\}\s*$/i);
            if (manualMatch) {
                manualId = manualMatch[1];
                content = content.replace(manualMatch[0], '').trim();
            }

            const iconMatch = content.match(/^\[icon:([a-z0-9-]+)\]\s*(.*)$/i);
            const icon = iconMatch ? iconMatch[1] : null;
            const text = iconMatch ? (iconMatch[2] || '') : content;

            const existingIdMatch = attrs.match(/\sid="([^"]+)"/i);
            const idValue = manualId || (existingIdMatch ? existingIdMatch[1] : slugify(text));
            const idAttr = idValue ? ` id="${idValue}"` : '';

            if (icon) {
                return `<h${level} class="${className}"${idAttr}><i class="mdi mdi-${icon}"></i> ${text}</h${level}>`;
            }
            return `<h${level} class="${className}"${idAttr}>${text}</h${level}>`;
        });
    };

    html = applyHeading(2, 'wiki-section-title');
    html = applyHeading(3, 'wiki-subsection-title');
    return html;
}

function countTermsFromMarkdown(content) {
    const lines = content.split('\n');
    let total = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const next = lines[i + 1] || '';
        const isTableLine = line.trim().startsWith('|');
        const isSeparator = next.trim().startsWith('|') && /^[\|\s:-]+$/.test(next.trim());

        if (!isTableLine || !isSeparator) continue;

        const tableLines = [];
        tableLines.push(line);
        tableLines.push(next);
        i += 2;

        while (i < lines.length && lines[i].trim().startsWith('|')) {
            tableLines.push(lines[i]);
            i++;
        }
        i -= 1;

        const rows = tableLines
            .filter(l => l.trim().startsWith('|'))
            .map(l => l.split('|').map(c => c.trim()).filter(Boolean));

        let tableCount = 0;

        // Detectar tabelas invertidas (cabeçalho vertical)
        const headerCells = rows[0] || [];
        const headerFirst = (headerCells[0] || '').toLowerCase();
        const isVerticalHeader = headerFirst === '^';
        if (isVerticalHeader) {
            tableCount = Math.max(0, headerCells.length - 1);
        }

        // Procurar linhas "Nome PT/EN" para contar colunas
        rows.forEach(cells => {
            const first = (cells[0] || '').toLowerCase();
            if (/^nome(\s+(pt|en))?$/.test(first)) {
                tableCount = Math.max(tableCount, cells.length - 1);
            }
        });

        if (tableCount === 0) {
            const bodyRows = Math.max(0, rows.length - 2);
            tableCount = bodyRows;
        }

        total += tableCount;
    }

    return total;
}

function formatDatePt(date) {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

function cleanGameTitle(jogoData, fallbackTitle) {
    const fromNome = String(jogoData?.nome || '').trim();
    if (fromNome) return fromNome;
    const rawTitle = jogoData?.titulo || fallbackTitle || '';
    return String(rawTitle)
        .replace(/^Tradução:\s*/i, '')
        .replace(/\s*PT-PT\s*$/i, '')
        .trim() || fallbackTitle || '';
}

function buildWikiMetaDescription(metadataDescription, gameTitle) {
    const base = String(metadataDescription || '').trim();
    const suffix = `Tradução PT-PT disponível para ${gameTitle} no 100Nome.`;
    const combined = base ? `${base} ${suffix}` : suffix;
    return truncateText(combined, 170);
}

function getWikiPagePath(gameSlug, filename) {
    const base = `/wiki/${encodeURIComponent(gameSlug)}`;
    if (!filename || filename === 'index') return base;
    return `${base}/${encodeURIComponent(filename)}`;
}

function buildWikiPromoBanner(jogoSlug, gameTitle) {
    return `
        <section class="wiki-translation-banner">
            <div class="wiki-translation-banner-content">
                <p class="wiki-translation-banner-label"><i class="mdi mdi-translate"></i> Tradução PT-PT disponível</p>
                <p class="wiki-translation-banner-title">Joga <strong>${escapeHtml(gameTitle)}</strong> em português de Portugal</p>
                <p>Este guia faz parte da tradução oficial no 100Nome. Explora os conteúdos e descarrega a tradução completa.</p>
            </div>
            <div class="wiki-translation-banner-actions">
                <a href="/jogo/${encodeURIComponent(jogoSlug)}" class="wiki-cta-btn wiki-cta-btn--primary">
                    <i class="mdi mdi-download"></i> Descarregar Tradução
                </a>
                <a href="/jogo/${encodeURIComponent(jogoSlug)}#comentarios" class="wiki-cta-btn wiki-cta-btn--ghost">
                    <i class="mdi mdi-comment-text-outline"></i> Comentários
                </a>
            </div>
        </section>
    `;
}

function buildWikiTranslationStatus(jogoData, jogoSlug, gameTitle) {
    const version = String(jogoData?.packageVersion || jogoData?.versao || jogoData?.informacoesTraducao?.versao || '1.0').trim();
    const dateRaw = jogoData?.packageLastModified || jogoData?.dataPublicacao;
    const parsedDate = dateRaw ? new Date(dateRaw) : null;
    const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? formatDatePt(parsedDate) : 'n/d';

    return `
        <section class="wiki-translation-status">
            <h3 class="wiki-nav-title"><i class="mdi mdi-clipboard-check-outline"></i> Estado da tradução</h3>
            <ul class="wiki-status-list">
                <li><span>Versão</span><strong>v${escapeHtml(version)}</strong></li>
                <li><span>Última atualização</span><strong>${escapeHtml(date)}</strong></li>
            </ul>
            <a class="wiki-status-link" href="/jogo/${encodeURIComponent(jogoSlug)}">
                <i class="mdi mdi-open-in-new"></i> Abrir página da tradução
            </a>
        </section>
    `;
}

function injectWikiContentCta(html, jogoSlug, gameTitle) {
    const ctaHtml = `
<div class="wiki-inline-cta">
    <div class="wiki-inline-cta-content">
        <strong>Gostas de ${escapeHtml(gameTitle)}?</strong>
        <span>Podes jogar com tradução PT-PT completa.</span>
    </div>
    <a href="/jogo/${encodeURIComponent(jogoSlug)}" class="wiki-cta-btn wiki-cta-btn--primary">
        <i class="mdi mdi-download"></i> Descarregar
    </a>
</div>`;

    let injected = false;
    const withFirstH2 = html.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, (match) => {
        injected = true;
        return `${match}\n${ctaHtml}`;
    });

    if (injected) return withFirstH2;
    return `${ctaHtml}\n${html}`;
}

// Converter imagens em tabelas
function processTableImages(html) {
    return html.replace(/<td>([\s\S]*?)<\/td>/gi, (match, cellContent) => {
        // já é imagem
        if (cellContent.includes('<img')) {
            return match;
        }

        // tentar extrair URL de <a href="..."> ou de texto puro
        let url = null;
        const linkMatch = cellContent.match(/<a\s+[^>]*href="([^"]+)"[^>]*>/i);
        if (linkMatch && linkMatch[1]) {
            url = linkMatch[1].trim();
        } else {
            // remover tags e obter texto
            const text = cellContent.replace(/<[^>]+>/g, '').trim();
            if (text) {
                url = text;
            }
        }

        if (!url) return match;

        const isImage = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(url);
        const isUrlOrPath = /^(https?:\/\/|\.{1,2}\/|\/|data\/)/i.test(url);

        if (!isImage || !isUrlOrPath) return match;

        return `<td><img src="${url}" alt="Imagem" class="table-image" loading="lazy"></td>`;
    });
}

// Converter blockquotes em notas do tradutor
function convertBlockquotes(html) {
    return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (match, content) => {
        const introMatch = content.match(/^\s*(<p>)?\s*\[intro\]\s*/i);
        if (introMatch) {
            const cleaned = content
                .replace(/^\s*<p>\s*\[intro\]\s*/i, '')
                .replace(/^\s*\[intro\]\s*/i, '')
                .replace(/<\/p>\s*$/i, '');
            return `<p class="wiki-intro-text">${cleaned}</p>`;
        }
        // Verificar se tem nome do tradutor
        if (content.includes('<strong>') || content.includes('**')) {
            return `
                <div class="translator-note">
                    <div class="note-icon"><i class="mdi mdi-account-edit"></i></div>
                    <div class="note-content">${content}</div>
                </div>
            `;
        }
        return `<div class="info-box">${content}</div>`;
    });
}

// Processar markdown para HTML
function processMarkdown(content, wikiBasePath) {
    // Grelha de botões (tipo-markdown)
    content = convertButtonGrids(content);

    // Grupos de vídeos YouTube (tipo-markdown)
    content = convertYouTubeGroups(content);

    // YouTube (tipo-markdown)
    content = convertYouTubeEmbeds(content);

    // Destaques inline ==texto==
    content = content.replace(/==([^=\n]+)==/g, '<span class="highlight-note">$1</span>');

    // Configurar marked
    marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: true
    });
    
    let html = marked.parse(content);

    html = convertTableCaptions(html);

    // Converter headings com ícones e classes
    html = convertIconHeadings(html);

    // Converter tabelas com cabeçalho vertical
    html = convertVerticalHeaderTables(html);

    // Reescrever caminhos locais curtos (ex: imgs/...) para path absoluto da wiki
    if (wikiBasePath) {
        html = html.replace(/(src|href)=["'](imgs\/[^"']+)["']/gi, (match, attr, relPath) => {
            return `${attr}="${wikiBasePath}/${relPath}"`;
        });
        html = html.replace(/<td>\s*(imgs\/[^<\s]+)\s*<\/td>/gi, (match, relPath) => {
            return `<td>${wikiBasePath}/${relPath}</td>`;
        });
    }
    
    // Aplicar transformações
    html = convertTablesToHTML(html);
    html = processTableImages(html);
    html = convertBlockquotes(html);
    html = addExternalLinkAttributes(html);
    
    return html;
}

// Construir navegação da sidebar
function buildSidebarNav(gameSlug, currentPage, wikiPages) {
    const pages = [...wikiPages].sort((a, b) => (a.metadata.ordem || 999) - (b.metadata.ordem || 999));
    const indexPage = pages.find(page => page.filename === 'index');
    const contentPages = pages.filter(page => page.filename !== 'index');
    const hasCategories = contentPages.some(page => String(page.metadata.categoria || '').trim().length > 0);

    const renderNavItems = (pagesToRender) => pagesToRender.map(page => {
        const isActive = page.filename === currentPage;
        const icon = page.metadata.icone || 'file-document';
        const href = getWikiPagePath(gameSlug, page.filename);
        const label = page.metadata.titulo;

        return `
            <li class="wiki-nav-item ${isActive ? 'active' : ''}">
                <a href="${href}">
                    <i class="mdi mdi-${icon}"></i> ${label}
                </a>
            </li>
        `;
    }).join('');

    const groups = hasCategories
        ? (() => {
            const grouped = new Map();
            const groupMeta = new Map();

            contentPages.forEach(page => {
                const label = String(page.metadata.categoria || 'Conteúdos').trim() || 'Conteúdos';
                const categoryOrderRaw = Number(page.metadata.categoria_ordem);
                const categoryOrder = Number.isFinite(categoryOrderRaw) ? categoryOrderRaw : 999;
                const pageOrderRaw = Number(page.metadata.ordem);
                const pageOrder = Number.isFinite(pageOrderRaw) ? pageOrderRaw : 999;

                if (!grouped.has(label)) {
                    grouped.set(label, []);
                }
                grouped.get(label).push(page);

                if (!groupMeta.has(label)) {
                    groupMeta.set(label, { categoryOrder, firstPageOrder: pageOrder });
                } else {
                    const current = groupMeta.get(label);
                    current.categoryOrder = Math.min(current.categoryOrder, categoryOrder);
                    current.firstPageOrder = Math.min(current.firstPageOrder, pageOrder);
                }
            });

            return [...grouped.entries()]
                .sort((a, b) => {
                    const aMeta = groupMeta.get(a[0]);
                    const bMeta = groupMeta.get(b[0]);
                    if (aMeta.categoryOrder !== bMeta.categoryOrder) {
                        return aMeta.categoryOrder - bMeta.categoryOrder;
                    }
                    if (aMeta.firstPageOrder !== bMeta.firstPageOrder) {
                        return aMeta.firstPageOrder - bMeta.firstPageOrder;
                    }
                    return a[0].localeCompare(b[0], 'pt-PT');
                })
                .map(([label, groupedPages]) => ({ label, pages: groupedPages }));
        })()
        : [];

    const overviewHtml = indexPage
        ? (() => {
            const icon = indexPage.metadata.icone || 'information';
            const href = getWikiPagePath(gameSlug, 'index');
            const isActive = currentPage === 'index';
            return `
                <ul class="wiki-nav-list wiki-nav-list--overview">
                    <li class="wiki-nav-item ${isActive ? 'active' : ''}">
                        <a href="${href}">
                            <i class="mdi mdi-${icon}"></i> Visão Geral
                        </a>
                    </li>
                </ul>
            `;
        })()
        : '';

    const groupedNavHtml = groups
        .filter(group => group.pages.length > 0)
        .map(group => {
            const hasActive = group.pages.some(page => page.filename === currentPage);
            const itemsHtml = renderNavItems(group.pages);

            return `
                <section class="wiki-nav-group ${hasActive ? 'is-open' : ''}" data-nav-group>
                    <button type="button" class="wiki-nav-group-toggle" aria-expanded="${hasActive ? 'true' : 'false'}">
                        <span class="wiki-nav-group-title">${escapeHtml(group.label)}</span>
                        <span class="wiki-nav-group-count">${group.pages.length}</span>
                        <i class="mdi mdi-chevron-down" aria-hidden="true"></i>
                    </button>
                    <ul class="wiki-nav-list" ${hasActive ? '' : 'hidden'}>
                        ${itemsHtml}
                    </ul>
                </section>
            `;
        }).join('');

    const flatNavHtml = !hasCategories && contentPages.length
        ? `<ul class="wiki-nav-list wiki-nav-list--flat">${renderNavItems(contentPages)}</ul>`
        : '';

    return `${overviewHtml}${flatNavHtml}${groupedNavHtml}`;
}

function buildRelatedLinks(currentPage, wikiPages, gameSlug) {
    const pages = [...wikiPages].sort((a, b) => (a.metadata.ordem || 999) - (b.metadata.ordem || 999));
    const currentIndex = pages.findIndex(p => p.filename === currentPage);
    const links = [];

    const indexPage = pages.find(p => p.filename === 'index');
    if (indexPage && currentPage !== 'index') {
        links.push({ label: 'Visão Geral', href: getWikiPagePath(gameSlug, 'index') });
    }

    if (currentIndex > 0) {
        const prev = pages[currentIndex - 1];
        if (prev) {
            const href = getWikiPagePath(gameSlug, prev.filename);
            links.push({ label: `Anterior: ${prev.metadata.titulo || 'Página'}`, href });
        }
    }

    if (currentIndex >= 0 && currentIndex < pages.length - 1) {
        const next = pages[currentIndex + 1];
        if (next) {
            const href = getWikiPagePath(gameSlug, next.filename);
            links.push({ label: `Seguinte: ${next.metadata.titulo || 'Página'}`, href });
        }
    }

    if (!links.length) return '';

    const linksHtml = links.map(l => `<a class="wiki-related-link" href="${l.href}">${l.label}</a>`).join('');
    return `
        <div class="wiki-related">
            <h3 class="wiki-related-title"><i class="mdi mdi-link-variant"></i> Relacionado</h3>
            <div class="wiki-related-links">
                ${linksHtml}
            </div>
        </div>
    `;
}

function buildWikiHomeNavSectionMarkdown(wikiPages, limit = 6, hasGroupedSidebar = false) {
    const maxItems = Number.isFinite(limit) && limit > 0 ? limit : 6;
    const pages = [...wikiPages]
        .filter(page => page.filename !== 'index')
        .map(page => {
            const mode = String(page.metadata.home_nav || 'normal').trim().toLowerCase();
            const hidden = mode === 'hidden';
            const priority = mode === 'highlight' ? 0 : 1;
            const orderRaw = Number(page.metadata.home_nav_ordem);
            const homeOrder = Number.isFinite(orderRaw) ? orderRaw : (Number(page.metadata.ordem) || 999);
            return { page, hidden, priority, homeOrder };
        })
        .filter(item => !item.hidden)
        .sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            if (a.homeOrder !== b.homeOrder) return a.homeOrder - b.homeOrder;
            const aTitle = String(a.page.metadata.titulo || a.page.filename);
            const bTitle = String(b.page.metadata.titulo || b.page.filename);
            return aTitle.localeCompare(bTitle, 'pt-PT');
        })
        .slice(0, maxItems)
        .map(item => item.page);

    if (!pages.length) return '';

    const gridLines = pages.map(page => {
        const icon = page.metadata.icone || 'file-document';
        const title = String(page.metadata.titulo || page.filename).trim();
        return `- [icon:${icon}] ${title} (${page.filename})`;
    }).join('\n');

    const hintLine = hasGroupedSidebar
        ? '> Dica: para veres todas as categorias, usa "Mostrar tudo" na barra lateral.'
        : '> Dica: usa a pesquisa na barra lateral para encontrar páginas e termos mais depressa.';

    return [
        '## Explorar o Guia',
        '',
        ':::grid',
        gridLines,
        ':::',
        '',
        hintLine,
        ''
    ].join('\n');
}

function buildWikiUsageSectionMarkdown(hasGroupedSidebar = false) {
    const navigationLine = hasGroupedSidebar
        ? '2. Usa a barra lateral para navegar por categorias e o botão **Mostrar tudo** para abrir todas as secções.'
        : '2. Usa a barra lateral para navegar pelas páginas disponíveis.';

    return [
        '## Como usar este Guia',
        '',
        '1. Começa pela **Visão Geral** para entenderes a estrutura do guia.',
        navigationLine,
        '3. Usa a pesquisa do guia para encontrar termos, páginas e secções mais depressa.',
        '4. No fim das páginas, usa os links **Relacionados** para continuar a exploração.',
        '',
        '> Este guia é atualizado conforme a tradução evolui ou é melhorada. Se encontrares algo em falta, deixa sugestão nos comentários do jogo.',
        ''
    ].join('\n');
}

function stripManualWikiUsageSection(markdownContent) {
    return markdownContent
        .replace(/\n##\s+Como usar (?:esta Wiki|este Guia)[\s\S]*?(?=\n##\s+|\n#\s+|$)/i, '\n')
        .replace(/\n{3,}/g, '\n\n');
}

function injectWikiHomeNav(markdownContent, wikiPages, pageMetadata) {
    const withoutManualUsage = stripManualWikiUsageSection(markdownContent);
    if (!/:::\s*wiki-home-nav\s*:::/i.test(withoutManualUsage)) {
        return withoutManualUsage;
    }

    const configuredLimit = Number(pageMetadata?.home_nav_limite);
    const hasGroupedSidebar = wikiPages.some(page => page.filename !== 'index' && String(page.metadata?.categoria || '').trim().length > 0);
    const navSectionMarkdown = buildWikiHomeNavSectionMarkdown(wikiPages, configuredLimit, hasGroupedSidebar);
    return withoutManualUsage.replace(/:::\s*wiki-home-nav\s*:::/gi, navSectionMarkdown || '');
}

// Carregar template HTML
function loadTemplate() {
    const templatePath = path.join(__dirname, CONFIG.templateFile);
    return fs.readFileSync(templatePath, 'utf-8');
}

function loadPartial(name) {
    const partialPath = path.join(__dirname, '../templates/partials', name);
    return fs.readFileSync(partialPath, 'utf-8');
}

// Processar um ficheiro wiki
function processWikiFile(filePath, jogoId, gameSlug, allWikiPages, jogoData) {
    console.log(`📄 Processando: ${path.basename(filePath)}`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const { metadata, content: markdownContent } = parseFrontmatter(content);
    
    const filename = path.basename(filePath, '.wikimd');
    const isWikiHomePage = filename === 'index';
    let markdownForRender = isWikiHomePage
        ? injectWikiHomeNav(markdownContent, allWikiPages, metadata)
        : markdownContent;
    if (isWikiHomePage) {
        const usageHidden = String(metadata?.usage_hidden || '').trim().toLowerCase() === 'true';
        if (!usageHidden) {
            const hasGroupedSidebar = allWikiPages.some(page => page.filename !== 'index' && String(page.metadata?.categoria || '').trim().length > 0);
            markdownForRender = `${markdownForRender.trim()}\n\n${buildWikiUsageSectionMarkdown(hasGroupedSidebar)}`;
        }
    }

    // Converter markdown para HTML
    const wikiBasePath = `/data/wiki-content/${gameSlug}`;
    const htmlContent = processMarkdown(markdownForRender, wikiBasePath);
    const termCount = countTermsFromMarkdown(markdownContent);
    const updatedAt = formatDatePt(fs.statSync(filePath).mtime);
    
    // Carregar template e partials
    let template = loadTemplate();
    const header = loadPartial('header.html');
    const footer = loadPartial('footer.html');
    const favicon = loadPartial('favicon.html');
    
    // Construir navegação
    const sidebarNav = buildSidebarNav(gameSlug, filename, allWikiPages);
    const relatedLinks = buildRelatedLinks(filename, allWikiPages, gameSlug);
    const indexPage = allWikiPages.find(p => p.filename === 'index');
    const wikiHomeTitle = (indexPage?.metadata?.titulo || 'Guia').trim();
    
    // Substituir placeholders
    const fallbackTitle = jogoData?.titulo || jogoId.replace(/-/g, ' ').toUpperCase();
    const gameTitle = cleanGameTitle(jogoData, fallbackTitle);
    const jogoSlug = String(gameSlug || jogoData?.slug || jogoId).trim();
    const htmlContentWithCta = injectWikiContentCta(htmlContent, jogoSlug, gameTitle);
    const gameCover = jogoData?.capa ? `/${jogoData.capa.replace(/^\/+/, '')}` : '';
    const ogImage = gameCover ? `${SITE_URL}${gameCover}` : `${SITE_URL}/assets/images/site/logo.png`;
    const pageDescription = buildWikiMetaDescription(metadata.descricao, gameTitle);
    const promoBanner = buildWikiPromoBanner(jogoSlug, gameTitle);
    const translationStatus = buildWikiTranslationStatus(jogoData, jogoSlug, gameTitle);
    const pageUrl = `${SITE_URL}${getWikiPagePath(jogoSlug, filename)}`;
    const pageTitle = `${metadata.titulo || 'Guia'} - Guia ${gameTitle} - 100Nome`;
    const wikiJsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: metadata.titulo || 'Guia',
        description: pageDescription,
        inLanguage: 'pt-PT',
        url: pageUrl,
        image: ogImage,
        isPartOf: {
            '@type': 'WebSite',
            name: '100Nome Traduções',
            url: SITE_URL
        },
        about: {
            '@type': 'VideoGame',
            name: gameTitle
        },
        author: {
            '@type': 'Organization',
            name: '100Nome'
        }
    });

    const termoMeta = termCount > 0
        ? `<span><i class="mdi mdi-format-list-bulleted"></i> ${termCount} termos</span>`
        : '';
    const dataMeta = `<span><i class="mdi mdi-clock-outline"></i> Atualizado em ${updatedAt}</span>`;
    const wikiBreadcrumbNode = isWikiHomePage
        ? `<span class="breadcrumb-separator">/</span><span class="breadcrumb-current">${wikiHomeTitle}</span>`
        : `<span class="breadcrumb-separator">/</span><a href="${getWikiPagePath(jogoSlug, 'index')}" class="breadcrumb-link">${wikiHomeTitle}</a>`;
    const pageBreadcrumbNode = isWikiHomePage
        ? ''
        : `<span class="breadcrumb-separator">/</span><span class="breadcrumb-current">${metadata.titulo || 'Página'}</span>`;

    template = applyGlobalSiteLinks(template
        .replace(/\{\{WIKI_CSS_VERSION\}\}/g, ASSET_VERSIONS.wikiCss)
        .replace(/\{\{SITE_ANALYTICS_JS_VERSION\}\}/g, ASSET_VERSIONS.siteAnalyticsJs)
        .replace(/\{\{MOTION_JS_VERSION\}\}/g, ASSET_VERSIONS.motionJs)
        .replace(/\{\{SITE_SHELL_JS_VERSION\}\}/g, ASSET_VERSIONS.siteShellJs)
        .replace(/\{\{WIKI_PAGE_JS_VERSION\}\}/g, ASSET_VERSIONS.wikiPageJs)
        .replace(/\{\{FAVICON\}\}/g, favicon)
        .replace(/\{\{HEADER\}\}/g, header)
        .replace(/\{\{FOOTER\}\}/g, footer)
        .replace(/\{\{PAGE_TITLE\}\}/g, pageTitle)
        .replace(/\{\{TITULO\}\}/g, metadata.titulo || 'Guia')
        .replace(/\{\{DESCRICAO\}\}/g, pageDescription)
        .replace(/\{\{PAGE_URL\}\}/g, pageUrl)
        .replace(/\{\{OG_IMAGE\}\}/g, ogImage)
        .replace(/\{\{WIKI_JSON_LD\}\}/g, wikiJsonLd)
        .replace(/\{\{JOGO_NOME\}\}/g, gameTitle)
        .replace(/\{\{JOGO_SLUG\}\}/g, jogoSlug)
        .replace(/\{\{WIKI_BASE_PATH\}\}/g, getWikiPagePath(jogoSlug, 'index'))
        .replace(/\{\{CONTEUDO\}\}/g, htmlContentWithCta)
        .replace(/\{\{RELATED_LINKS\}\}/g, relatedLinks)
        .replace(/\{\{SIDEBAR_NAV\}\}/g, sidebarNav)
        .replace(/\{\{WIKI_TRANSLATION_BANNER\}\}/g, promoBanner)
        .replace(/\{\{WIKI_TRANSLATION_STATUS\}\}/g, translationStatus)
        .replace(/\{\{ICONE\}\}/g, metadata.icone || 'book')
        .replace(/\{\{PAGE_SUBTITLE\}\}/g, metadata.descricao || '')
        .replace(/\{\{TERMOS_META\}\}/g, termoMeta)
        .replace(/\{\{DATA_META\}\}/g, dataMeta)
        .replace(/\{\{JOGO_CAPA\}\}/g, gameCover)
        .replace(/\{\{JOGO_TITULO\}\}/g, gameTitle)
        .replace(/\{\{WIKI_BREADCRUMB_NODE\}\}/g, wikiBreadcrumbNode)
        .replace(/\{\{PAGE_BREADCRUMB_NODE\}\}/g, pageBreadcrumbNode));
    
    return {
        filename,
        html: template,
        metadata,
        markdown: markdownContent
    };
}

// Descobrir todos os ficheiros wiki de um jogo
function findWikiFiles(jogoId) {
    const wikiDir = path.join(__dirname, CONFIG.inputDir, jogoId);
    
    if (!fs.existsSync(wikiDir)) {
        console.log(`⚠️  Diretório não encontrado: ${wikiDir}`);
        return [];
    }
    
    return fs.readdirSync(wikiDir)
        .filter(file => file.endsWith('.wikimd'))
        .map(file => {
            const filePath = path.join(wikiDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const { metadata } = parseFrontmatter(content);
            
            return {
                filename: path.basename(file, '.wikimd'),
                filePath,
                metadata
            };
        });
}

// Processar todas as wikis de um jogo
function processGameWiki(jogoId, jogosData, packagesMap) {
    console.log(`\n🎮 Processando wiki: ${jogoId}`);
    
    // Descobrir todos os ficheiros
    const wikiFiles = findWikiFiles(jogoId);
    
    if (wikiFiles.length === 0) {
        console.log(`   Sem ficheiros wiki encontrados.`);
        return;
    }
    
    // Criar diretório de output
    const jogoDataRaw = jogosData?.jogos?.find(j => j.slug === jogoId);
    const gameSlug = String(jogoDataRaw?.slug || jogoId).trim();
    const jogoData = mergePackageMetadata(jogoDataRaw, gameSlug, packagesMap);
    const outputDir = path.join(__dirname, CONFIG.outputDir, `${gameSlug}`);
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const legacyOutputDir = path.join(__dirname, CONFIG.outputDir, `${jogoId}`);
    if (legacyOutputDir !== outputDir && fs.existsSync(legacyOutputDir)) {
        fs.rmSync(legacyOutputDir, { recursive: true, force: true });
    }

    // Processar cada ficheiro
    const searchIndex = [];

    wikiFiles.forEach(wikiFile => {
        const result = processWikiFile(wikiFile.filePath, jogoId, gameSlug, wikiFiles, jogoData);

        const outputPath = result.filename === 'index'
            ? path.join(outputDir, 'index.html')
            : path.join(outputDir, result.filename, 'index.html');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, result.html, 'utf-8');

        const headings = [];
        result.markdown.split('\n').forEach(line => {
            const match = line.match(/^(#{1,6})\s+(.*)$/);
            if (match) {
                const cleaned = match[2].replace(/\[icon:[^\]]+\]\s*/gi, '').trim();
                if (cleaned) headings.push(cleaned);
            }
        });

        const text = result.markdown
            // remover blocos especiais
            .replace(/:::.*?:::/gs, ' ')
            // remover fenced code
            .replace(/`{3}[\s\S]*?`{3}/g, ' ')
            // remover inline code
            .replace(/`[^`]*`/g, ' ')
            // manter apenas alt de imagens markdown
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
            // substituir links markdown pelo texto
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // remover tokens wiki
            .replace(/\[icon:[^\]]+\]/gi, ' ')
            .replace(/\[intro\]/gi, ' ')
            // remover paths de imagens (ex: imgs/...)
            .replace(/\bimgs\/[^\s)]+\b/gi, ' ')
            // remover HTML
            .replace(/<[^>]+>/g, ' ')
            // limpar tabelas markdown
            .replace(/\|/g, ' ')
            .replace(/^-{3,}$/gm, ' ')
            // remover restantes símbolos markdown
            .replace(/[#>*_\-=~^]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        searchIndex.push({
            title: result.metadata.titulo || result.filename,
            filename: getWikiPagePath(gameSlug, result.filename),
            headings,
            text
        });
        
        console.log(`   ✅ ${result.filename === 'index' ? 'index.html' : `${result.filename}/index.html`}`);
    });

    const searchIndexPath = path.join(outputDir, 'search-index.json');
    fs.writeFileSync(searchIndexPath, JSON.stringify(searchIndex, null, 2), 'utf-8');
    
    console.log(`   📦 ${wikiFiles.length} página(s) gerada(s)`);
}

// Main
function main() {
    console.log('🚀 Wiki Builder - 100Nome\n');
    
    // Carregar lista de jogos
    const jogosData = JSON.parse(
        fs.readFileSync(path.join(__dirname, CONFIG.dataFile), 'utf-8')
    );
    const packagesMap = readPackagesMetadata();
    
    // Processar wikis para cada jogo que tenha pasta de wiki
    const wikiDirs = fs.readdirSync(path.join(__dirname, CONFIG.inputDir))
        .filter(dir => {
            const fullPath = path.join(__dirname, CONFIG.inputDir, dir);
            return fs.statSync(fullPath).isDirectory();
        });
    
    wikiDirs.forEach(jogoId => {
        processGameWiki(jogoId, jogosData, packagesMap);
    });
    
    console.log('\n✨ Build concluído!\n');
}

// Executar
if (require.main === module) {
    main();
}

module.exports = { processGameWiki, processWikiFile };
