$(document).ready(function() {
    if (window.SiteShell) {
        window.SiteShell.init();
    }

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
    });
});
