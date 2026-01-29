import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UserState {
    email: string;
    password: string;
    _hasHydrated: boolean;
    setCredentials: (email: string, password: string) => void;
    clearCredentials: () => void;
    setHasHydrated: (state: boolean) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            email: '',
            password: '',
            _hasHydrated: false,
            setCredentials: (email, password) => set({ email, password }),
            clearCredentials: () => set({ email: '', password: '' }),
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
