(function(window) {
  'use strict';

  const ATTR_KEY = 'site_attr_v1';
  const PAGE_TYPES = Object.freeze({
    HOME: 'home',
    GAME: 'game',
    GUIDE: 'guide',
    OTHER: 'other'
  });

  function safeTrim(value) {
    return String(value || '').trim();
  }

  function getPathname() {
    return safeTrim(window.location.pathname) || '/';
  }

  function getPageType() {
    const path = getPathname();
    if (path === '/' || path.endsWith('/index.html')) return PAGE_TYPES.HOME;
    if (path.startsWith('/jogo/')) return PAGE_TYPES.GAME;
    if (path.startsWith('/wiki/')) return PAGE_TYPES.GUIDE;
    return PAGE_TYPES.OTHER;
  }

  function getPageSlug() {
    const fromData = safeTrim(document.body?.dataset?.slug);
    if (fromData) return fromData;

    const gameMatch = getPathname().match(/^\/jogo\/([^/]+)/);
    if (gameMatch) return decodeURIComponent(gameMatch[1]);

    const guideMatch = getPathname().match(/^\/wiki\/([^/]+)/);
    if (guideMatch) return decodeURIComponent(guideMatch[1]);

    return '';
  }

  function getGuideEntry() {
    const match = getPathname().match(/^\/wiki\/[^/]+\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : 'index';
  }

  function getGuideSlug() {
    const match = getPathname().match(/^\/wiki\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function readStoredAttribution() {
    try {
      const raw = localStorage.getItem(ATTR_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function storeAttribution(value) {
    try {
      localStorage.setItem(ATTR_KEY, JSON.stringify(value));
    } catch {
      // noop
    }
  }

  function detectAttribution() {
    const params = new URLSearchParams(window.location.search || '');
    const utmSource = safeTrim(params.get('utm_source'));
    const utmMedium = safeTrim(params.get('utm_medium'));
    const utmCampaign = safeTrim(params.get('utm_campaign'));
    const utmContent = safeTrim(params.get('utm_content'));
    const utmTerm = safeTrim(params.get('utm_term'));

    const hasUtm = !!(utmSource || utmMedium || utmCampaign || utmContent || utmTerm);
    const referrerHost = safeTrim(document.referrer ? new URL(document.referrer).hostname : '');

    if (hasUtm) {
      const fresh = {
        source: utmSource || 'direct',
        medium: utmMedium || 'unknown',
        campaign: utmCampaign || '',
        content: utmContent || '',
        term: utmTerm || '',
        referrer: referrerHost || '',
        capturedAt: new Date().toISOString()
      };
      storeAttribution(fresh);
      return fresh;
    }

    const stored = readStoredAttribution();
    if (stored) return stored;

    return {
      source: referrerHost ? 'referral' : 'direct',
      medium: referrerHost ? 'referral' : 'none',
      campaign: '',
      content: '',
      term: '',
      referrer: referrerHost || ''
    };
  }

  function getBaseContext() {
    const pageType = getPageType();
    const guideEntry = pageType === PAGE_TYPES.GUIDE ? getGuideEntry() : '';

    const attr = detectAttribution();
    return {
      page_type: pageType,
      page_slug: getPageSlug(),
      guide_slug: pageType === PAGE_TYPES.GUIDE ? getGuideSlug() : '',
      guide_entry: guideEntry,
      page_path: getPathname(),
      user_language: safeTrim(navigator.language || navigator.userLanguage || ''),
      site_language: safeTrim(document.documentElement?.lang || ''),
      traffic_source: safeTrim(attr.source),
      traffic_medium: safeTrim(attr.medium),
      traffic_campaign: safeTrim(attr.campaign),
      traffic_referrer: safeTrim(attr.referrer)
    };
  }

  function track(eventName, params = {}) {
    const name = safeTrim(eventName);
    if (!name) return;

    const payload = {
      ...getBaseContext(),
      ...params
    };

    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...payload });
    }
  }

  function trackPageView() {
    track('site_view', {
      page_title: safeTrim(document.title)
    });
  }

  window.SiteAnalytics = {
    track,
    trackPageView,
    getBaseContext
  };

  if (!window.__siteViewTracked) {
    window.__siteViewTracked = true;
    trackPageView();
  }
})(window);
