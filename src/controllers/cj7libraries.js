// CJ7 Stream: pestaña "Mis contenidos" (las bibliotecas que antes estaban en el Home)
import loading from '../components/loading/loading';
import focusManager from '../components/focusManager';
import { loadLibraryTiles } from '../components/homesections/sections/libraryTiles';
import { getUserViewsQuery } from 'hooks/useUserViews';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { queryClient } from 'utils/query/queryClient';

import '../elements/emby-itemscontainer/emby-itemscontainer';

class LibrariesTab {
    constructor(view, params) {
        this.view = view;
        this.params = params;
        this.apiClient = ServerConnections.currentApiClient();
        this.container = view.querySelector('.sections');
    }

    onResume(options) {
        if (this.rendered) {
            return Promise.resolve();
        }

        loading.show();
        const apiClient = this.apiClient;
        const userId = apiClient.getCurrentUserId();

        return queryClient
            .fetchQuery(getUserViewsQuery(toApi(apiClient), userId))
            .then(result => {
                loadLibraryTiles(this.container, result.Items || [], { enableOverflow: false });
                this.rendered = true;
                if (options?.autoFocus) {
                    focusManager.autoFocus(this.view);
                }
            })
            .catch(err => {
                console.error('[CJ7] No se pudieron cargar las bibliotecas', err);
            })
            .finally(() => {
                loading.hide();
            });
    }

    onPause() {
        // Nada que pausar: las bibliotecas no cambian mientras navegás
    }

    destroy() {
        this.view = null;
        this.params = null;
        this.apiClient = null;
        this.container = null;
    }
}

export default LibrariesTab;
