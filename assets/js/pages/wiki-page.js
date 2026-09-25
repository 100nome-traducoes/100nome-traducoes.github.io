$(document).ready(function() {
    const track = window.SiteUtils?.track || (() => {});

    if (window.SiteShell) {
        window.SiteShell.init();
    }

    track('view_guide_page', {});
    initWikiImageLoadingPlaceholders();
    initWikiSectionCollapsing();
    initTableOverflowCues();

    function initWikiNavGroups() {
        const $groups = $('.wiki-nav-group[data-nav-group]');
        const $expandAllBtn = $('[data-wiki-nav-expand-all]');

        if ($groups.length < 2) {
            $expandAllBtn.hide();
        }
        if (!$groups.length) return;

        const setGroupState = ($group, isOpen) => {
            const $toggle = $group.find('.wiki-nav-group-toggle').first();
            const $list = $group.children('.wiki-nav-list').first();

            $group.toggleClass('is-open', isOpen);
            $toggle.attr('aria-expanded', String(isOpen));
            if (isOpen) {
                $list.removeAttr('hidden');
            } else {
                $list.attr('hidden', 'hidden');
            }
        };

        const updateExpandAllLabel = () => {
            if (!$expandAllBtn.length) return;
            const totalGroups = $groups.length;
            const openGroups = $groups.filter('.is-open').length;
            const allOpen = totalGroups > 0 && openGroups === totalGroups;
            $expandAllBtn.text(allOpen ? 'Recolher' : 'Mostrar tudo');
            $expandAllBtn.attr('aria-expanded', String(allOpen));
        };

        $groups.each(function() {
            const $group = $(this);
            const $toggle = $group.find('.wiki-nav-group-toggle').first();
            const isOpen = $group.hasClass('is-open') || $toggle.attr('aria-expanded') === 'true';

            setGroupState($group, isOpen);

            $toggle.on('click', function() {
                const nextOpen = !$group.hasClass('is-open');
                setGroupState($group, nextOpen);
                updateExpandAllLabel();
            });
        });

        $expandAllBtn.on('click', function() {
            const allOpen = $groups.filter('.is-open').length === $groups.length;
            $groups.each(function() {
                setGroupState($(this), !allOpen);
            });
            updateExpandAllLabel();
        });

        updateExpandAllLabel();
    }

    function initWikiSectionCollapsing() {
        const $wikiContent = $('.wiki-content');
        if (!$wikiContent.length) return;

        const $sectionTitles = $wikiContent.children('.wiki-section-title');
        if (!$sectionTitles.length) return;

        $sectionTitles.each(function(index) {
            const $title = $(this);
            const sectionId = $title.attr('id') || `wiki-section-${index + 1}`;
            const bodyId = `${sectionId}-body`;
            const $sectionBody = $('<div class="wiki-section-body"></div>');

            let $cursor = $title.next();
            while ($cursor.length && !$cursor.hasClass('wiki-section-title')) {
                const $next = $cursor.next();
                $sectionBody.append($cursor);
                $cursor = $next;
            }

            if (!$sectionBody.children().length) return;

            $sectionBody.attr('id', bodyId);
            $sectionBody.insertAfter($title);

            const $toggle = $(`
                <button type="button" class="wiki-section-toggle" aria-expanded="true" aria-controls="${bodyId}" aria-label="Ocultar secção">
                    <i class="mdi mdi-chevron-up" aria-hidden="true"></i>
                </button>
            `);

            $toggle.on('click', function() {
                const isExpanded = $toggle.attr('aria-expanded') === 'true';
                const nextExpanded = !isExpanded;
                $toggle.attr('aria-expanded', String(nextExpanded));
                $toggle.attr('aria-label', nextExpanded ? 'Ocultar secção' : 'Mostrar secção');
                $toggle.find('i').toggleClass('mdi-chevron-up', nextExpanded).toggleClass('mdi-chevron-down', !nextExpanded);
                $sectionBody.prop('hidden', !nextExpanded);
            });

            $title.append($toggle);
        });
    }

    function initMobileContentsJump() {
        const $fab = $('#wikiMobileContentsJump');
        const $contentsNav = $('.wiki-nav').first();
        if (!$fab.length || !$contentsNav.length) return;

        const mobileQuery = window.matchMedia('(max-width: 768px)');

        const updateJumpVisibility = () => {
            if (!mobileQuery.matches) {
                $fab.removeClass('is-visible');
                return;
            }

            const hasScrolledEnough = window.scrollY > 280;
            const navRect = $contentsNav[0].getBoundingClientRect();
            const navVisible = navRect.top < window.innerHeight && navRect.bottom > 70;
            $fab.toggleClass('is-visible', hasScrolledEnough && !navVisible);
        };

        $fab.on('click', function() {
            $contentsNav[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
        });

        $(window).on('scroll resize', updateJumpVisibility);
        if (typeof mobileQuery.addEventListener === 'function') {
            mobileQuery.addEventListener('change', updateJumpVisibility);
        } else if (typeof mobileQuery.addListener === 'function') {
            mobileQuery.addListener(updateJumpVisibility);
        }

        updateJumpVisibility();
    }

    function initTableOverflowCues() {
        const wrappers = Array.from(document.querySelectorAll('.translation-table-wrapper'));
        if (!wrappers.length) return;

        const activeAutoScroll = new Map();
        const activeDirection = new Map();
        const edgeZone = 24;
        const speed = 0.5; // px per ms

        const stopAutoScroll = (wrapper) => {
            const rafId = activeAutoScroll.get(wrapper);
            if (rafId) {
                cancelAnimationFrame(rafId);
                activeAutoScroll.delete(wrapper);
            }
            activeDirection.delete(wrapper);
        };

        const startAutoScroll = (wrapper, scrollEl, direction) => {
            if (activeDirection.get(wrapper) === direction && activeAutoScroll.get(wrapper)) {
                return;
            }
            stopAutoScroll(wrapper);
            activeDirection.set(wrapper, direction);
            let last = performance.now();
            const step = (now) => {
                const dt = now - last;
                last = now;
                scrollEl.scrollLeft += direction * speed * dt;
                updateWrapperState(wrapper);
                activeAutoScroll.set(wrapper, requestAnimationFrame(step));
            };
            activeAutoScroll.set(wrapper, requestAnimationFrame(step));
        };

        const getScrollEl = (wrapper) => wrapper.querySelector('.translation-table-scroll') || wrapper;

        const updateWrapperState = (wrapper) => {
            const scrollEl = getScrollEl(wrapper);
            const hasOverflow = scrollEl.scrollWidth - scrollEl.clientWidth > 1;
            wrapper.classList.toggle('is-overflowing', hasOverflow);

            if (!hasOverflow) {
                wrapper.style.setProperty('--peek-left', '0');
                wrapper.style.setProperty('--peek-right', '0');
                return;
            }

            const maxScroll = Math.max(1, scrollEl.scrollWidth - scrollEl.clientWidth);
            const leftProgress = Math.min(1, Math.max(0, scrollEl.scrollLeft / maxScroll));
            const rightProgress = Math.min(1, Math.max(0, (maxScroll - scrollEl.scrollLeft) / maxScroll));
            wrapper.style.setProperty('--peek-left', leftProgress.toFixed(3));
            wrapper.style.setProperty('--peek-right', rightProgress.toFixed(3));
        };

        wrappers.forEach((wrapper) => {
            updateWrapperState(wrapper);
            const scrollEl = getScrollEl(wrapper);
            scrollEl.addEventListener('scroll', () => updateWrapperState(wrapper), { passive: true });

            wrapper.addEventListener('mousemove', (event) => {
                const scrollElLocal = getScrollEl(wrapper);
                const maxScroll = scrollElLocal.scrollWidth - scrollElLocal.clientWidth;
                if (maxScroll <= 1) {
                    stopAutoScroll(wrapper);
                    return;
                }
                const rect = wrapper.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const atStart = scrollElLocal.scrollLeft <= 1;
                const atEnd = scrollElLocal.scrollLeft + scrollElLocal.clientWidth >= scrollElLocal.scrollWidth - 1;
                if (x <= edgeZone && !atStart) {
                    startAutoScroll(wrapper, scrollElLocal, -1);
                    return;
                }
                if (x >= rect.width - edgeZone && !atEnd) {
                    startAutoScroll(wrapper, scrollElLocal, 1);
                    return;
                }
                stopAutoScroll(wrapper);
            });

            wrapper.addEventListener('mouseleave', () => stopAutoScroll(wrapper));
        });

        window.addEventListener('resize', () => {
            wrappers.forEach(updateWrapperState);
        });

        setTimeout(() => {
            wrappers.forEach(updateWrapperState);
        }, 80);
    }

    initWikiNavGroups();
    initMobileContentsJump();

    const $wikiSearchInput = $('#wikiSearchInput');
    const $wikiSearchResults = $('#wikiSearchResults');
    let wikiIndex = null;

    if (!$wikiSearchInput.length) return;

    function initWikiImageLoadingPlaceholders() {
        if (!window.SiteImagePlaceholders) return;
        window.SiteImagePlaceholders.init({
            selector: '.wiki-content img, .wiki-cover img, .table-image',
            loadingClass: 'wiki-img-loading',
            loadedClass: 'wiki-img-loaded'
        });
    }

    const wikiBase = document.body?.dataset?.wikiBase || window.location.pathname.replace(/\/[^/]*$/, '');
    fetch(`${wikiBase}/search-index.json`)
        .then(res => res.json())
        .then(data => {
            wikiIndex = data;
        })
        .catch(() => {
            wikiIndex = [];
        });

    $wikiSearchInput.on('input', function() {
        const query = $(this).val().trim().toLowerCase();
        if (!query) {
            $wikiSearchResults.empty();
            return;
        }

        if (!wikiIndex) return;

        const results = wikiIndex
            .filter(item => {
                const haystack = `${item.title} ${item.headings.join(' ')} ${item.text}`.toLowerCase();
                return haystack.includes(query);
            })
            .slice(0, 10);

        if (!results.length) {
            $wikiSearchResults.html('<div class="wiki-search-empty">Sem resultados</div>');
            return;
        }

        const html = results
            .map(r => `
                <a class="wiki-search-item" href="${r.filename}">
                    <strong>${r.title}</strong>
                    <span>${r.headings.slice(0, 3).join(' · ')}</span>
                </a>
            `)
            .join('');

        $wikiSearchResults.html(html);

        if (query.length >= 2) {
            track('input_guide_search', {
                query_length: query.length,
                results_count: results.length
            });
        }
    });

    $(document).on('click', '.wiki-cta-btn', function() {
        const href = String($(this).attr('href') || '').trim();
        const isComments = href.includes('#comentarios');
        track('click_guide_cta', {
            cta_location: $(this).closest('.wiki-translation-banner').length ? 'banner' : 'inline',
            cta_target: isComments ? 'comments' : 'game_page'
        });
    });

    $(document).on('click', '.wiki-search-item', function() {
        track('click_guide_search_result', {
            query_length: String($wikiSearchInput.val() || '').trim().length
        });
    });
});
