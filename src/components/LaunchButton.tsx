import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api';
import { useUserStore } from '../stores/userStore';
import { useConfigStore } from '../stores/configStore';
import { useGameStore, LaunchStatus } from '../stores/gameStore';
import { RpcStart } from '../utils/rpc';
import { useTranslation } from '../utils/translations';

interface LaunchButtonProps {
    onStatusChange?: (status: LaunchStatus) => void;
}

const LaunchButton: React.FC<LaunchButtonProps> = ({ onStatusChange }) => {
    const { status, setStatus } = useGameStore();
    const [manualCode, setManualCode] = useState('');
    const [showInput, setShowInput] = useState(false);
    const { email, password } = useUserStore();
    const { fortnitePath, backendUrl, hostUrl, redirectDLL, consoleDLL } = useConfigStore();
    const { t } = useTranslation();

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
            alert(t('settings.gamePath') + ' ' + t('settings.notSelected'));
            return;
        }

        try {
            // Re-verify version before launching
            const isCorrectVersion = await invoke<boolean>('check_fortnite_version', { path: fortnitePath });
            if (!isCorrectVersion) {
                alert('Error: La versión actual de Fortnite no es compatible. Este launcher solo es compatible con la versión v28.30 exacta.');
                return;
            }

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

    const getButtonClass = () => {
        const base = "relative px-10 py-4 font-black text-lg transition-all duration-300 transform font-display tracking-[0.2em] uppercase overflow-hidden group";
        
        // Clip path style for angled corners
        const angled = "clip-path-polygon-[10%_0,100%_0,90%_100%,0%_100%]"; 
        
        switch (status) {
            case 'LAUNCHING':
                return `${base} bg-yellow-600/20 text-yellow-500 cursor-wait border border-yellow-500/30`;
            case 'RUNNING':
                return `${base} bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 hover:shadow-[0_0_40px_rgba(239,68,68,0.3)]`;
            case 'ERROR':
                return `${base} bg-red-600 text-white hover:bg-red-700`;
            default:
                return `${base} bg-gradient-to-r from-gold-primary to-gold-secondary text-bg-dark hover:shadow-[0_0_50px_rgba(212,175,55,0.4)] hover:scale-105 active:scale-95`;
        }
    };

    const getButtonContent = () => {
        switch (status) {
            case 'LAUNCHING':
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        <span>{t('home.launching')}</span>
                    </div>
                );
            case 'RUNNING':
                return (
                    <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_red]"></span>
                        <span>{t('home.stop')}</span>
                    </div>
                );
            case 'ERROR':
                return (
                    <div className="flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <span>{t('home.error')}</span>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                        </svg>
                        <span>{t('home.launch')}</span>
                    </div>
                );
        }
    };

    return (
        <div className="flex flex-col items-start gap-2">
            <button
                onClick={handleLaunch}
                disabled={status === 'LAUNCHING'}
                className={getButtonClass()}
                style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0% 100%)" }}
            >
                {/* Shine effect overlay */}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10"></div>
                
                <div className="relative z-20">
                    {getButtonContent()}
                </div>
            </button>
            
            {status === 'IDLE' && (
                <div className="pl-6 flex items-center gap-2 text-[10px] text-gold-primary/60 font-mono tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-1 h-1 bg-gold-primary rounded-full"></span>
                    Ready to drop
                </div>
            )}
        </div>
    );
};

export default LaunchButton;
