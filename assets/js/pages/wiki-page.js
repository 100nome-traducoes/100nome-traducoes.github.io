$(document).ready(function() {
    const track = (eventName, params = {}) => {
        if (window.SiteAnalytics && typeof window.SiteAnalytics.track === 'function') {
            window.SiteAnalytics.track(eventName, params);
        }
    };

    if (window.SiteShell) {
        window.SiteShell.init();
    }

    track('view_guide', {});

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

    initWikiNavGroups();

    const $wikiSearchInput = $('#wikiSearchInput');
    const $wikiSearchResults = $('#wikiSearchResults');
    let wikiIndex = null;

    if (!$wikiSearchInput.length) return;

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
            track('search_guide_input', {
                query_length: query.length,
                results_count: results.length
            });
        }
    });

    $(document).on('click', '.wiki-cta-btn', function() {
        const href = String($(this).attr('href') || '').trim();
        const isComments = href.includes('#comentarios');
        track(isComments ? 'click_guide_cta_comments' : 'click_guide_cta_game', {
            cta_location: $(this).closest('.wiki-translation-banner').length ? 'banner' : 'inline'
        });
    });

    $(document).on('click', '.wiki-search-item', function() {
        track('click_guide_search_result', {
            query_length: String($wikiSearchInput.val() || '').trim().length
        });
    });
});
