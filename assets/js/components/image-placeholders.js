// Shared image loading placeholder helper
(function(window) {
    'use strict';

    function init(options = {}) {
        const selector = String(options.selector || '').trim();
        if (!selector) return;

        const images = document.querySelectorAll(selector);
        if (!images.length) return;

        const loadingClass = options.loadingClass || '';
        const loadedClass = options.loadedClass || '';
        const onInit = typeof options.onInit === 'function' ? options.onInit : null;
        const onLoad = typeof options.onLoad === 'function' ? options.onLoad : null;

        const markLoaded = (img) => {
            if (loadingClass) img.classList.remove(loadingClass);
            if (loadedClass) img.classList.add(loadedClass);
            if (onLoad) onLoad(img);
        };

        images.forEach((img) => {
            if (loadingClass) img.classList.add(loadingClass);
            if (onInit) onInit(img);

            if (img.complete && img.naturalWidth > 0) {
                markLoaded(img);
                return;
            }

            img.addEventListener('load', () => markLoaded(img), { once: true });
            img.addEventListener('error', () => markLoaded(img), { once: true });
        });
    }

    window.SiteImagePlaceholders = {
        init
    };
})(window);
