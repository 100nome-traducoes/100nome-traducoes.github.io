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
    templateFile: '../wiki/wiki-template.html',
    dataFile: '../data/jogos.json'
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

// Converter imagens em tabelas
function processTableImages(html) {
    return html.replace(/<td>(https:\/\/[^<]+\.(jpg|jpeg|png|gif))<\/td>/gi, (match, url) => {
        return `<td><img src="${url}" alt="Imagem" class="table-image" loading="lazy"></td>`;
    });
}

// Converter blockquotes em notas do tradutor
function convertBlockquotes(html) {
    return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (match, content) => {
        // Verificar se tem nome do tradutor
        if (content.includes('<strong>') || content.includes('**')) {
            return `
                <div class="translator-note">
                    <div class="note-icon"><i class="fas fa-user-edit"></i></div>
                    <div class="note-content">${content}</div>
                </div>
            `;
        }
        return `<div class="info-box">${content}</div>`;
    });
}

// Processar markdown para HTML
function processMarkdown(content) {
    // Configurar marked
    marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: true
    });
    
    let html = marked.parse(content);
    
    // Aplicar transformações
    html = convertTablesToHTML(html);
    html = processTableImages(html);
    html = convertBlockquotes(html);
    
    return html;
}

// Construir navegação da sidebar
function buildSidebarNav(jogoId, currentPage, wikiPages) {
    const pages = wikiPages
        .sort((a, b) => (a.metadata.ordem || 999) - (b.metadata.ordem || 999))
        .map(page => {
            const isActive = page.filename === currentPage;
            const icon = page.metadata.icone || 'file-alt';
            const isIndex = page.filename === 'index';
            const href = isIndex ? './' : `${page.filename}.html`;
            const label = isIndex ? 'Visão Geral' : page.metadata.titulo;
            
            return `
                <li class="wiki-nav-item ${isActive ? 'active' : ''}">
                    <a href="${href}">
                        <i class="fas fa-${icon}"></i> ${label}
                    </a>
                </li>
            `;
        }).join('');

    return pages;
}

// Carregar template HTML
function loadTemplate() {
    const templatePath = path.join(__dirname, CONFIG.templateFile);
    return fs.readFileSync(templatePath, 'utf-8');
}

// Processar um ficheiro wiki
function processWikiFile(filePath, jogoId, allWikiPages) {
    console.log(`📄 Processando: ${path.basename(filePath)}`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const { metadata, content: markdownContent } = parseFrontmatter(content);
    
    // Converter markdown para HTML
    const htmlContent = processMarkdown(markdownContent);
    
    // Carregar template
    let template = loadTemplate();
    
    // Construir navegação
    const filename = path.basename(filePath, '.wikimd');
    const sidebarNav = buildSidebarNav(jogoId, filename, allWikiPages);
    
    // Substituir placeholders
    template = template
        .replace(/\{\{TITULO\}\}/g, metadata.titulo || 'Wiki')
        .replace(/\{\{DESCRICAO\}\}/g, metadata.descricao || '')
        .replace(/\{\{JOGO_NOME\}\}/g, jogoId.replace(/-/g, ' ').toUpperCase())
        .replace(/\{\{JOGO_ID\}\}/g, jogoId)
        .replace(/\{\{CONTEUDO\}\}/g, htmlContent)
        .replace(/\{\{SIDEBAR_NAV\}\}/g, sidebarNav)
        .replace(/\{\{ICONE\}\}/g, metadata.icone || 'book');
    
    return {
        filename: filename + '.html',
        html: template,
        metadata
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
function processGameWiki(jogoId) {
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
    wikiFiles.forEach(wikiFile => {
        const result = processWikiFile(wikiFile.filePath, jogoId, wikiFiles);
        
        const outputPath = path.join(outputDir, result.filename);
        fs.writeFileSync(outputPath, result.html, 'utf-8');
        
        console.log(`   ✅ ${result.filename}`);
    });
    
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
        processGameWiki(jogoId);
    });
    
    console.log('\n✨ Build concluído!\n');
}

// Executar
if (require.main === module) {
    main();
}

module.exports = { processGameWiki, processWikiFile };
