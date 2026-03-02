$(document).ready(function() {
    const track = (eventName, params = {}) => {
        if (window.SiteAnalytics && typeof window.SiteAnalytics.track === 'function') {
            window.SiteAnalytics.track(eventName, params);
        }
    };

    if (window.SiteShell) {
        window.SiteShell.init();
    }

    initDescricaoReadMore();
    initImageLoadingPlaceholders();
    initCarousel();
    atualizarMetadataPacoteEmTempoReal();
    initPackageIntegrityInfo();
    initInstallerPostInstallNudge();
    initCommentPrompts();
    initCommentsNudgeState();

    track('view_game', {
        game_slug: obterSlugJogoAtual()
    });


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

    function initImageLoadingPlaceholders() {
        const images = document.querySelectorAll('.game-cover, .carousel-slide img, .related-game-image');
        if (!images.length) return;

        const markLoaded = (img) => {
            img.classList.remove('img-loading');
            img.classList.add('img-loaded');
            const slide = img.closest('.carousel-slide');
            if (slide) {
                slide.classList.remove('is-image-loading');
                slide.classList.add('is-image-loaded');
            }
        };

        images.forEach(img => {
            img.classList.add('img-loading');
            const slide = img.closest('.carousel-slide');
            if (slide) {
                slide.classList.add('is-image-loading');
            }

            if (img.complete && img.naturalWidth > 0) {
                markLoaded(img);
                return;
            }

            img.addEventListener('load', () => markLoaded(img), { once: true });
            img.addEventListener('error', () => markLoaded(img), { once: true });
        });
    }

    function initCarousel() {
        const carouselTrackEl = document.getElementById('carouselTrack');
        const dotsEl = document.getElementById('carouselDots');
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');

        if (!carouselTrackEl || !dotsEl) return;

        const slides = carouselTrackEl.querySelectorAll('.carousel-slide');
        const total = slides.length;
        if (total === 0) return;

        const slidesArray = Array.from(slides);
        const slideImages = slidesArray.map((slide, index) => {
            const img = slide.querySelector('img');
            return {
                src: img?.getAttribute('src') || '',
                alt: img?.getAttribute('alt') || `Captura ${index + 1}`
            };
        });

        let current = 0;
        let autoTimer = null;
        let dragging = false;
        let dragStartX = 0;
        let dragMoved = false;
        let mouseDownSlideIndex = -1;
        let lightboxIndex = 0;

        const lightboxEl = document.createElement('div');
        lightboxEl.className = 'game-lightbox';
        lightboxEl.setAttribute('hidden', 'hidden');
        lightboxEl.innerHTML = `
            <div class="game-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Captura em tamanho completo">
                <button type="button" class="game-lightbox-close" aria-label="Fechar captura">
                    <i class="fas fa-times"></i>
                </button>
                <div class="game-lightbox-stage">
                    <img class="game-lightbox-image" alt="">
                    <div class="game-lightbox-loading" aria-hidden="true">
                        <span class="game-lightbox-loading-dot"></span>
                        <span class="game-lightbox-loading-dot"></span>
                        <span class="game-lightbox-loading-dot"></span>
                    </div>
                    <button type="button" class="game-lightbox-nav game-lightbox-prev" aria-label="Captura anterior">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button type="button" class="game-lightbox-nav game-lightbox-next" aria-label="Captura seguinte">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <p class="game-lightbox-caption"></p>
            </div>
        `;
        document.body.appendChild(lightboxEl);

        const lightboxImage = lightboxEl.querySelector('.game-lightbox-image');
        const lightboxCaption = lightboxEl.querySelector('.game-lightbox-caption');
        let lightboxSwitchTimer = null;

        const updateLightbox = (animate = true) => {
            const item = slideImages[lightboxIndex];
            if (!item) return;
            lightboxCaption.textContent = `${lightboxIndex + 1} / ${total}`;

            if (!animate || !lightboxImage.src) {
                lightboxEl.classList.add('is-loading');
                lightboxImage.src = item.src;
                lightboxImage.alt = item.alt;
                return;
            }

            lightboxEl.classList.add('is-loading');
            lightboxImage.classList.add('is-switching');
            if (lightboxSwitchTimer) {
                window.clearTimeout(lightboxSwitchTimer);
            }
            lightboxSwitchTimer = window.setTimeout(() => {
                lightboxImage.src = item.src;
                lightboxImage.alt = item.alt;
                lightboxSwitchTimer = null;
            }, 80);
        };

        const closeLightbox = () => {
            if (lightboxSwitchTimer) {
                window.clearTimeout(lightboxSwitchTimer);
                lightboxSwitchTimer = null;
            }
            lightboxEl.classList.remove('is-open');
            lightboxEl.setAttribute('hidden', 'hidden');
            document.body.classList.remove('modal-open');
            document.removeEventListener('keydown', onLightboxKeydown);
        };

        const openLightbox = (index) => {
            lightboxIndex = (index + total) % total;
            updateLightbox(false);
            lightboxEl.removeAttribute('hidden');
            window.requestAnimationFrame(() => {
                lightboxEl.classList.add('is-open');
            });
            document.body.classList.add('modal-open');
            document.addEventListener('keydown', onLightboxKeydown);
            track('open_game_screenshot', {
                game_slug: obterSlugJogoAtual(),
                screenshot_index: lightboxIndex + 1
            });
        };

        const stepLightbox = (step) => {
            lightboxIndex = (lightboxIndex + step + total) % total;
            updateLightbox(true);
        };

        const onLightboxKeydown = (event) => {
            if (event.key === 'Escape') closeLightbox();
            if (event.key === 'ArrowLeft') stepLightbox(-1);
            if (event.key === 'ArrowRight') stepLightbox(1);
        };

        slides.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', 'Captura ' + (i + 1));
            dot.addEventListener('click', () => goTo(i));
            dotsEl.appendChild(dot);
        });

        lightboxEl.querySelector('.game-lightbox-close').addEventListener('click', closeLightbox);
        lightboxEl.querySelector('.game-lightbox-prev').addEventListener('click', () => stepLightbox(-1));
        lightboxEl.querySelector('.game-lightbox-next').addEventListener('click', () => stepLightbox(1));
        lightboxImage.addEventListener('load', () => {
            lightboxImage.classList.remove('is-switching');
            lightboxEl.classList.remove('is-loading');
        });
        lightboxImage.addEventListener('error', () => {
            lightboxImage.classList.remove('is-switching');
            lightboxEl.classList.remove('is-loading');
        });
        lightboxEl.addEventListener('click', (event) => {
            if (event.target === lightboxEl) closeLightbox();
        });

        function render(offset) {
            if (typeof offset === 'number') {
                carouselTrackEl.style.transform = `translateX(calc(-${current * 100}% + ${offset}px))`;
            } else {
                carouselTrackEl.style.transform = `translateX(-${current * 100}%)`;
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

        carouselTrackEl.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            dragging = true;
            dragMoved = false;
            dragStartX = e.clientX;
            const slideEl = e.target.closest('.carousel-slide');
            mouseDownSlideIndex = slideEl ? slidesArray.indexOf(slideEl) : -1;
            carouselTrackEl.classList.add('is-dragging');
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
            carouselTrackEl.classList.remove('is-dragging');
            const diff = e.clientX - dragStartX;
            if (dragMoved && Math.abs(diff) > 50) {
                goTo(current + (diff < 0 ? 1 : -1));
            } else {
                render();
                resetAuto();
                if (mouseDownSlideIndex >= 0) {
                    openLightbox(mouseDownSlideIndex);
                }
            }
            mouseDownSlideIndex = -1;
        });

        let touchStartX = 0;
        let touchStartY = 0;
        let touchMoved = false;
        let touchMode = null; // 'horizontal' | 'vertical' | null
        let touchStartSlideIndex = -1;

        carouselTrackEl.addEventListener('touchstart', e => {
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchMoved = false;
            touchMode = null;
            const slideEl = e.target.closest('.carousel-slide');
            touchStartSlideIndex = slideEl ? slidesArray.indexOf(slideEl) : -1;
            clearInterval(autoTimer);
        }, { passive: true });

        carouselTrackEl.addEventListener('touchmove', e => {
            const touch = e.touches[0];
            const diffX = touch.clientX - touchStartX;
            const diffY = touch.clientY - touchStartY;

            if (touchMode === null) {
                if (Math.abs(diffX) < 8 && Math.abs(diffY) < 8) return;
                touchMode = Math.abs(diffX) > Math.abs(diffY) ? 'horizontal' : 'vertical';
            }

            if (touchMode === 'horizontal') {
                touchMoved = true;
                // Captura gesto horizontal para evitar scroll vertical simultâneo.
                e.preventDefault();
                render(diffX);
            }
        }, { passive: false });

        carouselTrackEl.addEventListener('touchend', e => {
            const diff = e.changedTouches[0].clientX - touchStartX;
            if (touchMode === 'horizontal' && Math.abs(diff) > 50) {
                goTo(current + (diff < 0 ? 1 : -1));
            } else {
                render();
                resetAuto();
                if (!touchMoved && touchStartSlideIndex >= 0) {
                    openLightbox(touchStartSlideIndex);
                }
            }
            touchStartSlideIndex = -1;
            touchMode = null;
        });

        const carouselEl = carouselTrackEl.closest('.carousel-wrap');
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

    function formatarDataPt(dataIso) {
        if (!dataIso) return '';
        const data = new Date(dataIso);
        if (Number.isNaN(data.getTime())) return '';
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const dia = String(data.getUTCDate()).padStart(2, '0');
        const mes = meses[data.getUTCMonth()];
        const ano = data.getUTCFullYear();
        return `${dia} ${mes} ${ano}`;
    }

    async function atualizarMetadataPacoteEmTempoReal() {
        const slug = obterSlugJogoAtual();
        if (!slug) return;

        const $version = $('[data-package-version]').first();
        const $date = $('[data-package-last-modified]').first();
        if (!$version.length && !$date.length) return;

        try {
            const response = await fetch(`/.netlify/functions/package-metadata?slug=${encodeURIComponent(slug)}`);
            if (!response.ok) return;

            const data = await response.json();
            if (typeof data?.packageVersion === 'string' && data.packageVersion.trim()) {
                $version.text(`v${data.packageVersion.trim()}`);
            }

            const dataPt = formatarDataPt(data?.packageLastModified || '');
            if (dataPt) {
                $date.text(dataPt);
            }
        } catch {
            // fallback silencioso
        }
    }

    function initCommentPrompts() {
        const chips = document.querySelectorAll('[data-copy-comment]');
        if (!chips.length) return;

        chips.forEach(chip => {
            chip.addEventListener('click', async () => {
                const text = chip.getAttribute('data-copy-comment') || '';
                if (!text) return;

                try {
                    await navigator.clipboard.writeText(text);
                    chip.classList.add('is-copied');
                    const original = chip.innerHTML;
                    chip.innerHTML = '<i class="fas fa-check"></i> Copiado';
                    window.setTimeout(() => {
                        chip.classList.remove('is-copied');
                        chip.innerHTML = original;
                    }, 1400);
                    track('click_game_comment_prompt_copy', {
                        game_slug: obterSlugJogoAtual()
                    });
                } catch {
                    // fallback silencioso
                }
            });
        });
    }

    function initPackageIntegrityInfo() {
        const toggles = document.querySelectorAll('[data-integrity-toggle]');
        if (!toggles.length) return;

        toggles.forEach(toggle => {
            const container = toggle.closest('div');
            if (!container) return;
            const panel = container.querySelector('[data-integrity-panel]');
            if (!panel) return;

            toggle.addEventListener('click', () => {
                const expanded = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', String(!expanded));
                panel.hidden = expanded;
            });

            const copyBtn = panel.querySelector('[data-copy-hash]');
            if (!copyBtn) return;

            copyBtn.addEventListener('click', async () => {
                const hash = copyBtn.getAttribute('data-copy-hash') || '';
                if (!hash) return;

                try {
                    await navigator.clipboard.writeText(hash);
                    copyBtn.classList.add('is-copied');
                    copyBtn.textContent = 'Copiado';
                    window.setTimeout(() => {
                        copyBtn.classList.remove('is-copied');
                        copyBtn.textContent = 'Copiar hash';
                    }, 1500);
                } catch {
                    // fallback silencioso
                }
            });
        });
    }

    function initInstallerPostInstallNudge() {
        const params = new URLSearchParams(window.location.search);
        const source = String(params.get('source') || '').trim().toLowerCase();
        const installed = String(params.get('installed') || '').trim() === '1';
        const played = String(params.get('played') || '').trim() === '1';
        const os = String(params.get('os') || '').trim().toLowerCase();

        if (source !== 'installer') return;
        if (!installed && !played) return;

        const commentsSection = document.getElementById('comentarios');
        const gamePage = document.querySelector('.game-page');
        const gameHeader = document.querySelector('.game-header');
        if (!commentsSection || !gamePage || !gameHeader) return;

        const guideHref = document.querySelector('.btn-guide-inline')?.getAttribute('href')
            || document.querySelector('.btn-guide-primary')?.getAttribute('href')
            || '';

        const card = document.createElement('div');
        card.className = 'installer-top-nudge installer-post-nudge';

        const title = played
            ? 'Tradução aplicada. Como correu no jogo?'
            : 'Instalação concluída.';

        const message = played
            ? 'Partilha feedback rápido para melhorar as próximas versões.'
            : 'Inicia o jogo para confirmar que tudo ficou em português. Se algo falhar, usa os canais de apoio abaixo.';

        const osLabel = os ? ` · ${os}` : '';
        card.innerHTML = `
            <div class="installer-post-nudge-head">
                <i class="fas fa-circle-check" aria-hidden="true"></i>
                <div>
                    <p class="installer-post-nudge-title">${title}</p>
                    <p class="installer-post-nudge-text">${message}</p>
                    <p class="installer-post-nudge-meta">Origem: instalador${osLabel}</p>
                </div>
            </div>
            <div class="installer-post-nudge-actions">
                ${guideHref ? `<a href="${guideHref}" class="btn btn-secondary btn-guide-inline" data-installer-cta="guide"><i class="fas fa-book-open"></i> Guia da Tradução</a>` : ''}
                <button type="button" class="btn btn-secondary" data-installer-cta="comment">
                    <i class="fab fa-github"></i> Comentar (GitHub)
                </button>
                <a href="https://discord.gg/Xv7ax2VkEp" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-discord-primary" data-installer-cta="discord">
                    <i class="fab fa-discord"></i> Feedback no Discord
                </a>
            </div>
            <p class="installer-post-nudge-note">Para comentar no site é necessária sessão GitHub (Giscus).</p>
        `;

        gameHeader.insertAdjacentElement('afterend', card);

        const scrollToCommentsNudge = () => {
            commentsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        };

        track('show_installer_post_nudge', {
            game_slug: obterSlugJogoAtual(),
            installed: installed ? '1' : '0',
            played: played ? '1' : '0',
            os: os || 'unknown'
        });

        card.querySelectorAll('[data-installer-cta]').forEach(cta => {
            cta.addEventListener('click', (event) => {
                track('click_installer_post_nudge_cta', {
                    game_slug: obterSlugJogoAtual(),
                    cta_type: cta.getAttribute('data-installer-cta') || 'unknown',
                    os: os || 'unknown'
                });

                if (cta.getAttribute('data-installer-cta') === 'comment') {
                    if (typeof cta.blur === 'function') cta.blur();
                    scrollToCommentsNudge();
                }
            });
        });

    }

    function initCommentsNudgeState() {
        const nudge = document.querySelector('[data-comments-nudge]');
        const note = document.querySelector('[data-comments-empty-note]');
        const firstCommentCta = document.querySelector('[data-first-comment-cta]');
        if (!nudge || !note) return;

        const markDiscussionActive = () => {
            note.innerHTML = '<strong>Discussão ativa.</strong> Partilha também o teu feedback para ajudar nas próximas melhorias.';
            if (firstCommentCta) {
                firstCommentCta.textContent = 'Adicionar comentário';
            }
        };

        const getCountFromDiscussion = (discussion) => {
            if (!discussion || typeof discussion !== 'object') return null;
            const countCandidate = discussion.totalCommentCount ?? discussion.commentCount ?? discussion.commentsCount;
            return typeof countCandidate === 'number' ? countCandidate : null;
        };

        window.addEventListener('message', (event) => {
            if (event.origin !== 'https://giscus.app') return;
            const payload = event.data;
            if (!payload || typeof payload !== 'object' || !payload.giscus) return;

            const discussion = payload.giscus.discussion;
            if (!discussion) return;

            const count = getCountFromDiscussion(discussion);
            if (count === null) {
                if (discussion.id || discussion.url) {
                    markDiscussionActive();
                }
                return;
            }

            if (count > 0) {
                markDiscussionActive();
                track('discussion_active_detected', {
                    game_slug: obterSlugJogoAtual(),
                    comments_count: count
                });
            }
        });
    }

    $(document).on('click', '.btn-guide-primary, .btn-guide-inline', function() {
        track('click_guide_cta', {
            game_slug: obterSlugJogoAtual(),
            cta_location: $(this).hasClass('btn-guide-primary') ? 'header' : 'download_section',
            cta_target: 'guide_page',
            cta_context: 'game_page'
        });
    });

    $(document).on('click', '.game-sidebar a[href*="discord.gg"]', function() {
        track('click_game_discord', {
            game_slug: obterSlugJogoAtual(),
            cta_location: 'sidebar'
        });
    });

});
