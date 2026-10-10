// CJ7 Stream: fondos rotativos en la pantalla de login.
// En el login nadie inició sesión, así que no se puede pedir el catálogo.
// Solución: cuando alguien entra al Home, guardamos en ESTE dispositivo las
// URLs de unos fondos al azar. El login los rota la próxima vez.
// Las imágenes de Jellyfin se pueden ver sin sesión; la lista de pelis no.

const STORAGE_KEY = 'cj7LoginBackdrops';
const MAX_IMAGES = 12;
// No volver a pedirlos en cada visita al Home: con renovarlos cada 12 h basta
const REFRESH_MS = 12 * 60 * 60 * 1000;

function readStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/** Guarda fondos al azar del catálogo. Se llama desde el Home (ya con sesión). */
export function saveLoginBackdrops(apiClient, userId) {
    const stored = readStore();
    if (stored && stored.serverId === apiClient.serverId() && Date.now() - stored.savedAt < REFRESH_MS) {
        return Promise.resolve();
    }

    return apiClient.getItems(userId, {
        IncludeItemTypes: 'Movie,Series',
        Recursive: true,
        SortBy: 'Random',
        Limit: MAX_IMAGES,
        ImageTypes: 'Backdrop',
        EnableImageTypes: 'Backdrop',
        ImageTypeLimit: 1,
        EnableTotalRecordCount: false
    }).then(result => {
        const urls = (result.Items || [])
            .filter(item => item.BackdropImageTags?.length)
            .map(item => apiClient.getImageUrl(item.Id, {
                type: 'Backdrop',
                tag: item.BackdropImageTags[0],
                maxWidth: 1920,
                quality: 80
            }));

        if (urls.length) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    serverId: apiClient.serverId(),
                    savedAt: Date.now(),
                    urls
                }));
            } catch {
                // Sin almacenamiento (modo incógnito, etc.): el login usa el fondo normal
            }
        }
    }).catch(err => {
        console.debug('[CJ7] No se pudieron guardar los fondos del login', err);
    });
}

/** Devuelve las URLs guardadas, mezcladas, o una lista vacía. */
export function getLoginBackdrops() {
    const stored = readStore();
    return stored?.urls?.length ? shuffle(stored.urls) : [];
}
