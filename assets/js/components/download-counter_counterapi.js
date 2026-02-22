// Download Counter com Counter API + rate limiting localStorage
(function() {
  'use strict';

  const COUNTER_API_BASE = 'https://api.counterapi.dev/v1/100nome';
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
    const storageKey = `dl_${gameSlug}`;
    const lastIncrement = localStorage.getItem(storageKey);
    
    if (!lastIncrement) return true;
    
    const now = Date.now();
    const elapsed = now - parseInt(lastIncrement, 10);
    
    return elapsed > RATE_LIMIT_MS;
  }

  // Marcar como incrementado agora
  function markIncremented(gameSlug) {
    const storageKey = `dl_${gameSlug}`;
    localStorage.setItem(storageKey, Date.now().toString());
  }

  // Incrementar contador no Counter API
  async function incrementCounter(gameSlug) {
    if (!canIncrement(gameSlug)) {
      console.log('[DownloadCounter] Rate limited, skipping increment');
      return;
    }

    try {
      const response = await fetch(`${COUNTER_API_BASE}/${gameSlug}/up`, {
        method: 'GET'
      });
      
      if (response.ok) {
        markIncremented(gameSlug);
        console.log('[DownloadCounter] Counter incremented');
      }
    } catch (error) {
      console.error('[DownloadCounter] Failed to increment:', error);
    }
  }

  // Buscar e mostrar contador atual
  async function fetchAndDisplayCounter(gameSlug) {
    const counterEl = document.querySelector('.download-stats-number');
    if (!counterEl) return;

    try {
      const response = await fetch(`${COUNTER_API_BASE}/${gameSlug}`);
      const data = await response.json();
      
      if (data && typeof data.count === 'number') {
        const formatted = formatNumber(data.count);
        counterEl.textContent = `${formatted} descargas`;
        counterEl.style.display = ''; // Mostra se estava escondido
      }
    } catch (error) {
      console.error('[DownloadCounter] Failed to fetch count:', error);
      // Deixa o "—" ou esconde
      counterEl.style.display = 'none';
    }
  }

  // Formatar número com separadores de milhar
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Inicializar
  function init() {
    const gameSlug = getGameSlug();
    if (!gameSlug) return;

    // Buscar e mostrar contador ao carregar
    fetchAndDisplayCounter(gameSlug);

    // Adicionar listener aos botões de download
    const downloadBtns = document.querySelectorAll('.download-btn');
    
    downloadBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        // Incrementa em background (fire-and-forget)
        incrementCounter(gameSlug);
        // O download continua normalmente
      });
    });

    console.log('[DownloadCounter] Initialized for:', gameSlug);
  }

  // Executar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
