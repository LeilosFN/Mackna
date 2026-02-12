import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api';
import { useUserStore } from '../stores/userStore';
import { useConfigStore } from '../stores/configStore';
import { useGameStore, LaunchStatus } from '../stores/gameStore';
import { RpcStart } from '../utils/rpc';

interface LaunchButtonProps {
    onStatusChange?: (status: LaunchStatus) => void;
}

const LaunchButton: React.FC<LaunchButtonProps> = ({ onStatusChange }) => {
    const { status, setStatus } = useGameStore();
    const [manualCode, setManualCode] = useState('');
    const [showInput, setShowInput] = useState(false);
    const { email, password } = useUserStore();
    const { fortnitePath, backendUrl, hostUrl, redirectDLL, consoleDLL } = useConfigStore();

    const updateStatus = (newStatus: LaunchStatus) => {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
    };

    const handleLaunch = async () => {
        if (status === 'RUNNING') {
            try {
                // Call backend to kill fortnite processes
                await invoke('kill_fortnite');
                
                updateStatus('IDLE');
                RpcStart({ 
                    state: "En el Launcher", 
                    details: "Esperando...", 
                    enable_timer: true 
                }).catch(console.error);
            } catch (error) {
                console.error('Failed to close game:', error);
                alert(`Failed to close game: ${error}`);
            }
            return;
        }

        if (!fortnitePath) {
            alert('Please select Fortnite installation path in Settings');
            return;
        }

        // Authentication check removed to allow offline/bypass mode
        /*
        if (!email || !password) {
            alert('Please login first');
            return;
        }
        */

        try {
            updateStatus('LAUNCHING');

            const result = await invoke<boolean>('launch_game', {
                fortnitePath,
                email,
                password,
                backendUrl,
                hostUrl,
                manualExchangeCode: manualCode || null,
                redirectDll: redirectDLL || "",
                consoleDll: consoleDLL || "",
                gameServerDll: "",
            });

            if (result) {
                updateStatus('RUNNING');
                RpcStart({ details: "Jugando Fortnite", state: "En Partida", enable_timer: true }).catch(console.error);
                // Status will be reset to IDLE when 'game-exited' event is received
            } else {
                updateStatus('ERROR');
            }
        } catch (error) {
            console.error('Launch error:', error);
            alert(`Launch error: ${error}`);
            updateStatus('ERROR');
        }
    };

    const getButtonText = () => {
        switch (status) {
            case 'LAUNCHING':
                return 'LAUNCHING...';
            case 'RUNNING':
                return 'STOP GAME';
            case 'ERROR':
                return 'ERROR - TRY AGAIN';
            default:
                return 'LAUNCH';
        }
    };

    const getButtonClass = () => {
        const base = "px-10 py-3 font-bold text-lg rounded transition-all duration-300 transform hover:scale-105 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] font-display tracking-widest uppercase border border-gold-primary/20";
        
        switch (status) {
            case 'LAUNCHING':
                return `${base} bg-yellow-600/50 text-white cursor-wait animate-pulse`;
            case 'RUNNING':
                return `${base} bg-red-600/20 text-red-500 border-red-500/50 hover:bg-red-600/30 hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]`;
            case 'ERROR':
                return `${base} bg-red-600 text-white hover:bg-red-700`;
            default:
                return `${base} bg-gold-primary text-bg-dark hover:bg-gold-highlight`;
        }
    };

    return (
        <div className="flex flex-col items-center gap-3 w-full">
            {showInput && (
                <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.trim())}
                    placeholder="Paste Exchange Code from Discord"
                    className="input-field text-center text-sm w-64"
                />
            )}
            <div className="flex gap-2">
                <button
                    onClick={handleLaunch}
                    disabled={status === 'LAUNCHING'}
                    className={getButtonClass()}
                >
                    {getButtonText()}
                </button>
                
                <button 
                    onClick={() => setShowInput(!showInput)}
                    className="px-3 py-3 bg-white/5 border border-white/10 rounded hover:bg-white/10 hover:border-gold-primary/50 transition-colors text-gold-primary"
                    title="Enter Manual Code"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                </button>
            </div>
        </div>
    );
};

export default LaunchButton;
