$(document).ready(function() {
    if (window.SiteShell) {
        window.SiteShell.init();
    }

    initDescricaoReadMore();
    initCarousel();
    atualizarDownloadsEmTempoReal();


    function initDescricaoReadMore() {
        const desc = document.getElementById('gpDesc');
        const btn = document.getElementById('gpReadMore');
        if (!desc || !btn) return;

        const updateVisibility = () => {
            const isTruncated = desc.scrollHeight > desc.clientHeight + 4;
            btn.classList.toggle('visible', isTruncated || desc.classList.contains('expanded'));
        };

        window.requestAnimationFrame(updateVisibility);
        window.addEventListener('resize', updateVisibility);

        btn.addEventListener('click', function() {
            const expanded = this.getAttribute('aria-expanded') === 'true';
            desc.classList.toggle('expanded', !expanded);
            this.setAttribute('aria-expanded', String(!expanded));
            this.innerHTML = expanded
                ? 'Ler mais <i class="fas fa-chevron-down"></i>'
                : 'Ler menos <i class="fas fa-chevron-up"></i>';
        });
    }

    function initCarousel() {
        const track = document.getElementById('carouselTrack');
        const dotsEl = document.getElementById('carouselDots');
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');

        if (!track || !dotsEl) return;

        const slides = track.querySelectorAll('.carousel-slide');
        const total = slides.length;
        if (total === 0) return;

        let current = 0;
        let autoTimer = null;
        let dragging = false;
        let dragStartX = 0;
        let dragMoved = false;

        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', 'Captura ' + (i + 1));
            dot.addEventListener('click', () => goTo(i));
            dotsEl.appendChild(dot);
        });

        function render(offset) {
            if (typeof offset === 'number') {
                track.style.transform = `translateX(calc(-${current * 100}% + ${offset}px))`;
            } else {
                track.style.transform = `translateX(-${current * 100}%)`;
            }

            dotsEl.querySelectorAll('.carousel-dot').forEach((dot, i) => {
                dot.classList.toggle('active', i === current);
            });
        }

        function goTo(index) {
            current = (index + total) % total;
            render();
            resetAuto();
        }

        function resetAuto() {
            clearInterval(autoTimer);
            autoTimer = setInterval(() => goTo(current + 1), 5500);
        }

        if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

        track.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            dragging = true;
            dragMoved = false;
            dragStartX = e.clientX;
            track.classList.add('is-dragging');
            clearInterval(autoTimer);
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            const diff = e.clientX - dragStartX;
            if (Math.abs(diff) > 4) dragMoved = true;
            render(diff);
        });

        document.addEventListener('mouseup', e => {
            if (!dragging) return;
            dragging = false;
            track.classList.remove('is-dragging');
            const diff = e.clientX - dragStartX;
            if (dragMoved && Math.abs(diff) > 50) {
                goTo(current + (diff < 0 ? 1 : -1));
            } else {
                render();
                resetAuto();
            }
        });

        let touchStartX = 0;

        track.addEventListener('touchstart', e => {
            touchStartX = e.touches[0].clientX;
            clearInterval(autoTimer);
        }, { passive: true });

        track.addEventListener('touchmove', e => {
            const diff = e.touches[0].clientX - touchStartX;
            render(diff);
        }, { passive: true });

        track.addEventListener('touchend', e => {
            const diff = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(diff) > 50) {
                goTo(current + (diff < 0 ? 1 : -1));
            } else {
                render();
                resetAuto();
            }
        });

        const carouselEl = track.closest('.carousel-wrap');
        if (carouselEl) {
            carouselEl.setAttribute('tabindex', '0');
            carouselEl.addEventListener('mouseenter', () => clearInterval(autoTimer));
            carouselEl.addEventListener('mouseleave', () => {
                if (!dragging) resetAuto();
            });
            carouselEl.addEventListener('keydown', e => {
                if (e.key === 'ArrowLeft') goTo(current - 1);
                if (e.key === 'ArrowRight') goTo(current + 1);
            });
        }

        render();
        resetAuto();
    }

    function obterSlugJogoAtual() {
        const fromDataset = (
            document.body?.dataset?.slug ||
            document.querySelector('.game-page')?.dataset?.slug ||
            ''
        ).trim();
        if (fromDataset) return fromDataset;

        const match = window.location.pathname.match(/\/jogo\/([^/]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    }

    function formatarNumero(numero) {
        return new Intl.NumberFormat('pt-PT').format(numero);
    }

    function atualizarDownloadsEmTempoReal() {
        const slug = obterSlugJogoAtual();
        const $counter = $('.download-stats-number').first();
        if (!slug || !$counter.length) return;

        $.ajax({
            url: '../../data/game-content/downloads.json',
            method: 'GET',
            dataType: 'json',
            cache: false,
            success: function(data) {
                const downloads = data?.[slug]?.downloads;
                if (typeof downloads === 'number') {
                    $counter.text(`${formatarNumero(downloads)} descargas`);
                    $counter.css('display', '');
                }
            }
        });
    }

});
