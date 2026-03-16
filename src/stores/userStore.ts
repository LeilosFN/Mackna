import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useConfigStore } from './configStore';

interface UserState {
    email: string;
    password: string;
    discordId: string;
    username: string;
    avatar: string;
    _hasHydrated: boolean;
    setCredentials: (discordId: string, email: string, password: string) => void;
    setUserInfo: (username: string, avatar: string) => void;
    fetchUserProfile: (discordId: string) => Promise<void>;
    clearCredentials: () => void;
    setHasHydrated: (state: boolean) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            email: '',
            password: '',
            discordId: '',
            username: '',
            avatar: '',
            _hasHydrated: false,
            setCredentials: (discordId, email, password) => set({ discordId, email, password }),
            setUserInfo: (username, avatar) => set({ username, avatar }),
            fetchUserProfile: async (discordId) => {
                if (!discordId) return;
                try {
                    const { backendUrl } = useConfigStore.getState();
                    const url = `${backendUrl}/api/v1/user/profile/${discordId}`;
                    console.log(`[UserStore] Fetching profile from: ${url}`);
                    
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        console.log(`[UserStore] Profile data received:`, data);
                        set({ 
                            username: data.username || discordId, 
                            avatar: data.avatar 
                        });
                    } else {
                        console.warn(`[UserStore] Profile fetch failed with status: ${response.status}`);
                        set({ 
                            username: discordId, 
                            avatar: 'https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg' 
                        });
                    }
                } catch (error) {
                    console.error('[UserStore] Failed to fetch user profile:', error);
                    set({ 
                        username: discordId, 
                        avatar: 'https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg' 
                    });
                }
            },
            clearCredentials: () => set({ email: '', password: '', discordId: '', username: '', avatar: '' }),
            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'leilos-user',
            storage: createJSONStorage(() => localStorage),
            version: 1,
            onRehydrateStorage: () => (state) => {
                console.log('User store hydrated', state);
                state?.setHasHydrated(true);
            },
        }
    )
);
