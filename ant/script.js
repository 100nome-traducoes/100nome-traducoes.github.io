$(document).ready(function() {
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

    // Dados globais
    let dadosJogos = {
        destaques: [],
        jogos: [],
        categoriasPrincipais: []
    };

    // Cache para procurar jogos rapidamente
    let jogosPorGuid = {};
    let todasCategorias = new Set();

    // Inicialização
    function init() {
        setupEventListeners();
        carregarDadosJSON();
    }

    // Carregar dados do JSON
    function carregarDadosJSON() {
        $loadingIndicator.show();

        $.ajax({
            url: 'data/jogos.json',
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                processarDadosRecebidos(data);
                carregarDestaques();
                carregarCategorias();
                atualizarEstatisticas();
                $loadingIndicator.hide();
            },
            error: function(error) {
                console.error('Erro ao carregar dados:', error);
                mostrarErroCarregamento();
            }
        });
    }

    // Processar dados recebidos
    function processarDadosRecebidos(data) {
        dadosJogos = data;

        // Criar cache para procura rápida
        jogosPorGuid = {};
        todasCategorias.clear();

        dadosJogos.jogos.forEach(jogo => {
            jogosPorGuid[jogo.guid] = jogo;

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

    // Carregar jogos em destaque
    function carregarDestaques() {
        $featuredGrid.empty();

        if (!dadosJogos.destaques || dadosJogos.destaques.length === 0) {
            $featuredGrid.html(`
            <div class="no-data">
            <i class="fas fa-star"></i>
            <p>Sem destaques disponíveis no momento.</p>
            </div>
            `);
            return;
        }

        // Obter os jogos reais dos GUIDs de destaque
        const jogosDestaque = dadosJogos.destaques
        .map(guid => jogosPorGuid[guid])
        .filter(jogo => jogo)
        .slice(0, 3); // Limitar a 3 destaques

        if (jogosDestaque.length === 0) {
            $featuredGrid.html(`
            <div class="no-data">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Erro ao carregar destaques.</p>
            </div>
            `);
            return;
        }

        jogosDestaque.forEach(jogo => {
            const jogoCard = criarCardDestaque(jogo);
            $featuredGrid.append(jogoCard);
        });
    }

    // Criar card de destaque
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
        ${categoriasBadges.map(cat =>
            `<span class="category-badge">${cat}</span>`
        ).join('')}
        </div>
        <h3 class="featured-title">${limparTitulo(jogo.titulo)}</h3>
        <p class="featured-description">${descricaoCurta}</p>
        <a href="${linkJogo}" class="featured-link" rel="noopener">
        <i class="fas fa-external-link-alt"></i> Ver Tradução
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
        const isDestaque = dadosJogos.destaques.includes(jogo.guid);
        const categoriasTags = extrairCategoriasPrincipais(jogo.categorias).slice(0, 2);
        const descricaoCurta = truncarTexto(jogo.descricao, 90);
        const dataFormatada = formatarData(jogo.dataPublicacao);

        const linkJogo = `jogo/${jogo.guid}.html`;

        // Verificar se é novo (menos de 30 dias)
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
        ${categoriasTags.map(cat =>
            `<span class="category-tag">${cat}</span>`
        ).join('')}
        </div>
        <h3 class="game-title">${limparTitulo(jogo.titulo)}</h3>
        <p class="game-description">${descricaoCurta}</p>
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

        // Permitir scroll com mouse wheel nos carrosseis
        $('.carousel-track').on('wheel', function(e) {
            if (Math.abs(e.originalEvent.deltaY) > Math.abs(e.originalEvent.deltaX)) {
                e.preventDefault();
                $(this).scrollLeft($(this).scrollLeft() + e.originalEvent.deltaY);
            }
        });
    }

    // Mostrar erro de carregamento
    function mostrarErroCarregamento() {
        $loadingIndicator.html(`
        <div class="error-loading">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Erro ao carregar traduções. Tenta recarregar a página.</p>
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

        // Navbar sticky e scroll
        let lastScrollTop = 0;
        const $navbar = $('.navbar');
        const navbarHeight = $navbar.outerHeight();

        $(window).on('scroll', function() {
            const scrollTop = $(this).scrollTop();

            if (scrollTop > navbarHeight) {
                $navbar.addClass('scrolled');
            } else {
                $navbar.removeClass('scrolled');
            }

            lastScrollTop = scrollTop;
        });

        // Formulário de pesquisa
        $searchForm.on('submit', function(e) {
            e.preventDefault();
            const query = $searchInput.val().trim();
            if (query) {
                pesquisarTraducoes(query);
            } else {
                // Se a pesquisa estiver vazia, voltar às categorias
                carregarCategorias();
            }
        });

        // Formulário de pesquisa mobile
        $('#mobile-search-form').on('submit', function(e) {
            e.preventDefault();
            const query = $('#mobile-search-input').val().trim();
            if (query) {
                pesquisarTraducoes(query);
                // Fechar menu mobile após pesquisa
                $mobileMenu.removeClass('active');
                $mobileSubmenu.slideUp();
            } else {
                carregarCategorias();
            }
        });

        // Clique em qualquer parte do card
        $(document).on('click', '.featured-card, .game-card', function(e) {
            // Não ativar se clicar em links ou botões dentro do card
            if (!$(e.target).closest('a, button').length) {
                const link = $(this).data('link');
                if (link) {
                    window.open(link, '_self', 'noopener,noreferrer');
                }
            }
        });

        // Smooth scroll para âncoras
        $('a[href^="#"]').on('click', function(e) {
            const target = $(this.getAttribute('href'));
            if (target.length) {
                e.preventDefault();
                $('html, body').animate({
                    scrollTop: target.offset().top - 80
                }, 600);

                // Fechar menu mobile se aberto
                $mobileMenu.removeClass('active');
                $mobileSubmenu.slideUp();
            }
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
            const $btn = $(this);
            const view = $btn.data('view');
            
            // Atualizar botões ativos
            $('.view-btn').removeClass('active');
            $btn.addClass('active');
            
            // Aplicar vista
            if (view === 'grid') {
                $('.category-section').addClass('grid-view');
            } else {
                $('.category-section').removeClass('grid-view');
            }
            
            // Guardar preferência
            localStorage.setItem('viewMode', view);
        });

        // Carregar preferência de vista guardada
        const savedView = localStorage.getItem('viewMode');
        if (savedView === 'grid') {
            $('.view-btn[data-view="grid"]').click();
        }
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
            carregarCategorias();
        });
    }

    // Iniciar a aplicação
    init();
});
