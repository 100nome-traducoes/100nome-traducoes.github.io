(function() {
    const revealSelector = '[data-reveal]';
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setVisible(el) {
        el.classList.add('is-visible');
    }

    function initReveals(root) {
        const scope = root || document;
        const items = Array.from(scope.querySelectorAll(revealSelector));
        if (!items.length) return;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

        items.forEach((el) => {
            const delay = Number(el.dataset.revealDelay || 0);
            if (!Number.isNaN(delay) && delay > 0) {
                el.style.setProperty('--reveal-delay', `${delay}ms`);
            }
        });

        if (reduceMotion || !('IntersectionObserver' in window)) {
            items.forEach(setVisible);
            return;
        }

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                setVisible(entry.target);
                obs.unobserve(entry.target);
            });
        }, {
            threshold: 0.01,
            rootMargin: '0px 0px -4% 0px'
        });

        items.forEach((el) => {
            if (el.classList.contains('is-visible')) return;

            const rect = el.getBoundingClientRect();
            const startsInView = rect.top < viewportHeight * 0.95 && rect.bottom > 0;
            if (startsInView) {
                setVisible(el);
                return;
            }

            observer.observe(el);
        });
    }

    window.SiteMotion = {
        init: initReveals,
        refresh: initReveals
    };

    document.addEventListener('DOMContentLoaded', function() {
        initReveals(document);
    });
})();
