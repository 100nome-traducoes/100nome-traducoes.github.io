// Download Counter com Netlify Blobs + rate limiting localStorage
(function() {
  'use strict';

  const API_BASE = 'https://100nome-api.netlify.app/.netlify/functions';
  const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutos
  const DISCORD_URL = 'https://discord.gg/Xv7ax2VkEp';
  const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
  const MODAL_CLOSE_MS = 360;
  const NUDGE_CLOSE_MS = 240;
  const track = (eventName, params = {}) => {
    if (window.SiteAnalytics && typeof window.SiteAnalytics.track === 'function') {
      window.SiteAnalytics.track(eventName, params);
    }
  };

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

  function formatCounterText(value, label) {
    const normalizedLabel = String(label || 'descargas').trim() || 'descargas';
    return `${formatNumber(value)} ${normalizedLabel}`;
  }

  // Buscar e mostrar contador atual (sem incrementar)
  async function fetchAndDisplayCounter(gameSlug, counterLabel) {
    const counterEl = document.querySelector('.download-stats-number');
    if (!counterEl) return;

    try {
      const response = await fetch(`${API_BASE}/count?id=${gameSlug}`)
      const data = await response.json();

      if (typeof data.downloads === 'number') {
        counterEl.textContent = formatCounterText(data.downloads, counterLabel);
        counterEl.style.display = '';
      }
    } catch (error) {
      console.error('[DownloadCounter] Failed to fetch count:', error);
      counterEl.style.display = 'none';
    }
  }

  async function handleActionViaApi(gameSlug, counterLabel) {
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
        counterEl.textContent = formatCounterText(data.downloads, counterLabel);
      }

      if (canIncrement(gameSlug)) {
        markIncremented(gameSlug);
      }

      // Abre destino devolvido pela API
      track('download_redirect_success', {
        game_slug: gameSlug,
        counter_label: counterLabel
      });
      window.location.href = data.url;

    } catch (error) {
      console.error('[DownloadCounter] Failed to handle API action:', error);
      track('download_redirect_error', {
        game_slug: gameSlug,
        counter_label: counterLabel
      });
    }
  }

  function removeDownloadChoiceModal() {
    const overlay = document.querySelector('.download-choice-overlay');
    if (overlay) {
      overlay.remove();
    }
    document.body.classList.remove('modal-open');
  }

  function closeDownloadChoiceModal() {
    const overlay = document.querySelector('.download-choice-overlay');
    if (!overlay) {
      document.body.classList.remove('modal-open');
      return;
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      removeDownloadChoiceModal();
      return;
    }

    if (overlay.classList.contains('is-closing')) return;

    overlay.classList.remove('is-open');
    overlay.classList.add('is-closing');

    const finalizeClose = () => {
      overlay.removeEventListener('transitionend', onTransitionEnd);
      if (overlay.isConnected) {
        overlay.remove();
      }
      document.body.classList.remove('modal-open');
    };

    const onTransitionEnd = (event) => {
      if (event.target !== overlay) return;
      finalizeClose();
    };

    overlay.addEventListener('transitionend', onTransitionEnd);
    window.setTimeout(finalizeClose, MODAL_CLOSE_MS);
  }

  function getNudgeStorageKey(gameSlug) {
    return `post_dl_nudge_${gameSlug}`;
  }

  function shouldShowPostDownloadNudge(gameSlug) {
    try {
      const key = getNudgeStorageKey(gameSlug);
      const raw = localStorage.getItem(key);
      if (!raw) return true;
      const lastAt = parseInt(raw, 10);
      if (!Number.isFinite(lastAt)) return true;
      return Date.now() - lastAt > NUDGE_COOLDOWN_MS;
    } catch {
      return true;
    }
  }

  function markPostDownloadNudge(gameSlug, longCooldown) {
    try {
      const key = getNudgeStorageKey(gameSlug);
      const now = Date.now();
      if (longCooldown) {
        const longMs = 30 * 24 * 60 * 60 * 1000; // 30 dias
        localStorage.setItem(key, String(now + longMs - NUDGE_COOLDOWN_MS));
      } else {
        localStorage.setItem(key, String(now));
      }
    } catch {
      // noop
    }
  }

  function removePostDownloadNudge() {
    const nudge = document.querySelector('.download-post-nudge');
    if (!nudge) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      nudge.remove();
      return;
    }

    if (nudge.classList.contains('is-hiding')) return;
    nudge.classList.remove('is-visible');
    nudge.classList.add('is-hiding');

    const finalizeRemove = () => {
      nudge.removeEventListener('transitionend', onTransitionEnd);
      if (nudge.isConnected) {
        nudge.remove();
      }
    };

    const onTransitionEnd = (event) => {
      if (event.target !== nudge) return;
      finalizeRemove();
    };

    nudge.addEventListener('transitionend', onTransitionEnd);
    window.setTimeout(finalizeRemove, NUDGE_CLOSE_MS);
  }

  function showPostDownloadNudge(gameSlug) {
    if (!shouldShowPostDownloadNudge(gameSlug)) return;
    removePostDownloadNudge();
    track('show_download_post_nudge', {
      game_slug: gameSlug
    });

    const nudge = document.createElement('div');
    nudge.className = 'download-post-nudge';
    nudge.innerHTML = `
      <div class="download-post-nudge-content">
        <p><strong>Download iniciado.</strong> Queres receber aviso quando sair a próxima tradução?</p>
        <div class="download-post-nudge-actions">
          <a href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-discord-primary" data-post-nudge-discord>
            <i class="fab fa-discord"></i> Receber avisos no Discord
          </a>
          <a href="#comentarios" class="btn btn-secondary">
            <i class="fas fa-comments"></i> Partilhar feedback
          </a>
          <button type="button" class="download-post-nudge-close" aria-label="Fechar aviso" data-post-nudge-close>
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;

    const closeBtn = nudge.querySelector('[data-post-nudge-close]');
    const discordLink = nudge.querySelector('[data-post-nudge-discord]');
    const feedbackLink = nudge.querySelector('a[href="#comentarios"]');

    closeBtn.addEventListener('click', () => {
      track('click_download_post_nudge_close', {
        game_slug: gameSlug
      });
      markPostDownloadNudge(gameSlug, false);
      removePostDownloadNudge();
    });

    discordLink.addEventListener('click', () => {
      track('click_download_post_nudge_discord', {
        game_slug: gameSlug
      });
      markPostDownloadNudge(gameSlug, true);
      removePostDownloadNudge();
    });

    if (feedbackLink) {
      feedbackLink.addEventListener('click', () => {
        track('click_download_post_nudge_feedback', {
          game_slug: gameSlug
        });
        markPostDownloadNudge(gameSlug, false);
        removePostDownloadNudge();
      });
    }

    document.body.appendChild(nudge);
    markPostDownloadNudge(gameSlug, false);
    window.requestAnimationFrame(() => {
      nudge.classList.add('is-visible');
    });
  }

  function showDownloadChoiceModal(gameSlug, counterLabel) {
    removeDownloadChoiceModal();
    track('open_download_modal', {
      game_slug: gameSlug,
      counter_label: counterLabel
    });

    const overlay = document.createElement('div');
    overlay.className = 'download-choice-overlay';
    overlay.innerHTML = `
      <div class="download-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="downloadChoiceTitle">
        <h3 id="downloadChoiceTitle" class="download-choice-title">Descarregar + receber novidades</h3>
        <p class="download-choice-text">
          Descarrega já a tradução. Se quiseres, entra no Discord para receber aviso quando saírem novas traduções e atualizações.
        </p>
        <div class="download-choice-actions">
          <button type="button" class="btn btn-primary" data-download-choice="download">
            <i class="fas fa-download"></i> Descarregar agora
          </button>
          <a href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-discord-primary">
            <i class="fab fa-discord"></i> Receber avisos no Discord
          </a>
        </div>
        <button type="button" class="download-choice-close" data-download-choice="close">
          <i class="fas fa-times"></i> Fechar
        </button>
      </div>
    `;

    const closeModal = () => {
      closeDownloadChoiceModal();
      document.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });

    overlay.querySelector('[data-download-choice="close"]').addEventListener('click', () => {
      closeModal();
    });

    overlay.querySelector('[data-download-choice="download"]').addEventListener('click', async () => {
      track('click_download_modal_download', {
        game_slug: gameSlug
      });
      closeModal();
      showPostDownloadNudge(gameSlug);
      await handleActionViaApi(gameSlug, counterLabel);
    });

    const discordBtn = overlay.querySelector('.btn-discord-primary');
    if (discordBtn) {
      discordBtn.addEventListener('click', () => {
        track('click_download_modal_discord', {
          game_slug: gameSlug
        });
      });
    }

    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        overlay.classList.add('is-open');
      });
    });
  }

  function showActionErrorModal(config) {
    removeDownloadChoiceModal();
    track('open_action_error_modal', {
      action_type: config?.type || 'error'
    });

    const message = String(config?.message || 'Esta ação está temporariamente indisponível.').trim();
    const helpUrl = String(config?.helpUrl || DISCORD_URL).trim() || DISCORD_URL;

    const overlay = document.createElement('div');
    overlay.className = 'download-choice-overlay';
    overlay.innerHTML = `
      <div class="download-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="actionErrorTitle">
        <h3 id="actionErrorTitle" class="download-choice-title">Link Indisponível</h3>
        <p class="download-choice-text">${message}</p>
        <div class="download-choice-actions">
          <a href="${helpUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-discord-primary">
            <i class="fab fa-discord"></i> Falar no Discord
          </a>
        </div>
        <button type="button" class="download-choice-close" data-download-choice="close">
          <i class="fas fa-times"></i> Fechar
        </button>
      </div>
    `;

    const closeModal = () => {
      closeDownloadChoiceModal();
      document.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });

    overlay.querySelector('[data-download-choice="close"]').addEventListener('click', () => {
      closeModal();
    });

    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        overlay.classList.add('is-open');
      });
    });
  }

  async function handlePlayAction(gameSlug, config) {
    track('click_primary_play', {
      game_slug: gameSlug,
      via_api: !!config.viaApi
    });
    if (config.viaApi) {
      await handleActionViaApi(gameSlug, config.counterLabel);
      return;
    }
    if (config.url) {
      window.location.href = config.url;
    }
  }

  function readActionConfig(buttonEl) {
    const type = String(buttonEl?.dataset?.actionType || 'download').trim().toLowerCase();
    const url = String(buttonEl?.dataset?.actionUrl || '').trim();
    const counterLabel = String(buttonEl?.dataset?.counterLabel || (type === 'play' ? 'acessos' : 'descargas')).trim();
    const viaApiRaw = String(buttonEl?.dataset?.actionViaApi || '').trim().toLowerCase();
    const viaApi = viaApiRaw ? viaApiRaw !== 'false' : (type === 'download');
    const message = String(buttonEl?.dataset?.actionMessage || '').trim();
    const helpUrl = String(buttonEl?.dataset?.actionHelpUrl || DISCORD_URL).trim() || DISCORD_URL;

    return { type, url, counterLabel, viaApi, message, helpUrl };
  }

  // Inicializar
  function init() {
    const gameSlug = getGameSlug();
    if (!gameSlug) return;

    const primaryBtn = document.querySelector('.download-btn');
    const primaryConfig = readActionConfig(primaryBtn);
    if (primaryConfig.type !== 'error') {
      fetchAndDisplayCounter(gameSlug, primaryConfig.counterLabel);
    }

    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        const config = readActionConfig(btn);
        track('click_game_primary_action', {
          game_slug: gameSlug,
          action_type: config.type,
          via_api: !!config.viaApi
        });
        if (config.type === 'download') {
          e.preventDefault();
          showDownloadChoiceModal(gameSlug, config.counterLabel);
          return;
        }
        if (config.type === 'play') {
          e.preventDefault();
          handlePlayAction(gameSlug, config);
          return;
        }
        if (config.type === 'error') {
          e.preventDefault();
          showActionErrorModal(config);
        }
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
