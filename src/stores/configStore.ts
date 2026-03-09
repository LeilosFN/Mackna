import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Language = 'es' | 'en';

interface ConfigState {
    fortnitePath: string;
    backendUrl: string;
    hostUrl: string;
    redirectDLL: string;
    consoleDLL: string;
    gameServerDll: string;
    language: Language;
    setFortnitePath: (path: string) => void;
    setBackendUrl: (url: string) => void;
    setHostUrl: (url: string) => void;
    setRedirectDLL: (path: string) => void;
    setConsoleDLL: (path: string) => void;
    setGameServerDll: (path: string) => void;
    setLanguage: (lang: Language) => void;
}

export const useConfigStore = create<ConfigState>()(
    persist(
        (set) => ({
            fortnitePath: '',
            backendUrl: 'https://api.leilos.qzz.io',
            hostUrl: 'http://api.leilos.qzz.io:7777',
            redirectDLL: '',
            consoleDLL: '',
            gameServerDll: '',
            language: 'es',
            setFortnitePath: (path) => set({ fortnitePath: path }),
            setBackendUrl: (url) => set({ backendUrl: url }),
            setHostUrl: (url) => set({ hostUrl: url }),
            setRedirectDLL: (path) => set({ redirectDLL: path }),
            setConsoleDLL: (path) => set({ consoleDLL: path }),
            setGameServerDll: (path) => set({ gameServerDll: path }),
            setLanguage: (lang) => set({ language: lang }),
        }),
        {
            name: 'leilos-config',
            storage: createJSONStorage(() => localStorage),
            version: 20, // Bumped version to force migration to new api domain
            migrate: (persistedState: any) => {
                if (!persistedState) {
                    return {
                        fortnitePath: '',
                        backendUrl: 'https://api.leilos.qzz.io',
                        hostUrl: 'http://api.leilos.qzz.io:7777',
                        redirectDLL: '',
                        consoleDLL: '',
                        gameServerDll: '',
                        language: 'es'
                    };
                }
                persistedState.backendUrl = 'https://api.leilos.qzz.io';
                persistedState.hostUrl = 'http://api.leilos.qzz.io:7777';
                
                // Initialize new fields if they don't exist
                if (typeof persistedState.redirectDLL === 'undefined') persistedState.redirectDLL = '';
                if (typeof persistedState.consoleDLL === 'undefined') persistedState.consoleDLL = '';
                if (typeof persistedState.gameServerDll === 'undefined') persistedState.gameServerDll = '';
                if (typeof persistedState.language === 'undefined') persistedState.language = 'es';
                
                return persistedState;
            },
        }
    )
);
