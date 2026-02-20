(function(window, $) {
    'use strict';

    function getHomeUrl() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length > 0 && !['wiki', 'jogo'].includes(parts[0]) && !parts[0].endsWith('.html')) {
            return '/' + parts[0] + '/';
        }
        return '/';
    }

    function init(options = {}) {
        const settings = {
            enableBackToTop: true,
            enableMobileMenu: true,
            closeMenuOnOutsideClick: true,
            enableGlobalSearch: true,
            enableSmoothAnchors: true,
            smoothAnchorOffset: 80,
            ...options
        };

        const $backToTop = $('#backToTop');
        const $menuToggle = $('#menuToggle');
        const $mobileMenu = $('#mobileMenu');
        const $mobileCategories = $('#mobileCategories');
        const $mobileSubmenu = $('#mobileSubmenu');
        const $globalSearchForm = $('#search-form');
        const $globalSearchInput = $('#search-input');
        const $globalMobileSearchForm = $('#mobile-search-form');
        const $globalMobileSearchInput = $('#mobile-search-input');
        const $navbar = $('.navbar');

        function syncNavbarHeight() {
            if (!$navbar.length) return;
            const height = Math.ceil($navbar.outerHeight() || 70);
            document.documentElement.style.setProperty('--navbar-height', `${height}px`);
        }

        function updateNavbarScrollState() {
            if (!$navbar.length) return;
            const threshold = $navbar.outerHeight() || 70;
            if ($(window).scrollTop() > threshold) {
                $navbar.addClass('scrolled');
            } else {
                $navbar.removeClass('scrolled');
            }
        }

        if ($navbar.length) {
            syncNavbarHeight();
            updateNavbarScrollState();

            $(window)
                .off('scroll.siteShellNavbar')
                .on('scroll.siteShellNavbar', function() {
                    updateNavbarScrollState();
                });

            $(window)
                .off('resize.siteShellNavbar')
                .on('resize.siteShellNavbar', function() {
                    syncNavbarHeight();
                    updateNavbarScrollState();
                });
        }

        if (settings.enableBackToTop && $backToTop.length) {
            $(window)
                .off('scroll.siteShellBackToTop')
                .on('scroll.siteShellBackToTop', function() {
                    if ($(this).scrollTop() > 300) {
                        $backToTop.addClass('visible');
                    } else {
                        $backToTop.removeClass('visible');
                    }
                });

            $backToTop
                .off('click.siteShellBackToTop')
                .on('click.siteShellBackToTop', function() {
                    $('html, body').animate({ scrollTop: 0 }, 500);
                });
        }

        if (settings.enableMobileMenu && $menuToggle.length && $mobileMenu.length) {
            $menuToggle
                .off('click.siteShellMenuToggle')
                .on('click.siteShellMenuToggle', function(e) {
                    e.stopPropagation();
                    $mobileMenu.toggleClass('active');
                });

            if ($mobileCategories.length && $mobileSubmenu.length) {
                $mobileCategories
                    .off('click.siteShellSubmenu')
                    .on('click.siteShellSubmenu', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        $mobileSubmenu.stop(true, true).slideToggle(180);
                    });
            }

            if (settings.closeMenuOnOutsideClick) {
                $(document)
                    .off('click.siteShellCloseMenu')
                    .on('click.siteShellCloseMenu', function(e) {
                        const clickedInsideNav = $(e.target).closest('.nav-container').length > 0;
                        const clickedInsideMobile = $(e.target).closest('.mobile-menu').length > 0;
                        if (!clickedInsideNav && !clickedInsideMobile && $mobileMenu.hasClass('active')) {
                            $mobileMenu.removeClass('active');
                            $mobileSubmenu.stop(true, true).slideUp(120);
                        }
                    });
            }
        }

        if (settings.enableGlobalSearch && $globalSearchForm.length && $globalMobileSearchForm.length) {
            const homeUrl = getHomeUrl();
            $globalSearchForm.attr('action', homeUrl);
            $globalMobileSearchForm.attr('action', homeUrl);

            $globalSearchForm
                .off('submit.siteShellSearch')
                .on('submit.siteShellSearch', function(e) {
                    e.preventDefault();
                    const q = ($globalSearchInput.val() || '').trim();
                    if (q) window.location.href = `${homeUrl}?q=${encodeURIComponent(q)}`;
                });

            $globalMobileSearchForm
                .off('submit.siteShellMobileSearch')
                .on('submit.siteShellMobileSearch', function(e) {
                    e.preventDefault();
                    const q = ($globalMobileSearchInput.val() || '').trim();
                    if (q) window.location.href = `${homeUrl}?q=${encodeURIComponent(q)}`;
                });
        }

        if (settings.enableSmoothAnchors) {
            $(document)
                .off('click.siteShellAnchors', 'a[href^="#"]')
                .on('click.siteShellAnchors', 'a[href^="#"]', function(e) {
                    const target = $(this.getAttribute('href'));
                    if (target.length) {
                        e.preventDefault();
                        $('html, body').animate({
                            scrollTop: target.offset().top - settings.smoothAnchorOffset
                        }, 600);
                    }
                });
        }
    }

    window.SiteShell = {
        init,
        getHomeUrl
    };
})(window, jQuery);
