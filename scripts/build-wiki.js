#!/usr/bin/env node

/**
 * Build Script - Wiki Generator
 * Converte ficheiros .wikimd em páginas HTML completas
 * 
 * Uso: node build-wiki.js
 */

const fs = require('fs');
const path = require('path');
const marked = require('marked'); // npm install marked

// Configuração
const CONFIG = {
    inputDir: '../data/wiki-content',
    outputDir: '../wiki',
    templateFile: '../templates/wiki-page.html',
    dataFile: '../data/game-content/jogos.json'
};

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
    const tableRegex = /<table>([\s\S]*?)<\/table>/g;
    
    return html.replace(tableRegex, (match, tableContent) => {
        // Verificar se tem coluna de imagens
        const hasImages = tableContent.includes('<img') || tableContent.toLowerCase().includes('imagem');
        
        let classes = 'translation-table';
        if (hasImages) {
            classes += ' has-images';
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
function convertYouTubeEmbeds(markdown) {
    const ytRegex = /:::youtube\s+([\w-]+)\s*:::/gi;
    return markdown.replace(ytRegex, (match, videoId) => {
        return `
<div class="wiki-video">
  <iframe
    width="100%"
    height="400"
    src="https://www.youtube.com/embed/${videoId}"
    title="Vídeo YouTube"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen>
  </iframe>
</div>
`;
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

        return `<table>${newTableContent}</table>`;
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
    if (jogoData?.informacoesJogo?.nome) {
        return jogoData.informacoesJogo.nome;
    }

    let title = fallbackTitle || '';
    title = title.replace(/^tradu[cç][aã]o:\s*/i, '');
    title = title.replace(/\s*\((pt-pt|pt\/pt|pt pt)\)\s*/i, ' ');
    title = title.replace(/\s*(pt-pt|portugu[eê]s(?:\s*de\s*portugal)?|tuga)\s*$/i, '');
    return title.trim() || fallbackTitle || '';
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
    
    return html;
}

// Construir navegação da sidebar
function buildSidebarNav(jogoId, currentPage, wikiPages) {
    const pages = [...wikiPages]
        .sort((a, b) => (a.metadata.ordem || 999) - (b.metadata.ordem || 999))
        .map(page => {
            const isActive = page.filename === currentPage;
            const icon = page.metadata.icone || 'file-document';
            const isIndex = page.filename === 'index';
            const href = isIndex ? './' : `${page.filename}.html`;
            const label = isIndex ? 'Visão Geral' : page.metadata.titulo;
            
            return `
                <li class="wiki-nav-item ${isActive ? 'active' : ''}">
                    <a href="${href}">
                        <i class="mdi mdi-${icon}"></i> ${label}
                    </a>
                </li>
            `;
        }).join('');

    return pages;
}

function buildRelatedLinks(currentPage, wikiPages) {
    const pages = [...wikiPages].sort((a, b) => (a.metadata.ordem || 999) - (b.metadata.ordem || 999));
    const currentIndex = pages.findIndex(p => p.filename === currentPage);
    const links = [];

    const indexPage = pages.find(p => p.filename === 'index');
    if (indexPage && currentPage !== 'index') {
        links.push({ label: 'Visão Geral', href: './' });
    }

    if (currentIndex > 0) {
        const prev = pages[currentIndex - 1];
        if (prev) {
            const href = prev.filename === 'index' ? './' : `${prev.filename}.html`;
            links.push({ label: `Anterior: ${prev.metadata.titulo || 'Página'}`, href });
        }
    }

    if (currentIndex >= 0 && currentIndex < pages.length - 1) {
        const next = pages[currentIndex + 1];
        if (next) {
            const href = next.filename === 'index' ? './' : `${next.filename}.html`;
            links.push({ label: `Seguinte: ${next.metadata.titulo || 'Página'}`, href });
        }
    }

    if (!links.length) return '';

    const linksHtml = links.map(l => `<a href="${l.href}">${l.label}</a>`).join('');
    return `
        <div class="wiki-related">
            <h3 class="wiki-related-title"><i class="mdi mdi-link-variant"></i> Relacionado</h3>
            <div class="wiki-related-links">
                ${linksHtml}
            </div>
        </div>
    `;
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
function processWikiFile(filePath, jogoId, allWikiPages, jogoData) {
    console.log(`📄 Processando: ${path.basename(filePath)}`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const { metadata, content: markdownContent } = parseFrontmatter(content);
    
    // Converter markdown para HTML
    const wikiBasePath = `/data/wiki-content/${jogoId}`;
    const htmlContent = processMarkdown(markdownContent, wikiBasePath);
    const termCount = countTermsFromMarkdown(markdownContent);
    const updatedAt = formatDatePt(fs.statSync(filePath).mtime);
    
    // Carregar template e partials
    let template = loadTemplate();
    const header = loadPartial('header.html');
    const footer = loadPartial('footer.html');
    const favicon = loadPartial('favicon.html');
    
    // Construir navegação
    const filename = path.basename(filePath, '.wikimd');
    const sidebarNav = buildSidebarNav(jogoId, filename, allWikiPages);
    const relatedLinks = buildRelatedLinks(filename, allWikiPages);
    
    // Substituir placeholders
    const gameCover = jogoData?.capa ? `/${jogoData.capa.replace(/^\/+/, '')}` : '';
    const fallbackTitle = jogoData?.titulo || jogoId.replace(/-/g, ' ').toUpperCase();
    const gameTitle = cleanGameTitle(jogoData, fallbackTitle);

    const termoMeta = termCount > 0
        ? `<span><i class="mdi mdi-format-list-bulleted"></i> ${termCount} termos</span>`
        : '';
    const dataMeta = `<span><i class="mdi mdi-clock-outline"></i> Atualizado em ${updatedAt}</span>`;

    template = template
        .replace(/\{\{FAVICON\}\}/g, favicon)
        .replace(/\{\{HEADER\}\}/g, header)
        .replace(/\{\{FOOTER\}\}/g, footer)
        .replace(/\{\{TITULO\}\}/g, metadata.titulo || 'Wiki')
        .replace(/\{\{DESCRICAO\}\}/g, metadata.descricao || '')
        .replace(/\{\{JOGO_NOME\}\}/g, jogoId.replace(/-/g, ' ').toUpperCase())
        .replace(/\{\{JOGO_ID\}\}/g, jogoId)
        .replace(/\{\{CONTEUDO\}\}/g, htmlContent)
        .replace(/\{\{RELATED_LINKS\}\}/g, relatedLinks)
        .replace(/\{\{SIDEBAR_NAV\}\}/g, sidebarNav)
        .replace(/\{\{ICONE\}\}/g, metadata.icone || 'book')
        .replace(/\{\{PAGE_SUBTITLE\}\}/g, metadata.descricao || '')
        .replace(/\{\{TERMOS_META\}\}/g, termoMeta)
        .replace(/\{\{DATA_META\}\}/g, dataMeta)
        .replace(/\{\{JOGO_CAPA\}\}/g, gameCover)
        .replace(/\{\{JOGO_TITULO\}\}/g, gameTitle);
    
    return {
        filename: filename + '.html',
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
function processGameWiki(jogoId, jogosData) {
    console.log(`\n🎮 Processando wiki: ${jogoId}`);
    
    // Descobrir todos os ficheiros
    const wikiFiles = findWikiFiles(jogoId);
    
    if (wikiFiles.length === 0) {
        console.log(`   Sem ficheiros wiki encontrados.`);
        return;
    }
    
    // Criar diretório de output
    const outputDir = path.join(__dirname, CONFIG.outputDir, `${jogoId}`);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Processar cada ficheiro
    const jogoData = jogosData?.jogos?.find(j => j.guid === jogoId);
    const searchIndex = [];

    wikiFiles.forEach(wikiFile => {
        const result = processWikiFile(wikiFile.filePath, jogoId, wikiFiles, jogoData);
        
        const outputPath = path.join(outputDir, result.filename);
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
            title: result.metadata.titulo || result.filename.replace('.html', ''),
            filename: result.filename,
            headings,
            text
        });
        
        console.log(`   ✅ ${result.filename}`);
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
    
    // Processar wikis para cada jogo que tenha pasta de wiki
    const wikiDirs = fs.readdirSync(path.join(__dirname, CONFIG.inputDir))
        .filter(dir => {
            const fullPath = path.join(__dirname, CONFIG.inputDir, dir);
            return fs.statSync(fullPath).isDirectory();
        });
    
    wikiDirs.forEach(jogoId => {
        processGameWiki(jogoId, jogosData);
    });
    
    console.log('\n✨ Build concluído!\n');
}

// Executar
if (require.main === module) {
    main();
}

module.exports = { processGameWiki, processWikiFile };
