// CJ7 Stream: filas del Home por género (Acción, Comedia, Terror...)
// Mezcla películas y series de todas las bibliotecas en cada fila.
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import escapeHtml from 'escape-html';
import type { ApiClient } from 'jellyfin-apiclient';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import layoutManager from 'components/layoutManager';
import { appRouter } from 'components/router/appRouter';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { getPortraitShape } from 'utils/card';

import type { SectionContainerElement, SectionOptions } from './section';

/** Cuántas filas de género mostrar como máximo (cada fila es una consulta al servidor). */
const MAX_GENRE_ROWS = 8;
/** Cuántas películas/series cargar por fila. */
const ITEMS_PER_ROW = 16;

function getItemCount(genre: BaseItemDto) {
    return (genre.MovieCount ?? 0) + (genre.SeriesCount ?? 0) || (genre.ChildCount ?? 0);
}

function getFetchGenreItemsFn(serverId: string, userId: string, genreId: string) {
    return function () {
        const apiClient = ServerConnections.getApiClient(serverId);
        return apiClient.getItems(userId, {
            GenreIds: genreId,
            IncludeItemTypes: 'Movie,Series',
            Recursive: true,
            SortBy: 'Random',
            Limit: ITEMS_PER_ROW,
            Fields: 'PrimaryImageAspectRatio',
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            EnableTotalRecordCount: false
        });
    };
}

function getGenreItemsHtmlFn({ enableOverflow }: SectionOptions) {
    return function (items: BaseItemDto[]) {
        return cardBuilder.getCardsHtml({
            items: items,
            shape: getPortraitShape(enableOverflow),
            showUnplayedIndicator: false,
            showChildCountIndicator: true,
            context: 'home',
            overlayText: false,
            centerText: true,
            overlayPlayButton: true,
            allowBottomPadding: !enableOverflow,
            cardLayout: false,
            showTitle: true,
            showYear: true,
            lines: 2
        });
    };
}

function renderGenreRow(
    elem: HTMLElement,
    userId: string,
    serverId: string,
    genre: BaseItemDto,
    options: SectionOptions
) {
    const title = escapeHtml(genre.Name || '');
    let html = '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">';

    if (!layoutManager.tv) {
        html += '<a is="emby-linkbutton" href="' + appRouter.getRouteUrl(genre, { serverId })
            + '" class="more button-flat button-flat-mini sectionTitleTextButton">';
        html += '<h2 class="sectionTitle sectionTitle-cards">' + title + '</h2>';
        html += '<span class="material-icons chevron_right" aria-hidden="true"></span>';
        html += '</a>';
    } else {
        html += '<h2 class="sectionTitle sectionTitle-cards">' + title + '</h2>';
    }
    html += '</div>';

    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x"></div>';
        html += '</div>';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer focuscontainer-x padded-left padded-right vertical-wrap"></div>';
    }

    elem.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (!itemsContainer || !genre.Id) return;
    itemsContainer.fetchData = getFetchGenreItemsFn(serverId, userId, genre.Id);
    itemsContainer.getItemsHtml = getGenreItemsHtmlFn(options);
    itemsContainer.parentContainer = elem;
}

export function loadGenreRows(
    elem: HTMLElement,
    apiClient: ApiClient,
    userId: string,
    options: SectionOptions
) {
    const serverId = apiClient.serverId();

    return apiClient.getGenres(userId, {
        IncludeItemTypes: 'Movie,Series',
        Recursive: true,
        Fields: 'ItemCounts',
        SortBy: 'SortName'
    }).then(result => {
        const genres = (result.Items || [])
            .filter(genre => genre.Id)
            .sort((a, b) => getItemCount(b) - getItemCount(a))
            .slice(0, MAX_GENRE_ROWS);

        for (const genre of genres) {
            const row = document.createElement('div');
            // Se oculta sola si el género no devuelve contenido
            row.classList.add('verticalSection', 'hide');
            elem.appendChild(row);
            renderGenreRow(row, userId, serverId, genre, options);
        }
    }).catch(err => {
        console.error('[CJ7] No se pudieron cargar las filas por género', err);
    });
}

// CJ7 Stream: fila "Novedades" — lo último agregado, películas y series mezcladas.
// Usa el mismo endpoint que "Recientes" de Jellyfin pero sin separar por biblioteca,
// así una serie a la que le agregaste episodios nuevos también sube aquí.
const NOVEDADES_LIMIT = 16;

export function loadNovedades(
    elem: HTMLElement,
    apiClient: ApiClient,
    options: SectionOptions
) {
    const serverId = apiClient.serverId();
    elem.classList.add('verticalSection', 'hide');

    let html = '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">';
    html += '<h2 class="sectionTitle sectionTitle-cards">Novedades CJ7</h2>';
    html += '</div>';

    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x"></div>';
        html += '</div>';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer focuscontainer-x padded-left padded-right vertical-wrap"></div>';
    }

    elem.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (!itemsContainer) return;
    itemsContainer.fetchData = function () {
        return ServerConnections.getApiClient(serverId).getLatestItems({
            IncludeItemTypes: 'Movie,Series,Episode',
            Limit: NOVEDADES_LIMIT,
            Fields: 'PrimaryImageAspectRatio',
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb'
        });
    };
    itemsContainer.getItemsHtml = function (items: BaseItemDto[]) {
        return cardBuilder.getCardsHtml({
            items: items,
            shape: getPortraitShape(options.enableOverflow),
            showUnplayedIndicator: false,
            showChildCountIndicator: true,
            context: 'home',
            overlayText: false,
            centerText: true,
            overlayPlayButton: true,
            allowBottomPadding: !options.enableOverflow,
            cardLayout: false,
            showTitle: true,
            showYear: true,
            // Para episodios sueltos muestra el nombre de la serie
            showParentTitle: true,
            lines: 2
        });
    };
    itemsContainer.parentContainer = elem;
}

// CJ7 Stream: fila "Mi Lista" — lo que el usuario marcó con el corazón (favoritos).
// Películas y series mezcladas. Se oculta sola si la lista está vacía.
export function loadMiLista(
    elem: HTMLElement,
    apiClient: ApiClient,
    userId: string,
    options: SectionOptions
) {
    const serverId = apiClient.serverId();
    elem.classList.add('verticalSection', 'hide');

    let html = '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">';
    html += '<h2 class="sectionTitle sectionTitle-cards">Mi Lista</h2>';
    html += '</div>';

    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x"></div>';
        html += '</div>';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer focuscontainer-x padded-left padded-right vertical-wrap"></div>';
    }

    elem.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (!itemsContainer) return;
    itemsContainer.fetchData = function () {
        return ServerConnections.getApiClient(serverId).getItems(userId, {
            Filters: 'IsFavorite',
            IncludeItemTypes: 'Movie,Series',
            Recursive: true,
            SortBy: 'DateCreated',
            SortOrder: 'Descending',
            Limit: 24,
            Fields: 'PrimaryImageAspectRatio',
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            EnableTotalRecordCount: false
        });
    };
    itemsContainer.getItemsHtml = getGenreItemsHtmlFn(options);
    itemsContainer.parentContainer = elem;
}
