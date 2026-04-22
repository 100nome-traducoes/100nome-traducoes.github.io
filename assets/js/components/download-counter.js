// Download Counter via Cloudflare Worker
(function() {
  'use strict';

  const API_BASE = 'https://games-worker.100nome-portugal.workers.dev';
  const DISCORD_URL = String(window.SiteLinks?.discordMain || '').trim();
  const DISCORD_REPORT_URL = String(window.SiteLinks?.discordReport || '').trim();
  const NUDGE_COOLDOWN_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
  const NUDGE_COOLDOWN_DISCORD_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
  const NUDGE_COOLDOWN_FEEDBACK_MS = 24 * 60 * 60 * 1000; // 24h
  const MODAL_CLOSE_MS = 360;
  const NUDGE_CLOSE_MS = 240;
  const OPTIMISTIC_INCREMENT_KEY_PREFIX = 'dl_opt_inc_';
  const track = window.SiteUtils?.track || (() => {});

  // Obter slug do jogo do data-slug no body (fallback: URL)
  function getGameSlug() {
    if (window.SiteUtils?.getGameSlug) {
      const slug = window.SiteUtils.getGameSlug();
      if (slug) return slug;
    }

    const fromDataset = (document.body?.dataset?.slug || '').trim();
    if (fromDataset) return fromDataset;

    const match = window.location.pathname.match(/\/jogo\/([^/]+)/);
    if (match) return decodeURIComponent(match[1]);

    console.warn('[DownloadCounter] slug not found on body/url');
    return null;
  }

  // Formatar número com separadores de milhar
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatCounterText(value, label) {
    const normalizedLabel = String(label || 'descargas').trim() || 'descargas';
    return `${formatNumber(value)} ${normalizedLabel}`;
  }

  function optimisticIncrementCounter(counterLabel) {
    const counterEl = document.querySelector('.download-stats-number');
    if (!counterEl) return;

    const currentRaw = String(counterEl.textContent || '').replace(/[^\d]/g, '');
    const currentValue = Number.parseInt(currentRaw, 10);
    if (!Number.isFinite(currentValue)) return;

    counterEl.textContent = formatCounterText(currentValue + 1, counterLabel);
    counterEl.style.display = '';
  }

  function optimisticDecrementCounter(counterLabel) {
    const counterEl = document.querySelector('.download-stats-number');
    if (!counterEl) return;

    const currentRaw = String(counterEl.textContent || '').replace(/[^\d]/g, '');
    const currentValue = Number.parseInt(currentRaw, 10);
    if (!Number.isFinite(currentValue)) return;

    counterEl.textContent = formatCounterText(Math.max(0, currentValue - 1), counterLabel);
    counterEl.style.display = '';
  }

  function getOptimisticIncrementKey(gameSlug) {
    return `${OPTIMISTIC_INCREMENT_KEY_PREFIX}${gameSlug}`;
  }

  function markOptimisticIncrementPending(gameSlug) {
    try {
      sessionStorage.setItem(getOptimisticIncrementKey(gameSlug), '1');
    } catch {
      // noop
    }
  }

  function clearOptimisticIncrementPending(gameSlug) {
    try {
      sessionStorage.removeItem(getOptimisticIncrementKey(gameSlug));
    } catch {
      // noop
    }
  }

  function consumeOptimisticIncrementPending(gameSlug) {
    try {
      const key = getOptimisticIncrementKey(gameSlug);
      const exists = sessionStorage.getItem(key) === '1';
      if (exists) sessionStorage.removeItem(key);
      return exists;
    } catch {
      return false;
    }
  }

  function getErrorConfig(errorCode) {
    const normalized = String(errorCode || '').trim().toLowerCase();
    if (normalized === 'limite') {
      return {
        code: normalized,
        title: 'Limite diário atingido',
        message: 'Atingiste o limite diário para este jogo. Tenta novamente amanhã.',
        canReportDiscord: false
      };
    }
    if (normalized === 'indisponivel') {
      return {
        code: normalized,
        title: 'Descarga indisponível',
        message: 'Esta descarga está temporariamente indisponível. Tenta novamente mais tarde.',
        canReportDiscord: true
      };
    }
    if (normalized === 'nao-encontrado') {
      return {
        code: normalized,
        title: 'Conteúdo indisponível',
        message: 'Não foi possível concluir esta descarga de momento.',
        canReportDiscord: true
      };
    }
    return null;
  }

  function buildDiscordChannelUrl() {
    return DISCORD_REPORT_URL;
  }

  function buildDiscordReportMessage(errorCode, gameSlug) {
    return [
      'Olá! Tive um erro ao descarregar uma tradução no site 100Nome.',
      `Erro: ${String(errorCode || 'desconhecido')}`,
      `Jogo (slug): ${String(gameSlug || 'desconhecido')}`,
      `Página: ${window.location.pathname}`,
      `Data/hora: ${new Date().toISOString()}`,
      'Podem verificar, por favor?'
    ].join('\n');
  }

  function clearErrorQueryParam() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('erro')) return;
      url.searchParams.delete('erro');
      const search = url.searchParams.toString();
      const cleanUrl = `${url.pathname}${search ? `?${search}` : ''}${url.hash || ''}`;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch {
      // noop
    }
  }

  function removeDownloadErrorNudge() {
    const node = document.querySelector('[data-download-error-nudge]');
    if (node) node.remove();
  }

  function showDownloadErrorNudge(errorConfig, gameSlug) {
    if (!errorConfig) return;
    removeDownloadErrorNudge();

    const topNotices = document.querySelector('.game-top-notices');
    if (!topNotices) return;
    const reportUrl = errorConfig.canReportDiscord ? buildDiscordChannelUrl() : '';
    const reportMessageEncoded = errorConfig.canReportDiscord
      ? encodeURIComponent(buildDiscordReportMessage(errorConfig.code, gameSlug))
      : '';

    const card = document.createElement('div');
    card.className = 'game-top-nudge installer-post-nudge download-error-nudge';
    card.setAttribute('data-download-error-nudge', '1');
    card.innerHTML = `
      <div class="installer-post-nudge-head">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        <div>
          <p class="installer-post-nudge-title">${errorConfig.title}</p>
          <p class="installer-post-nudge-text">${errorConfig.message}</p>
        </div>
      </div>
      <div class="installer-post-nudge-actions">
        ${reportUrl ? `
        <button type="button" class="btn btn-secondary btn-discord-primary" data-download-error-discord data-report-url="${reportUrl}" data-report-message="${reportMessageEncoded}">
          <i class="fab fa-discord"></i> Copiar erro e abrir Discord
        </button>
        ` : ''}
        <button type="button" class="btn btn-secondary" data-download-error-close>
          <i class="fas fa-times"></i> Fechar
        </button>
      </div>
      ${reportUrl ? '<p class="installer-post-nudge-note" data-download-error-hint hidden></p>' : ''}
    `;

    card.querySelector('[data-download-error-close]')?.addEventListener('click', () => {
      removeDownloadErrorNudge();
    });
    card.querySelector('[data-download-error-discord]')?.addEventListener('click', async (event) => {
      const discordBtn = event.currentTarget;
      const reportUrlValue = String(discordBtn?.getAttribute('data-report-url') || '').trim();
      if (!reportUrlValue) return;

      const encoded = String(discordBtn?.getAttribute('data-report-message') || '');
      const reportMessage = encoded ? decodeURIComponent(encoded) : '';
      const hintEl = card.querySelector('[data-download-error-hint]');
      const originalLabel = discordBtn.innerHTML;
      let copied = false;

      if (reportMessage && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(reportMessage);
          copied = true;
        } catch {
          // noop
        }
      }

      discordBtn.innerHTML = '<i class="fas fa-check"></i> Copiado. A abrir Discord...';
      discordBtn.disabled = true;
      if (hintEl) {
        hintEl.hidden = false;
        hintEl.textContent = copied
          ? 'Mensagem copiada. No Discord, cola com Ctrl+V.'
          : 'Nao foi possivel copiar automaticamente. No Discord, descreve o erro e o jogo.';
      }

      track('click_download_error_discord', {
        game_slug: gameSlug,
        error_code: errorConfig.code
      });
      track(copied ? 'copy_download_error_report_success' : 'copy_download_error_report_failed', {
        game_slug: gameSlug,
        error_code: errorConfig.code
      });

      window.setTimeout(() => {
        discordBtn.disabled = false;
        discordBtn.innerHTML = originalLabel;
        window.location.assign(reportUrlValue);
      }, 1400);
    });

    topNotices.appendChild(card);
    track(`download_error_${errorConfig.code}`, { game_slug: gameSlug });
  }

  function handleDownloadErrorFromQuery(gameSlug, counterLabel) {
    const params = new URLSearchParams(window.location.search);
    const errorCode = String(params.get('erro') || '').trim().toLowerCase();
    const errorConfig = getErrorConfig(errorCode);
    if (!errorConfig) return false;

    // Se houve redirect de erro após incremento otimista, reverte localmente.
    if (consumeOptimisticIncrementPending(gameSlug)) {
      optimisticDecrementCounter(counterLabel);
    }

    showDownloadErrorNudge(errorConfig, gameSlug);
    clearErrorQueryParam();
    return true;
  }

  // Buscar e mostrar contador atual (sem incrementar)
  async function fetchAndDisplayCounter(gameSlug, counterLabel) {
    const counterEl = document.querySelector('.download-stats-number');
    if (!counterEl) return;

    try {
      const response = await fetch(`${API_BASE}/count?id=${encodeURIComponent(gameSlug)}`);
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
    try {
      // O worker faz redirect 302 para o ficheiro (ou 429 se limite diário for atingido).
      optimisticIncrementCounter(counterLabel);
      markOptimisticIncrementPending(gameSlug);
      const returnPath = encodeURIComponent(window.location.pathname);
      track('download_redirect_success', {
        game_slug: gameSlug,
        counter_label: counterLabel
      });
      window.location.href = `${API_BASE}/download?id=${encodeURIComponent(gameSlug)}&volta=${returnPath}`;

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
      const storedValue = parseInt(raw, 10);
      if (!Number.isFinite(storedValue)) return true;

      const now = Date.now();
      if (storedValue > now) {
        // Formato novo: timestamp absoluto para próxima exibição.
        return false;
      }

      // Formato antigo: timestamp da última interação/exibição.
      return now - storedValue > NUDGE_COOLDOWN_DEFAULT_MS;
    } catch {
      return true;
    }
  }

  function setPostDownloadNudgeCooldown(gameSlug, cooldownMs) {
    try {
      const key = getNudgeStorageKey(gameSlug);
      const now = Date.now();
      const value = now + Math.max(0, Number(cooldownMs) || 0);
      localStorage.setItem(key, String(value));
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
      setPostDownloadNudgeCooldown(gameSlug, NUDGE_COOLDOWN_DEFAULT_MS);
      removePostDownloadNudge();
    });

    discordLink.addEventListener('click', () => {
      track('click_download_post_nudge_discord', {
        game_slug: gameSlug
      });
      setPostDownloadNudgeCooldown(gameSlug, NUDGE_COOLDOWN_DISCORD_MS);
      removePostDownloadNudge();
    });

    if (feedbackLink) {
      feedbackLink.addEventListener('click', () => {
        track('click_download_post_nudge_feedback', {
          game_slug: gameSlug
        });
        setPostDownloadNudgeCooldown(gameSlug, NUDGE_COOLDOWN_FEEDBACK_MS);
        removePostDownloadNudge();
      });
    }

    document.body.appendChild(nudge);
    setPostDownloadNudgeCooldown(gameSlug, NUDGE_COOLDOWN_DEFAULT_MS);
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
    const handledError = handleDownloadErrorFromQuery(gameSlug, primaryConfig.counterLabel);
    if (!handledError) {
      clearOptimisticIncrementPending(gameSlug);
    }
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
          if (config.viaApi) {
            e.preventDefault();
          }
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
