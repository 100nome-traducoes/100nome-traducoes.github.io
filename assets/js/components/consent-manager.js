(function() {
  'use strict';

  const STORAGE_KEY = 'analytics_consent_v1';
  const CONSENT_GRANTED = 'granted';
  const CONSENT_DENIED = 'denied';

  function getGaId() {
    const fromBody = document.body && document.body.dataset ? document.body.dataset.gaId : '';
    return String(fromBody || '').trim();
  }

  function readConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function writeConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // noop
    }
  }

  function applyConsent(value) {
    window.__analyticsConsent = value === CONSENT_GRANTED;
  }

  function initGtag(gaId) {
    if (!gaId) return;

    if (!document.querySelector('script[data-ga-tag]')) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
      script.setAttribute('data-ga-tag', 'true');
      document.head.appendChild(script);
    }

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = window.gtag || gtag;
    window.gtag('js', new Date());
    window.gtag('config', gaId);
  }

  function trackAfterConsent() {
    if (window.SiteAnalytics && typeof window.SiteAnalytics.trackPageView === 'function') {
      window.SiteAnalytics.trackPageView();
    }
  }

  function acceptConsent() {
    writeConsent(CONSENT_GRANTED);
    applyConsent(CONSENT_GRANTED);
    initGtag(getGaId());
    trackAfterConsent();
  }

  function denyConsent() {
    writeConsent(CONSENT_DENIED);
    applyConsent(CONSENT_DENIED);
  }

  function createBanner() {
    const banner = document.createElement('div');
    banner.className = 'consent-banner';
    banner.innerHTML = `
      <div class="consent-banner__content">
        <p>
          Usamos cookies de estatísticas para perceber como o site é usado e melhorar as traduções. Podes aceitar ou recusar.
        </p>
        <div class="consent-banner__actions">
          <button class="btn btn-primary" data-consent-accept>ACEITAR</button>
          <button class="btn btn-secondary" data-consent-deny>RECUSAR</button>
        </div>
      </div>
    `;

    banner.querySelector('[data-consent-accept]').addEventListener('click', () => {
      acceptConsent();
      banner.remove();
    });
    banner.querySelector('[data-consent-deny]').addEventListener('click', () => {
      denyConsent();
      banner.remove();
    });

    document.body.appendChild(banner);
  }

  function init() {
    const stored = readConsent();
    if (stored === CONSENT_GRANTED) {
      applyConsent(stored);
      initGtag(getGaId());
      trackAfterConsent();
      return;
    }
    if (stored === CONSENT_DENIED) {
      applyConsent(stored);
      return;
    }

    const doNotTrack = String(navigator.doNotTrack || window.doNotTrack || '').trim();
    if (doNotTrack === '1' || doNotTrack === 'yes') {
      denyConsent();
      return;
    }

    createBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
