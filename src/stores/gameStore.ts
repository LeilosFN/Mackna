import { create } from 'zustand';

export type LaunchStatus = 'IDLE' | 'LAUNCHING' | 'RUNNING' | 'ERROR';

interface GameState {
    status: LaunchStatus;
    setStatus: (status: LaunchStatus) => void;
}

export const useGameStore = create<GameState>((set) => ({
    status: 'IDLE',
    setStatus: (status) => set({ status }),
}));
