import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ConfigState {
    fortnitePath: string;
    backendUrl: string;
    hostUrl: string;
    redirectDLL: string;
    consoleDLL: string;
    gameServerDll: string;
    setFortnitePath: (path: string) => void;
    setBackendUrl: (url: string) => void;
    setHostUrl: (url: string) => void;
    setRedirectDLL: (path: string) => void;
    setConsoleDLL: (path: string) => void;
    setGameServerDll: (path: string) => void;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set) => ({
            fortnitePath: '',
            backendUrl: 'https://launcher.leilos.qzz.io',
            hostUrl: 'http://79.117.129.88:7777',
            redirectDLL: '',
            consoleDLL: '',
            gameServerDll: '',
            setFortnitePath: (path) => set({ fortnitePath: path }),
            setBackendUrl: (url) => set({ backendUrl: url }),
            setHostUrl: (url) => set({ hostUrl: url }),
            setRedirectDLL: (path) => set({ redirectDLL: path }),
            setConsoleDLL: (path) => set({ consoleDLL: path }),
            setGameServerDll: (path) => set({ gameServerDll: path }),
        }),
        {
            name: 'leilos-config',
            storage: createJSONStorage(() => localStorage),
            version: 17, // Bumped version to force migration
            migrate: (persistedState: any) => {
                if (!persistedState) {
                    return {
                        fortnitePath: '',
                        backendUrl: 'https://launcher.leilos.qzz.io',
                        hostUrl: 'http://79.117.129.88:7777',
                        redirectDLL: '',
                        consoleDLL: '',
                        gameServerDll: ''
                    };
                }
                persistedState.backendUrl = 'https://launcher.leilos.qzz.io';
                persistedState.hostUrl = 'http://79.117.129.88:7777';
                
                // Initialize new fields if they don't exist
                if (typeof persistedState.redirectDLL === 'undefined') persistedState.redirectDLL = '';
                if (typeof persistedState.consoleDLL === 'undefined') persistedState.consoleDLL = '';
                if (typeof persistedState.gameServerDll === 'undefined') persistedState.gameServerDll = '';
                
                return persistedState;
            },
        }
    )
);
