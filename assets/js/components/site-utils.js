// Shared site helpers (tracking, slug extraction)
(function(window) {
    'use strict';

    function track(eventName, params = {}) {
        const tracker = window.SiteAnalytics && window.SiteAnalytics.track;
        if (typeof tracker === 'function') {
            tracker(eventName, params);
        }
    }

    function getGameSlug() {
        const fromDataset = (document.body?.dataset?.slug || '').trim();
        if (fromDataset) return fromDataset;

        const match = window.location.pathname.match(/\/jogo\/([^/]+)/);
        if (match) return decodeURIComponent(match[1]);
        return '';
    }

    window.SiteUtils = {
        track,
        getGameSlug
    };
})(window);
