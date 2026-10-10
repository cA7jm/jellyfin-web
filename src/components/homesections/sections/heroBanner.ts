// CJ7 Stream: banner destacado arriba del Home.
// Muestra películas/series al azar con su fondo, logo o título, sinopsis y botones,
// rotando solo cada ROTATION_SECONDS segundos.
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import escapeHtml from 'escape-html';
import type { ApiClient } from 'jellyfin-apiclient';

import { playbackManager } from 'components/playback/playbackmanager';
import { appRouter } from 'components/router/appRouter';

import './heroBanner.scss';

/** Segundos que se queda cada película antes de pasar a la siguiente. */
const ROTATION_SECONDS = 7;
/** Cuántas películas/series rotan en el banner. */
const MAX_ITEMS = 8;

function getMetaHtml(item: BaseItemDto) {
    const parts: string[] = [];
    if (item.CommunityRating) {
        parts.push('<span class="cj7Hero-rating">★ ' + item.CommunityRating.toFixed(1) + '</span>');
    }
    if (item.ProductionYear) {
        parts.push(String(item.ProductionYear));
    }
    if (item.Type === 'Series') {
        parts.push('Serie');
    }
    if (item.Genres?.length) {
        parts.push(escapeHtml(item.Genres.slice(0, 3).join(', ')));
    }
    return parts.join(' · ');
}

function getSlideHtml(item: BaseItemDto, index: number, apiClient: ApiClient) {
    const backdropUrl = apiClient.getImageUrl(item.Id || '', {
        type: 'Backdrop',
        tag: item.BackdropImageTags?.[0],
        maxWidth: 1920,
        quality: 85
    });
    const name = escapeHtml(item.Name || '');
    const logoTag = item.ImageTags?.Logo;

    let titleHtml;
    if (logoTag) {
        const logoUrl = apiClient.getImageUrl(item.Id || '', { type: 'Logo', tag: logoTag, maxWidth: 600 });
        titleHtml = '<img class="cj7Hero-logo" src="' + logoUrl + '" alt="' + name + '" loading="lazy" />';
    } else {
        titleHtml = '<h2 class="cj7Hero-title">' + name + '</h2>';
    }

    let html = '<div class="cj7Hero-slide' + (index === 0 ? ' is-active' : '') + '" data-index="' + index + '">';
    html += '<div class="cj7Hero-bg" style="background-image:url(\'' + backdropUrl + '\')"></div>';
    html += '<div class="cj7Hero-shade"></div>';
    html += '<div class="cj7Hero-content">';
    html += titleHtml;
    html += '<div class="cj7Hero-meta">' + getMetaHtml(item) + '</div>';
    if (item.Overview) {
        html += '<p class="cj7Hero-overview">' + escapeHtml(item.Overview) + '</p>';
    }
    html += '<div class="cj7Hero-actions">';
    html += '<button is="emby-button" type="button" class="raised cj7Hero-play" data-id="' + item.Id + '">';
    html += '<span class="material-icons play_arrow" aria-hidden="true"></span><span>Reproducir</span></button>';
    html += '<a is="emby-linkbutton" class="raised emby-button cj7Hero-info" href="' + appRouter.getRouteUrl(item) + '">';
    html += '<span class="material-icons info_outline" aria-hidden="true"></span><span>Más información</span></a>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    return html;
}

function startRotation(elem: HTMLElement, count: number) {
    if (count < 2) return;

    let current = 0;
    let hovering = false;
    let timer: number | undefined;

    const slides = elem.querySelectorAll<HTMLElement>('.cj7Hero-slide');
    const dots = elem.querySelectorAll<HTMLElement>('.cj7Hero-dot');

    const show = (index: number) => {
        slides[current]?.classList.remove('is-active');
        dots[current]?.classList.remove('is-active');
        current = (index + count) % count;
        slides[current]?.classList.add('is-active');
        dots[current]?.classList.add('is-active');
    };

    const tick = () => {
        // El Home se destruyó (cerrar sesión, cambio de ajustes): parar
        if (!elem.isConnected) {
            window.clearInterval(timer);
            return;
        }
        // No rotar si el Home no se está viendo (estás en otra página o viendo un video)
        if (hovering || document.hidden || elem.offsetParent === null) return;
        show(current + 1);
    };

    const restart = () => {
        window.clearInterval(timer);
        timer = window.setInterval(tick, ROTATION_SECONDS * 1000);
    };

    elem.addEventListener('mouseenter', () => { hovering = true; });
    elem.addEventListener('mouseleave', () => { hovering = false; });

    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            show(Number(dot.dataset.index));
            restart();
        });
    });

    restart();
}

export function loadHeroBanner(elem: HTMLElement, apiClient: ApiClient, userId: string) {
    return apiClient.getItems(userId, {
        IncludeItemTypes: 'Movie,Series',
        Recursive: true,
        SortBy: 'Random',
        Limit: MAX_ITEMS,
        ImageTypes: 'Backdrop',
        EnableImageTypes: 'Backdrop,Logo',
        ImageTypeLimit: 1,
        Fields: 'Overview,Genres',
        EnableTotalRecordCount: false
    }).then(result => {
        const items = (result.Items || []).filter(item => item.Id && item.BackdropImageTags?.length);
        if (!items.length) {
            elem.remove();
            return;
        }

        let html = '<div class="cj7Hero">';
        items.forEach((item, index) => {
            html += getSlideHtml(item, index, apiClient);
        });
        if (items.length > 1) {
            html += '<div class="cj7Hero-dots">';
            items.forEach((_item, index) => {
                html += '<button type="button" class="cj7Hero-dot' + (index === 0 ? ' is-active' : '')
                    + '" data-index="' + index + '" aria-label="Destacado ' + (index + 1) + '"></button>';
            });
            html += '</div>';
        }
        html += '</div>';

        elem.innerHTML = html;

        elem.querySelectorAll<HTMLElement>('.cj7Hero-play').forEach(button => {
            button.addEventListener('click', () => {
                playbackManager.play({
                    ids: [button.dataset.id],
                    serverId: apiClient.serverId()
                });
            });
        });

        startRotation(elem.querySelector('.cj7Hero') as HTMLElement, items.length);
    }).catch(err => {
        console.error('[CJ7] No se pudo cargar el banner destacado', err);
        elem.remove();
    });
}
