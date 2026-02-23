$(document).ready(function() {
    const track = (eventName, params = {}) => {
        if (window.SiteAnalytics && typeof window.SiteAnalytics.track === 'function') {
            window.SiteAnalytics.track(eventName, params);
        }
    };

    function splitList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
        return String(value).split(/[,;]+/).map(v => v.trim()).filter(Boolean);
    }

    function hydrateGameData(jogo) {
        const game = { ...jogo };
        const infoJogo = game.informacoesJogo || {};
        const infoTraducao = game.informacoesTraducao || {};

        game.dataPublicacao = game.dataPublicacao || '';
        game.packageLastModified = game.packageLastModified || '';
        game.downloads = Number.isFinite(Number(game.downloads)) ? Number(game.downloads) : 0;
        game.informacoesJogo = {
            nome: game.nome || infoJogo.nome || '',
            nomeOriginal: game.nome_original || infoJogo.nomeOriginal || '',
            criadoPor: game.criador || infoJogo.criadoPor || ''
        };

        const autores = Array.isArray(game.autores) ? game.autores : [];
        const tradutoresFallback = autores
            .filter(a => /tradu/i.test(String(a.papel || '')))
            .map(a => a.nome)
            .join(', ');
        const revisoresFallback = autores
            .filter(a => /revis/i.test(String(a.papel || '')))
            .map(a => a.nome)
            .join(', ');

        game.informacoesTraducao = {
            versao: game.versao || infoTraducao.versao || '1.0',
            fornecidaPor: game.fornecido_por || infoTraducao.fornecidaPor || '100Nome',
            tradutores: infoTraducao.tradutores || tradutoresFallback || '',
            revisores: infoTraducao.revisores || revisoresFallback || '',
            atributos: game.atributos || infoTraducao.atributos || []
        };

        game.notas = Array.isArray(game.notas) ? game.notas : splitList(game.notas);
        game.categorias = Array.isArray(game.categorias) ? game.categorias : [];
        game.tradutorDescricao = game.tradutorDescricao || game.informacoesTraducao.fornecidaPor;
        game.slug = String(game.slug || '').trim();

        return game;
    }

    // Elementos DOM
    const $featuredGrid = $('#featuredGrid');
    const $categoriesContainer = $('#categoriesContainer');
    const $loadingIndicator = $('#loadingIndicator');
    const $backToTop = $('#backToTop');
    const $menuToggle = $('#menuToggle');
    const $mobileMenu = $('#mobileMenu');
    const $mobileCategories = $('#mobileCategories');
    const $mobileSubmenu = $('#mobileSubmenu');
    const $totalJogos = $('#totalJogos');
    const $totalCategorias = $('#totalCategorias');
    const $searchForm = $('#search-form');
    const $searchInput = $('#search-input');
    const $heroMetricTotal = $('#heroMetricTotal');
    const $heroMetricDownloads = $('#heroMetricDownloads');
    const $heroMetricGuides = $('#heroMetricGuides');
    const $heroLastUpdateMini = $('#heroLastUpdateMini');
    const $heroLiveTicker = $('#heroLiveTicker');

    // Dados globais
    let dadosJogos = {
        destaques: [],
        jogos: [],
        categoriasPrincipais: []
    };

    // Cache para procurar jogos rapidamente
    let jogosPorSlug = {};
    let todasCategorias = new Set();
    let destaqueSlugsEfetivos = new Set();
    let currentView = 'carousel';
    let isCarouselDragging = false;
    let heroTickerTimer = null;
    let heroTickerIndex = 0;
    const initialQuery = new URLSearchParams(window.location.search).get('q');
    const initialHash = window.location.hash;
    const categoryHashes = ['#acao', '#misterio', '#quebracabecas', '#corrida', '#estrategia'];

    // Inicialização
    function init() {
        setupEventListeners();
        carregarDadosJSON();
    }

    // Carregar dados do JSON
    function carregarDadosJSON() {
        $loadingIndicator.show();

        const embeddedDataEl = document.getElementById('homeData');
        if (embeddedDataEl && embeddedDataEl.textContent.trim()) {
            try {
                const data = JSON.parse(embeddedDataEl.textContent);
                processarDadosRecebidos(data);
                carregarDestaques();
                atualizarEstatisticas();
                atualizarHeroAtividade();
                track('view_home', {
                    total_translations: dadosJogos.jogos.length,
                    total_categories: todasCategorias.size
                });

                const savedView = localStorage.getItem('viewMode');
                aplicarVista(savedView || 'carousel');

                if (initialQuery) {
                    $searchInput.val(initialQuery);
                    $('#mobile-search-input').val(initialQuery);
                    pesquisarTraducoes(initialQuery);
                } else if (initialHash && categoryHashes.includes(initialHash)) {
                    if (currentView === 'grid') {
                        carregarGrelhaPorCategoria(initialHash.replace('#', ''));
                        setTimeout(() => {
                            const targetTop = $categoriesContainer.offset()?.top;
                            if (typeof targetTop === 'number') {
                                $('html, body').animate({ scrollTop: targetTop - 80 }, 600);
                            }
                        }, 50);
                    } else {
                        setTimeout(() => {
                            const target = $(initialHash);
                            if (target.length) {
                                $('html, body').animate({ scrollTop: target.offset().top - 80 }, 600);
                            }
                        }, 50);
                    }
                }

                $loadingIndicator.hide();
                return;
            } catch (e) {
                console.warn('Falha ao ler homeData embutido.', e);
            }
        }

        mostrarErroCarregamento();
    }

    // Processar dados recebidos
    function processarDadosRecebidos(data) {
        dadosJogos = {
            ...data,
            jogos: (data.jogos || []).map(hydrateGameData).filter(jogo => jogo.slug)
        };

        const slugsValidos = new Set(dadosJogos.jogos.map(jogo => jogo.slug));
        dadosJogos.destaques = (data.destaques || [])
            .map(v => String(v || '').trim())
            .filter(slug => slugsValidos.has(slug));

        // Criar cache para procura rápida
        jogosPorSlug = {};
        todasCategorias.clear();

        dadosJogos.jogos.forEach(jogo => {
            if (jogo.slug) {
                jogosPorSlug[jogo.slug] = jogo;
            }

            // Coletar todas as categorias únicas
            jogo.categorias.forEach(categoria => {
                if (!categoria.includes('português') && !categoria.includes('pt-pt') &&
                    !categoria.includes('traduções') && !categoria.includes('jogo')) {
                    todasCategorias.add(categoria);
                    }
            });
        });
    }

    // Atualizar estatísticas no hero
    function atualizarEstatisticas() {
        $totalJogos.text(dadosJogos.jogos.length);
        $totalCategorias.text(todasCategorias.size);
    }

    function atualizarHeroAtividade() {
        if (!$heroLiveTicker.length || !dadosJogos.jogos.length) return;

        const jogosOrdenados = [...dadosJogos.jogos]
            .filter(j => obterDataAtividade(j))
            .sort((a, b) => new Date(obterDataAtividade(b)) - new Date(obterDataAtividade(a)));

        if (!jogosOrdenados.length) return;

        const jogoAtividadeRecente = jogosOrdenados[0];
        const totalDownloads = Number(dadosJogos?.stats?.totalDownloads) || 0;
        const totalGuias = dadosJogos.jogos.filter(jogo => String(jogo.guideLink || '').trim()).length;
        const dataAtividadeRecente = dadosJogos?.stats?.latestPackageUpdate || obterDataAtividade(jogoAtividadeRecente);

        $heroMetricTotal.text(dadosJogos.jogos.length);
        $heroMetricDownloads.text(formatarNumero(totalDownloads));
        $heroMetricGuides.text(formatarNumero(totalGuias));
        $heroLastUpdateMini.text(`Último pacote atualizado: ${formatarData(dataAtividadeRecente)}`);

        const tituloRecente = limparTitulo(jogoAtividadeRecente.titulo);
        const mensagens = [
            `Último pacote atualizado: <a href="jogo/${jogoAtividadeRecente.slug}">${tituloRecente}</a>.`,
            `${formatarNumero(totalDownloads)} descargas totais no projeto.`,
            `${totalGuias} traduções já têm <a href="#destaques">guia de termos</a> para consulta rápida.`,
            `Encontraste um erro? Deixa comentário na página do jogo.`,
            `Consulta o guia da tradução para termos e notas.`,
            `No <a href="https://discord.gg/Xv7ax2VkEp" target="_blank" rel="noopener noreferrer">Discord</a> recebes avisos de novas traduções.`,
            `No Discord podes encontrar jogadores, tradutores e apoio.`,
            `Sugere a próxima tradução no Discord.`
        ];

        iniciarHeroTicker(mensagens);
    }

    function iniciarHeroTicker(mensagens) {
        if (!$heroLiveTicker.length) return;

        if (heroTickerTimer) {
            clearInterval(heroTickerTimer);
            heroTickerTimer = null;
        }

        const validas = (mensagens || []).filter(Boolean);
        if (!validas.length) return;

        heroTickerIndex = 0;

        const render = () => {
            $heroLiveTicker.removeClass('is-visible');
            window.setTimeout(() => {
                $heroLiveTicker.html(validas[heroTickerIndex]);
                $heroLiveTicker.addClass('is-visible');
                heroTickerIndex = (heroTickerIndex + 1) % validas.length;
            }, 120);
        };

        render();

        if (validas.length > 1) {
            heroTickerTimer = window.setInterval(render, 5600);
        }
    }

    function getCardPlacement($card) {
        if ($card.closest('#featuredGrid').length) return 'featured';
        if ($card.closest('.search-results').length) return 'search';
        return currentView === 'grid' ? 'grid' : 'carousel';
    }

    // Carregar jogos em destaque
    function carregarDestaques() {
        $featuredGrid.empty();

        let jogosDestaque = [];
        const slugsSelecionados = new Set();

        // Tentar usar destaques manuais primeiro
        if (dadosJogos.destaques && dadosJogos.destaques.length > 0) {
            jogosDestaque = dadosJogos.destaques
                .map(slug => jogosPorSlug[slug])
                .filter(jogo => jogo)
                .slice(0, 3);
            jogosDestaque.forEach(jogo => slugsSelecionados.add(jogo.slug));
        }

        // Se não houver destaques manuais suficientes, descobrir automaticamente
        if (jogosDestaque.length < 3) {
            const jogosAutomaticos = descobrirDestaquesAutomaticos(3 - jogosDestaque.length, slugsSelecionados);
            jogosDestaque = [...jogosDestaque, ...jogosAutomaticos];
            jogosAutomaticos.forEach(jogo => slugsSelecionados.add(jogo.slug));
        }

        destaqueSlugsEfetivos = new Set(jogosDestaque.map(jogo => jogo.slug));

        if (jogosDestaque.length === 0) {
            $featuredGrid.html(`
            <div class="no-data">
            <i class="fas fa-star"></i>
            <p>Sem jogos disponíveis no momento.</p>
            </div>
            `);
            return;
        }

        jogosDestaque.forEach(jogo => {
            const jogoCard = criarCardDestaque(jogo);
            $featuredGrid.append(jogoCard);
        });
    }

    // Descobrir destaques automaticamente baseado em critérios inteligentes
    function descobrirDestaquesAutomaticos(quantidade = 3, slugsExcluidos = new Set()) {
        const candidatos = dadosJogos.jogos.filter(jogo => jogo?.slug && !slugsExcluidos.has(jogo.slug));
        if (!candidatos.length) return [];

        const downloadsValores = candidatos
            .map(jogo => Number(jogo.downloads) || 0)
            .sort((a, b) => a - b);
        const p95 = calcularPercentil(downloadsValores, 95) || 1;
        const maxLogDownloads = Math.log1p(p95);

        const jogosComScore = candidatos.map((jogo) => {
            const dataAtividade = obterDataAtividade(jogo);
            const ts = new Date(dataAtividade).getTime();
            const dias = Number.isFinite(ts) ? Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24)) : 3650;

            // Recência com decaimento suave (meia-vida ~ 18 meses)
            const recencia = Math.exp(-dias / 540);

            // Qualidade editorial da ficha
            const versao = parseFloat(jogo.informacoesTraducao?.versao || '1.0');
            const qualidade = limitar(
                (jogo.descricao?.length > 100 ? 0.24 : 0.1) +
                (jogo.informacoesJogo?.nome ? 0.14 : 0) +
                (jogo.informacoesJogo?.criadoPor ? 0.12 : 0) +
                (jogo.tradutorDescricao ? 0.12 : 0) +
                ((jogo.notas?.length || 0) > 0 ? 0.1 : 0) +
                (String(jogo.guideLink || '').trim() ? 0.12 : 0) +
                limitar((versao - 1) / 3) * 0.16,
                0,
                1
            );

            // Popularidade com proteção anti-monopólio
            const downloadsCap = Math.min(Number(jogo.downloads) || 0, p95);
            const popularidade = maxLogDownloads > 0 ? (Math.log1p(downloadsCap) / maxLogDownloads) : 0;

            const score = (0.45 * recencia) + (0.35 * qualidade) + (0.20 * popularidade);
            return {
                jogo,
                score: Math.max(score, 0.01)
            };
        }).sort((a, b) => b.score - a.score);

        const escolhidos = [];
        const usados = new Set();
        const categoriasUsadas = new Set();
        const seedDia = new Date().toISOString().slice(0, 10);
        const seedExcluidos = Array.from(slugsExcluidos).sort().join('|');
        const rng = criarRngDeterministico(`${seedDia}|${quantidade}|${seedExcluidos}`);

        while (escolhidos.length < quantidade && usados.size < jogosComScore.length) {
            let pool = jogosComScore.filter(item => !usados.has(item.jogo.slug));
            const semCategoriaRepetida = pool.filter(item => {
                const cat = (item.jogo.categorias || [])[0] || '';
                return !cat || !categoriasUsadas.has(cat);
            });

            if (semCategoriaRepetida.length > 0 && (quantidade - escolhidos.length) > 1) {
                pool = semCategoriaRepetida;
            }

            const escolhido = selecionarPonderado(pool, rng);
            if (!escolhido) break;

            escolhidos.push(escolhido.jogo);
            usados.add(escolhido.jogo.slug);
            const catPrincipal = (escolhido.jogo.categorias || [])[0] || '';
            if (catPrincipal) categoriasUsadas.add(catPrincipal);
        }

        return escolhidos;
    }

    // Descobrir jogos relacionados baseado em similaridade
    function descobrirJogosRelacionados(jogoAtual, quantidade = 4) {
        if (!jogoAtual) return [];

        const jogosComSimilaridade = dadosJogos.jogos
            .filter(jogo => jogo.slug !== jogoAtual.slug) // Excluir o jogo atual
            .map(jogo => {
                let similaridade = 0;

                // 1. Categorias em comum (peso maior)
                const categoriasComum = jogo.categorias.filter(cat => 
                    jogoAtual.categorias.includes(cat)
                ).length;
                similaridade += categoriasComum * 20;

                // 2. Mesmo tradutor
                if (jogo.tradutorDescricao === jogoAtual.tradutorDescricao) {
                    similaridade += 15;
                }

                // 3. Mesmo criador do jogo
                if (jogo.informacoesJogo?.criadoPor === jogoAtual.informacoesJogo?.criadoPor) {
                    similaridade += 25;
                }

                // 4. Pequeno bónus para jogos mais recentes
                const diasDesdePublicacao = Math.floor(
                    (new Date() - new Date(jogo.dataPublicacao)) / (1000 * 60 * 60 * 24)
                );
                if (diasDesdePublicacao <= 90) {
                    similaridade += 5;
                }

                return {
                    jogo: jogo,
                    similaridade: similaridade
                };
            });

        // Ordenar por similaridade e pegar os melhores
        return jogosComSimilaridade
            .sort((a, b) => b.similaridade - a.similaridade)
            .slice(0, quantidade)
            .map(item => item.jogo);
    }

    // Expor funções globalmente para uso em páginas de jogos individuais
    window.descobrirJogosRelacionados = descobrirJogosRelacionados;
    window.jogosPorSlug = jogosPorSlug;

    // Criar card de destaque
    function criarCardDestaque(jogo) {
        const categoriasBadges = extrairCategoriasPrincipais(jogo.categorias);
        const descricaoCurta = truncarTexto(jogo.descricao, 120);

        const linkJogo = `jogo/${jogo.slug}`;

        return `
        <div class="featured-card" data-game-id="${jogo.slug}" data-link="${linkJogo}">
        <div class="featured-badge">
        <i class="fas fa-star"></i> Destaque
        </div>
        <img src="${jogo.capa}" alt="${limparTitulo(jogo.titulo)} - Tradução PT-PT - 100Nome" class="featured-image" loading="lazy">
        <div class="featured-content">
        <div class="featured-categories">
        ${categoriasBadges.map(cat =>
            `<span class="category-badge">${cat}</span>`
        ).join('')}
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

    // Carregar categorias estilo Netflix
    function carregarCategorias() {
        $categoriesContainer.empty();

        if (!dadosJogos.categoriasPrincipais || dadosJogos.categoriasPrincipais.length === 0) {
            $categoriesContainer.html(`
            <div class="no-data">
            <i class="fas fa-th-large"></i>
            <p>Sem categorias disponíveis.</p>
            </div>
            `);
            return;
        }

        // Para cada categoria principal, obter jogos que tenham pelo menos uma das tags
        dadosJogos.categoriasPrincipais.forEach(categoria => {
            const jogosDaCategoria = filtrarJogosPorCategoria(categoria);

            if (jogosDaCategoria.length > 0) {
                const categoriaSection = criarSecaoCategoria(categoria, jogosDaCategoria);
                $categoriesContainer.append(categoriaSection);
            }
        });

        // Reconfigurar navegação dos carrosseis
        setTimeout(configurarNavegacaoCarrossel, 100);
    }

    // Carregar grelha com todos os jogos por ordem de novidade
    function carregarGrelha() {
        $categoriesContainer.empty();

        if (!dadosJogos.jogos || dadosJogos.jogos.length === 0) {
            $categoriesContainer.html(`
            <div class="no-data">
            <i class="fas fa-th-large"></i>
            <p>Sem jogos disponíveis.</p>
            </div>
            `);
            return;
        }

        const jogosOrdenados = [...dadosJogos.jogos].sort((a, b) => {
            return new Date(b.dataPublicacao) - new Date(a.dataPublicacao);
        });

        const jogosHTML = jogosOrdenados.map(jogo => criarCardJogo(jogo)).join('');

        $categoriesContainer.html(`
        <div class="search-results all-games-grid">
        <div class="search-header">
        <h3><i class="fas fa-th"></i> Todas as traduções (${jogosOrdenados.length})</h3>
        </div>
        <div class="search-grid">
        ${jogosHTML}
        </div>
        </div>
        `);
    }

    function carregarGrelhaPorCategoria(categoriaId) {
        $categoriesContainer.empty();

        const categoria = (dadosJogos.categoriasPrincipais || []).find(cat => cat.id === categoriaId);
        if (!categoria) {
            carregarGrelha();
            return;
        }

        const jogosFiltrados = filtrarJogosPorCategoria(categoria).sort((a, b) => {
            return new Date(b.dataPublicacao) - new Date(a.dataPublicacao);
        });

        const categoriaIcone = getCategoriaIcone(categoria.id);

        if (jogosFiltrados.length === 0) {
            $categoriesContainer.html(`
            <div class="search-results">
            <div class="search-header">
            <h3><i class="fas fa-${categoriaIcone}"></i> ${categoria.nome} (0)</h3>
            <button class="nav-btn" id="clearCategory" title="Limpar filtro">
            <i class="fas fa-times"></i>
            </button>
            </div>
            <p class="no-data">Sem jogos disponíveis nesta categoria.</p>
            </div>
            `);
        } else {
            const jogosHTML = jogosFiltrados.map(jogo => criarCardJogo(jogo)).join('');
            $categoriesContainer.html(`
            <div class="search-results category-grid">
            <div class="search-header">
            <h3><i class="fas fa-${categoriaIcone}"></i> ${categoria.nome} (${jogosFiltrados.length})</h3>
            <button class="nav-btn" id="clearCategory" title="Limpar filtro">
            <i class="fas fa-times"></i>
            </button>
            </div>
            <div class="search-grid">
            ${jogosHTML}
            </div>
            </div>
            `);
        }

        $('#clearCategory').on('click', function() {
            aplicarVista('grid');
        });
    }

    // Filtrar jogos por categoria (baseado em tags)
    function filtrarJogosPorCategoria(categoria) {
        return dadosJogos.jogos.filter(jogo => {
            // Verificar se o jogo tem pelo menos uma das tags da categoria
            return categoria.tags.some(tag =>
            jogo.categorias.includes(tag)
            );
        }).sort((a, b) => {
            // Ordenar por data de publicação (mais recente primeiro)
            return new Date(b.dataPublicacao) - new Date(a.dataPublicacao);
        });
    }

    // Criar seção de categoria
    function criarSecaoCategoria(categoria, jogos) {
        const categoriaId = `carousel-${categoria.id}`;
        const jogosHTML = jogos.map(jogo => criarCardJogo(jogo)).join('');

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

    // Criar card de jogo individual
    function criarCardJogo(jogo) {
        const isDestaque = destaqueSlugsEfetivos.has(jogo.slug);
        const categoriasTags = extrairCategoriasPrincipais(jogo.categorias).slice(0, 2);
        const descricaoCurta = truncarTexto(jogo.descricao, 90);
        const dataFormatada = formatarData(jogo.dataPublicacao);

        const linkJogo = `jogo/${jogo.slug}`;

        // Verificar se é novo (menos de 30 dias)
        const diasDesdePublicacao = Math.floor(
            (new Date() - new Date(jogo.dataPublicacao)) / (1000 * 60 * 60 * 24)
        );
        const isNovo = diasDesdePublicacao <= 30;

        return `
        <div class="game-card" data-game-id="${jogo.slug}" data-link="${linkJogo}">
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
        ${categoriasTags.map(cat =>
            `<span class="category-tag">${cat}</span>`
        ).join('')}
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

    // Funções auxiliares
    function extrairCategoriasPrincipais(categorias) {
        const categoriasMap = {
            'acao': 'Ação',
            'misterio': 'Mistério',
            'quebracabecas': 'Quebra-cabeças',
            'corrida': 'Corrida',
            'estrategia': 'Estratégia',
            'aventura': 'Aventura',
            'rpg': 'RPG',
            'simulacao': 'Simulação',
            'objetosescondidos': 'Objetos Escondidos',
            'indie': 'Indie',
            'mundoaberto': 'Mundo Aberto',
            'plataforma': 'Plataforma',
            'terror': 'Terror',
            'fisica': 'Física',
            'tabuleiro': 'Tabuleiro',
            'opensource': 'Open Source',
            'português-portugal': 'PT-PT',
            'pt-pt': 'Português',
            'jogo': 'Jogo',
            'traduções': 'Tradução'
        };

        return categorias
        .map(cat => categoriasMap[cat] || cat)
        .filter(cat => cat && !['Jogo', 'Tradução', 'PT-PT', 'Português'].includes(cat))
        .slice(0, 3);
    }

    function limparTitulo(titulo) {
        return titulo
        .replace(/^Tradução:\s*/i, '')
        .replace(/\s*PT-PT$/i, '')
        .trim();
    }

    function truncarTexto(texto, maxLength) {
        if (!texto) return '';
        if (texto.length <= maxLength) return texto;
        return texto.substring(0, maxLength).trim() + '...';
    }

    function limitar(valor, min = 0, max = 1) {
        return Math.max(min, Math.min(max, Number(valor) || 0));
    }

    function calcularPercentil(valoresOrdenados, percentil) {
        if (!Array.isArray(valoresOrdenados) || valoresOrdenados.length === 0) return 0;
        const p = limitar(percentil / 100, 0, 1);
        const idx = Math.floor((valoresOrdenados.length - 1) * p);
        return Number(valoresOrdenados[idx]) || 0;
    }

    function criarRngDeterministico(seedTexto) {
        let h = 2166136261 >>> 0;
        const texto = String(seedTexto || '');
        for (let i = 0; i < texto.length; i++) {
            h ^= texto.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return function rng() {
            h += 0x6D2B79F5;
            let t = h;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function selecionarPonderado(itens, rng) {
        if (!Array.isArray(itens) || itens.length === 0) return null;
        const total = itens.reduce((acc, item) => acc + Math.max(0, Number(item.score) || 0), 0);
        if (total <= 0) return itens[0];

        let alvo = rng() * total;
        for (const item of itens) {
            alvo -= Math.max(0, Number(item.score) || 0);
            if (alvo <= 0) return item;
        }
        return itens[itens.length - 1];
    }

    function obterDataAtividade(jogo) {
        return jogo?.packageLastModified || jogo?.dataPublicacao || '';
    }

    function formatarNumero(numero) {
        return Number(numero || 0).toLocaleString('pt-PT');
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

    function getCategoriaIcone(categoriaId) {
        const icones = {
            'acao': 'fist-raised',
            'misterio': 'search',
            'corrida': 'car',
            'estrategia': 'chess-board',
            'quebracabecas': 'puzzle-piece',
            'aventura': 'hiking',
            'rpg': 'dragon',
            'simulacao': 'cogs',
            'objetosescondidos': 'binoculars'
        };
        return icones[categoriaId] || 'gamepad';
    }

    // Configurar navegação dos carrosseis
    function configurarNavegacaoCarrossel() {
        $('.nav-btn').off('click').on('click', function() {
            const $btn = $(this);
            const carouselId = $btn.data('carousel');
            const $carousel = $(`#${carouselId}`);
            const isNext = $btn.hasClass('next');
            const cardWidth = $carousel.find('.game-card').outerWidth(true) || 280;
            const scrollAmount = cardWidth * 3;

            if (isNext) {
                $carousel.animate({
                    scrollLeft: `+=${scrollAmount}`
                }, 300);
            } else {
                $carousel.animate({
                    scrollLeft: `-=${scrollAmount}`
                }, 300);
            }
        });

        // Scroll horizontal no carrossel: só captura quando for intenção horizontal
        $('.carousel-track').off('wheel.carousel').on('wheel.carousel', function(e) {
            const deltaX = e.originalEvent.deltaX || 0;
            const deltaY = e.originalEvent.deltaY || 0;
            const isHorizontalIntent = Math.abs(deltaX) > Math.abs(deltaY);
            const isShiftScroll = e.originalEvent.shiftKey && Math.abs(deltaY) > 0;

            if (isHorizontalIntent || isShiftScroll) {
                e.preventDefault();
                const scrollAmount = isShiftScroll ? deltaY : deltaX;
                $(this).scrollLeft($(this).scrollLeft() + scrollAmount);
            }
        });

        // Drag-to-scroll (mouse e touch)
        $('.carousel-track')
            .off('mousedown.carouselDrag touchstart.carouselDrag')
            .on('mousedown.carouselDrag touchstart.carouselDrag', function(e) {
                const isTouch = e.type === 'touchstart';
                const point = isTouch ? e.originalEvent.touches[0] : e;

                $(this).data('drag', {
                    active: true,
                    startX: point.pageX,
                    startY: point.pageY,
                    scrollLeft: $(this).scrollLeft(),
                    hasDragged: false
                });

                $(this).addClass('is-dragging');
            });

        $('.carousel-track')
            .off('mousemove.carouselDrag touchmove.carouselDrag')
            .on('mousemove.carouselDrag touchmove.carouselDrag', function(e) {
                const dragData = $(this).data('drag');
                if (!dragData || !dragData.active) return;

                const isTouch = e.type === 'touchmove';
                const point = isTouch ? e.originalEvent.touches[0] : e;
                const deltaX = point.pageX - dragData.startX;
                const deltaY = point.pageY - dragData.startY;

                const shouldStartDrag = Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY);
                if (!dragData.hasDragged && shouldStartDrag) {
                    dragData.hasDragged = true;
                    isCarouselDragging = true;
                }

                if (dragData.hasDragged) {
                    e.preventDefault();
                    $(this).scrollLeft(dragData.scrollLeft - deltaX);
                }
            });

        $(document)
            .off('mouseup.carouselDrag touchend.carouselDrag touchcancel.carouselDrag')
            .on('mouseup.carouselDrag touchend.carouselDrag touchcancel.carouselDrag', function() {
                $('.carousel-track').each(function() {
                    const dragData = $(this).data('drag');
                    if (!dragData) return;
                    dragData.active = false;
                    $(this).data('drag', dragData);
                    $(this).removeClass('is-dragging');
                });

                if (isCarouselDragging) {
                    setTimeout(() => {
                        isCarouselDragging = false;
                    }, 0);
                }
            });
    }

    // Mostrar erro de carregamento
    function mostrarErroCarregamento() {
        $loadingIndicator.html(`
        <div class="error-loading">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar traduções desta página. Tenta recarregar para obter a versão mais recente.</p>
        <button class="reload-data" id="reloadData">
        <i class="fas fa-redo"></i> Tentar Novamente
        </button>
        </div>
        `);

        $('#reloadData').on('click', function() {
            carregarDadosJSON();
        });
    }

    // Configurar event listeners
    function setupEventListeners() {
        // Back to top button
        $(window).on('scroll', function() {
            if ($(this).scrollTop() > 300) {
                $backToTop.addClass('visible');
            } else {
                $backToTop.removeClass('visible');
            }
        });

        $backToTop.on('click', function() {
            $('html, body').animate({ scrollTop: 0 }, 500);
        });

        // Menu mobile
        $menuToggle.on('click', function(e) {
            e.stopPropagation();
            $mobileMenu.toggleClass('active');
        });

        $mobileCategories.on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            $mobileSubmenu.slideToggle();
        });

        // Fechar menu ao clicar fora
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.nav-container').length &&
                !$(e.target).closest('.mobile-menu').length &&
                $mobileMenu.hasClass('active')) {
                $mobileMenu.removeClass('active');
            $mobileSubmenu.slideUp();
                }
        });

        // Formulário de pesquisa
        $searchForm.on('submit', function(e) {
            e.preventDefault();
            const query = $searchInput.val().trim();
            if (query) {
                const url = new URL(window.location.href);
                url.searchParams.set('q', query);
                window.history.replaceState({}, '', url);
                const resultados = pesquisarTraducoes(query);
                track('search_home_submit', {
                    query_length: query.length,
                    results_count: resultados.length,
                    search_origin: 'desktop'
                });
            } else {
                const url = new URL(window.location.href);
                url.searchParams.delete('q');
                window.history.replaceState({}, '', url);
                // Se a pesquisa estiver vazia, voltar à vista atual
                aplicarVista(currentView);
            }
        });

        // Formulário de pesquisa mobile
        $('#mobile-search-form').on('submit', function(e) {
            e.preventDefault();
            const query = $('#mobile-search-input').val().trim();
            if (query) {
                const url = new URL(window.location.href);
                url.searchParams.set('q', query);
                window.history.replaceState({}, '', url);
                const resultados = pesquisarTraducoes(query);
                track('search_home_submit', {
                    query_length: query.length,
                    results_count: resultados.length,
                    search_origin: 'mobile'
                });
                // Fechar menu mobile após pesquisa
                $mobileMenu.removeClass('active');
                $mobileSubmenu.slideUp();
            } else {
                const url = new URL(window.location.href);
                url.searchParams.delete('q');
                window.history.replaceState({}, '', url);
                aplicarVista(currentView);
            }
        });

        // Clique em qualquer parte do card
        $(document).on('click', '.featured-card, .game-card', function(e) {
            // Não ativar se clicar em links ou botões dentro do card
            if (isCarouselDragging) {
                return;
            }
            if (!$(e.target).closest('a, button').length) {
                const link = $(this).data('link');
                if (link) {
                    const slug = String($(this).data('game-id') || '').trim();
                    track('click_home_game_card', {
                        game_slug: slug,
                        placement: getCardPlacement($(this))
                    });
                    window.open(link, '_self', 'noopener,noreferrer');
                }
            }
        });

        $(document).on('click', '.featured-card a, .game-card a', function() {
            const $card = $(this).closest('.featured-card, .game-card');
            const slug = String($card.data('game-id') || '').trim();
            track('click_home_game_link', {
                game_slug: slug,
                placement: getCardPlacement($card)
            });
        });

        $('.hero-btn').on('click', function() {
            const isDiscord = $(this).hasClass('hero-btn-secondary');
            track(isDiscord ? 'click_home_hero_discord' : 'click_home_hero_explore', {
                cta_location: 'hero'
            });
        });

        $heroLiveTicker.on('click', 'a', function() {
            track('click_home_ticker_link', {
                destination_url: String($(this).attr('href') || '').trim()
            });
        });

        // Smooth scroll para âncoras (inclui /#categoria)
        $('a[href*="#"]').on('click', function(e) {
            const url = new URL(this.href, window.location.href);
            if (!url.hash) return;

            const samePage = url.origin === window.location.origin &&
                (url.pathname === window.location.pathname ||
                 url.pathname === '/' ||
                 url.pathname.endsWith('/index.html'));

            if (!samePage) return;

            const hash = url.hash;
            const isCategoria = categoryHashes.includes(hash);

            if (isCategoria && currentView === 'grid') {
                e.preventDefault();
                carregarGrelhaPorCategoria(hash.replace('#', ''));
                $('html, body').animate({
                    scrollTop: $categoriesContainer.offset().top - 80
                }, 600);

                $mobileMenu.removeClass('active');
                $mobileSubmenu.slideUp();
                return;
            }

            const needsCarousel = isCategoria && currentView !== 'carousel';
            if (isCategoria) {
                aplicarVista('carousel');
            }

            e.preventDefault();

            const doScroll = () => {
                const target = $(hash);
                if (target.length) {
                    $('html, body').animate({
                        scrollTop: target.offset().top - 80
                    }, 600);
                }
            };

            if (needsCarousel) {
                setTimeout(doScroll, 50);
            } else {
                doScroll();
            }

            // Fechar menu mobile se aberto
            $mobileMenu.removeClass('active');
            $mobileSubmenu.slideUp();
        });

        // Limpar pesquisa com Escape
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape') {
                $searchInput.val('');
                $('#mobile-search-input').val('');
                if ($('#categoriesContainer').find('.search-results').length) {
                    carregarCategorias();
                }
            }
        });

        // Controlo de vista (carrossel/grelha)
        $('.view-btn').on('click', function() {
            const view = $(this).data('view');
            aplicarVista(view);
        });
    }

    // Pesquisar traduções
    function pesquisarTraducoes(query) {
        const resultados = [];
        const queryLower = query.toLowerCase();

        // Pesquisar em todos os jogos
        dadosJogos.jogos.forEach(jogo => {
            const titulo = jogo.titulo.toLowerCase();
            const descricao = jogo.descricao.toLowerCase();
            const nomeJogo = jogo.informacoesJogo?.nome?.toLowerCase() || '';
            const categorias = jogo.categorias.join(' ').toLowerCase();

            if (titulo.includes(queryLower) ||
                descricao.includes(queryLower) ||
                nomeJogo.includes(queryLower) ||
                categorias.includes(queryLower)) {
                resultados.push(jogo);
                }
        });

        // Mostrar resultados
        mostrarResultadosPesquisa(resultados, query);
        scrollToResults();
        return resultados;
    }

    // Mostrar resultados da pesquisa
    function mostrarResultadosPesquisa(resultados, query) {
        if (resultados.length === 0) {
            $categoriesContainer.html(`
            <div class="search-results">
            <div class="search-header">
            <h3><i class="fas fa-search"></i> Nenhum resultado para "${query}"</h3>
            <button class="nav-btn" id="clearSearch" title="Limpar pesquisa">
            <i class="fas fa-times"></i>
            </button>
            </div>
            <p class="no-data">Tenta pesquisar por outro termo ou verifica a ortografia.</p>
            </div>
            `);
        } else {
            const resultadosHTML = resultados.map(jogo => criarCardJogo(jogo)).join('');

            $categoriesContainer.html(`
            <div class="search-results">
            <div class="search-header">
            <h3><i class="fas fa-search"></i> Resultados para "${query}" (${resultados.length})</h3>
            <button class="nav-btn" id="clearSearch" title="Limpar pesquisa">
            <i class="fas fa-times"></i>
            </button>
            </div>
            <div class="search-grid">
            ${resultadosHTML}
            </div>
            </div>
            `);
        }

        // Configurar botão de limpar pesquisa
        $('#clearSearch').on('click', function() {
            $searchInput.val('');
            aplicarVista(currentView);
        });
    }

    function scrollToResults() {
        setTimeout(() => {
            const targetTop = $categoriesContainer.offset()?.top;
            if (typeof targetTop === 'number') {
                $('html, body').animate({
                    scrollTop: targetTop - 80
                }, 600);
            }
        }, 0);
    }

    function aplicarVista(view) {
        currentView = view === 'grid' ? 'grid' : 'carousel';

        // Atualizar botões ativos
        $('.view-btn').removeClass('active');
        $(`.view-btn[data-view="${currentView}"]`).addClass('active');

        // Guardar preferência
        localStorage.setItem('viewMode', currentView);

        // Aplicar vista
        if (currentView === 'grid') {
            carregarGrelha();
        } else {
            carregarCategorias();
        }
    }

    // Iniciar a aplicação
    init();
});
