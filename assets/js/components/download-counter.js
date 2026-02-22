// Download Counter com Netlify Blobs + rate limiting localStorage
(function() {
  'use strict';

  const API_BASE = 'https://100nome-api.netlify.app/.netlify/functions';
  const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutos

  // Obter slug do jogo do data-slug no body (fallback: URL)
  function getGameSlug() {
    const fromDataset = (document.body?.dataset?.slug || '').trim();
    if (fromDataset) return fromDataset;

    const match = window.location.pathname.match(/\/jogo\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]);

    console.warn('[DownloadCounter] slug not found on body/url');
    return null;
  }

  // Verificar se já incrementou recentemente (rate limiting)
  function canIncrement(gameSlug) {
    const lastIncrement = localStorage.getItem(`dl_${gameSlug}`);
    if (!lastIncrement) return true;
    return Date.now() - parseInt(lastIncrement, 10) > RATE_LIMIT_MS;
  }

  function markIncremented(gameSlug) {
    localStorage.setItem(`dl_${gameSlug}`, Date.now().toString());
  }

  // Formatar número com separadores de milhar
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Buscar e mostrar contador atual (sem incrementar)
  async function fetchAndDisplayCounter(gameSlug) {
    const counterEl = document.querySelector('.download-stats-number');
    if (!counterEl) return;

    try {
      const response = await fetch(`${API_BASE}/count?id=${gameSlug}`)
      const data = await response.json();

      if (typeof data.downloads === 'number') {
        counterEl.textContent = `${formatNumber(data.downloads)} descargas`;
        counterEl.style.display = '';
      }
    } catch (error) {
      console.error('[DownloadCounter] Failed to fetch count:', error);
      counterEl.style.display = 'none';
    }
  }

  // Chamar download: incrementa contador e abre URL
  async function handleDownload(gameSlug) {
    if (!canIncrement(gameSlug)) {
      console.log('[DownloadCounter] Rate limited, skipping increment');
    }

    try {
      const response = await fetch(`${API_BASE}/download?id=${gameSlug}`)
      const data = await response.json();

      if (!data.url) throw new Error('URL em falta na resposta');

      // Atualiza contador no ecrã com o valor devolvido pelo servidor
      const counterEl = document.querySelector('.download-stats-number');
      if (counterEl && typeof data.downloads === 'number') {
        counterEl.textContent = `${formatNumber(data.downloads)} descargas`;
      }

      if (canIncrement(gameSlug)) {
        markIncremented(gameSlug);
      }

      // Abre o download
      window.location.href = data.url;

    } catch (error) {
      console.error('[DownloadCounter] Failed to handle download:', error);
    }
  }

  // Inicializar
  function init() {
    const gameSlug = getGameSlug();
    if (!gameSlug) return;

    fetchAndDisplayCounter(gameSlug);

    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        handleDownload(gameSlug);
      });
    });

    console.log('[DownloadCounter] Initialized for:', gameSlug);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
