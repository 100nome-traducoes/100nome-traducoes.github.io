// Script para páginas individuais de jogos
// Este script deve ser incluído DEPOIS do script.js principal

$(document).ready(function() {
    const GUID_JOGO_ATUAL = obterGuidJogoAtual();

    if (!GUID_JOGO_ATUAL) {
        console.error('GUID do jogo atual não encontrado no HTML.');
        $('.related-games').html(`
            <p class="error-text">Erro ao carregar sugestões.</p>
        `);
        return;
    }

    // Aguardar o carregamento dos dados (ou carregar se necessário)
    function carregarJogosRelacionados() {
        // Verificar se os dados já estão carregados
        if (typeof window.jogosPorGuid === 'undefined' || typeof window.descobrirJogosRelacionados !== 'function') {
            carregarDadosJogos()
                .then(() => carregarJogosRelacionados())
                .catch(() => {
                    $('.related-games').html(`
                        <p class="error-text">Erro ao carregar sugestões.</p>
                    `);
                });
            return;
        }

        const jogoAtual = window.jogosPorGuid[GUID_JOGO_ATUAL];

        if (!jogoAtual) {
            console.error('Jogo não encontrado:', GUID_JOGO_ATUAL);
            $('.related-games').html(`
                <p class="error-text">Erro ao carregar sugestões.</p>
            `);
            return;
        }

        // Mostrar ou esconder downloads conforme existência de rebrandlyId
        if (!jogoAtual.rebrandlyId) {
            $('.download-count').hide();
        }

        // Descobrir jogos relacionados
        const relacionados = window.descobrirJogosRelacionados(jogoAtual, 4);

        if (relacionados.length === 0) {
            $('.related-games').html(`
                <p class="loading-text">Sem sugestões disponíveis.</p>
            `);
            return;
        }

        // Renderizar cards dos jogos relacionados
        const cardsHTML = relacionados.map(jogo => criarCardRelacionado(jogo)).join('');
        $('.related-games').html(cardsHTML);

        // Adicionar evento de clique
        $('.related-game-card').on('click', function() {
            const link = $(this).data('link');
            if (link) {
                window.location.href = link;
            }
        });
    }

    // Criar card de jogo relacionado (versão compacta)
    function criarCardRelacionado(jogo) {
        const categorias = extrairCategoriasPrincipais(jogo.categorias).slice(0, 2);
        const linkJogo = `${jogo.guid}.html`;

        return `
            <div class="related-game-card" data-link="${linkJogo}">
                <img src="../${jogo.capa}" alt="${limparTitulo(jogo.titulo)}" class="related-game-image" loading="lazy">
                <div class="related-game-info">
                    <h4 class="related-game-title">${limparTitulo(jogo.titulo)}</h4>
                    <div class="related-game-categories">
                        ${categorias.map(cat => `<span class="category-tag-small">${cat}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Funções auxiliares (mesmas do script principal)
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
            'objetosescondidos': 'Objetos Escondidos'
        };

        return categorias
            .map(cat => {
                const catLower = cat.toLowerCase().replace(/[^a-z]/g, '');
                return categoriasMap[catLower];
            })
            .filter(cat => cat);
    }

    function limparTitulo(titulo) {
        // Remove "Tradução:" e "PT-PT" do título
        return titulo
            .replace(/Tradução:\s*/gi, '')
            .replace(/\s*PT-PT\s*/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function obterGuidJogoAtual() {
        return (
            document.body?.dataset?.guid ||
            document.querySelector('.game-page')?.dataset?.guid ||
            document.querySelector('meta[name="game-guid"]')?.getAttribute('content') ||
            ''
        ).trim();
    }

    function carregarDadosJogos() {
        return new Promise((resolve, reject) => {
            if (typeof window.jogosPorGuid !== 'undefined' && typeof window.descobrirJogosRelacionados === 'function') {
                resolve();
                return;
            }

            $.ajax({
                url: '../data/jogos.json',
                method: 'GET',
                dataType: 'json',
                success: function(data) {
                    const dadosJogos = data;
                    const jogosPorGuid = {};

                    dadosJogos.jogos.forEach(jogo => {
                        jogosPorGuid[jogo.guid] = jogo;
                    });

                    window.jogosPorGuid = jogosPorGuid;
                    window.descobrirJogosRelacionados = function(jogoAtual, quantidade = 4) {
                        if (!jogoAtual) return [];

                        const jogosComSimilaridade = dadosJogos.jogos
                            .filter(jogo => jogo.guid !== jogoAtual.guid)
                            .map(jogo => {
                                let similaridade = 0;

                                const categoriasComum = jogo.categorias.filter(cat =>
                                    jogoAtual.categorias.includes(cat)
                                ).length;
                                similaridade += categoriasComum * 20;

                                if (jogo.tradutorDescricao === jogoAtual.tradutorDescricao) {
                                    similaridade += 15;
                                }

                                if (jogo.informacoesJogo?.criadoPor === jogoAtual.informacoesJogo?.criadoPor) {
                                    similaridade += 25;
                                }

                                if (jogo.informacoesJogo?.estilo && jogoAtual.informacoesJogo?.estilo) {
                                    const estilosJogo = jogo.informacoesJogo.estilo.toLowerCase().split(',');
                                    const estilosAtual = jogoAtual.informacoesJogo.estilo.toLowerCase().split(',');
                                    const estilosComum = estilosJogo.filter(estilo =>
                                        estilosAtual.some(e => e.trim() === estilo.trim())
                                    ).length;
                                    similaridade += estilosComum * 10;
                                }

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

                        return jogosComSimilaridade
                            .sort((a, b) => b.similaridade - a.similaridade)
                            .slice(0, quantidade)
                            .map(item => item.jogo);
                    };

                    resolve();
                },
                error: function(error) {
                    console.error('Erro ao carregar dados:', error);
                    reject(error);
                }
            });
        });
    }

    function formatarNumero(numero) {
        return new Intl.NumberFormat('pt-PT').format(numero);
    }

    function carregarDownloads() {
        $.ajax({
            url: '../data/downloads.json',
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                const registo = data[GUID_JOGO_ATUAL];
                if (registo && typeof registo.downloads === 'number') {
                    const texto = `${formatarNumero(registo.downloads)} descargas`;
                    $('#downloadsCount').text(texto);
                } else {
                    $('.download-stats-number').hide();
                }
            },
            error: function(error) {
                console.error('Erro ao carregar downloads:', error);
                $('.download-stats-number').hide();
            }
        });
    }

    // Iniciar carregamento
    carregarJogosRelacionados();
    carregarDownloads();

    // Scroll suave para âncoras internas
    $('a[href^="#"]').on('click', function(e) {
        const target = $(this.getAttribute('href'));
        if (target.length) {
            e.preventDefault();
            $('html, body').animate({
                scrollTop: target.offset().top - 80
            }, 600);
        }
    });
});
