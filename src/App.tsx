import React, { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api';
import { open } from '@tauri-apps/api/shell';
import { listen } from '@tauri-apps/api/event';
import Layout from './components/Layout';
import LaunchButton from './components/LaunchButton';
import LoginModal from './components/LoginModal';
import { useUserStore } from './stores/userStore';
import { useConfigStore } from './stores/configStore';
import { useGameStore } from './stores/gameStore';
import './styles/index.css';

interface DownloadState {
    state: string;
    percent: number;
    downloaded: number;
    total: number;
}

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState('home');
    const [appVersion, setAppVersion] = useState<string>('1.0.6');
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadState | null>(null);
    const [serverData, setServerData] = useState<{ status: boolean; news?: { title: string; content: string; date: string } } | null>(null);
    
    const { email, _hasHydrated } = useUserStore();
    const { fortnitePath, setFortnitePath } = useConfigStore();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch status
                const statusRes = await fetch('https://cdn.leilos.qzz.io/json/status.json');
                const statusJson = await statusRes.json();
                
                // Fetch news (try status.json first, then news.json)
                let newsData = statusJson.news;
                if (!newsData) {
                    try {
                        const newsRes = await fetch('https://cdn.leilos.qzz.io/json/news.json');
                        newsData = await newsRes.json();
                    } catch (e) {
                        console.log("No separate news file found");
                    }
                }
                
                // Handle case where news might be an array (take first item) or object
                if (Array.isArray(newsData)) {
                    newsData = newsData[0];
                }

                setServerData({
                    status: statusJson.status === true || statusJson.status === 'true',
                    news: newsData
                });
            } catch (error) {
                console.error('Failed to fetch server data:', error);
                // Fallback
                setServerData({ status: false });
            }
        };

        fetchData();
        getVersion().then(setAppVersion).catch(() => {});

        const { setStatus } = useGameStore.getState();
        
        // Check if game is already running
        invoke<boolean>('check_is_game_running')
            .then(isRunning => {
                if (isRunning) {
                    console.log('Game detected running on startup');
                    setStatus('RUNNING');
                }
            })
            .catch(console.error);

        // Poll for game status every 3 seconds to ensure UI is always in sync
        const intervalId = setInterval(() => {
             invoke<boolean>('check_is_game_running')
                .then(isRunning => {
                    const currentStatus = useGameStore.getState().status;
                    if (isRunning && currentStatus !== 'RUNNING') {
                        console.log('Game detected running (poll)');
                        setStatus('RUNNING');
                    } else if (!isRunning && currentStatus === 'RUNNING') {
                        console.log('Game detected stopped (poll)');
                        setStatus('IDLE');
                    }
                })
                .catch(console.error);
        }, 3000);
        
        // Listen for game exit from backend monitoring
        const unlistenExit = listen('game-exited', () => {
            console.log('Game exited event received');
            setStatus('IDLE');
        });

        // Listen for launch status updates
        const unlistenStatus = listen<string>('launch-status', (event) => {
             // Handle status updates if main.js sends them (optional backup)
        });

        const unlistenDownload = listen<DownloadState>('download-progress', (event) => {
            setDownloadProgress(event.payload);
        });

        return () => {
            unlistenExit.then(f => f());
            unlistenStatus.then(f => f());
            unlistenDownload.then(f => f());
            clearInterval(intervalId);
        };
    }, []);

    const handleSelectPath = async () => {
        try {
            const path = await invoke<string>('select_folder');
            if (path) {
                setFortnitePath(path);
            }
        } catch (error) {
            console.error('Failed to select folder:', error);
        }
    };

    const handleStartDownload = async () => {
        try {
            const path = await invoke<string>('select_folder');
            if (path) {
                await invoke('install_game', { installPath: path });
            }
        } catch (error) {
            console.error('Failed to start download:', error);
        }
    };

    useEffect(() => {
        if (_hasHydrated) {
            if (!email) {
                setIsLoginOpen(true);
            } else {
                setIsLoginOpen(false);
            }
        }
    }, [email, _hasHydrated]);

    if (!_hasHydrated) {
        return <div className="flex items-center justify-center h-screen bg-bg-dark text-gold-primary font-display">LOADING SYSTEM...</div>;
    }

    const renderContent = () => {
        switch (currentView) {
            case 'home':
                return (
                    <div className="flex flex-col h-full animate-fade-in p-2 gap-6">
                        {/* Top Section: User Welcome & Status */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* User Welcome Card - Spans 2 columns */}
                            <div className="md:col-span-2 bg-[#151921] rounded-2xl p-6 border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-primary/5 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-75"></div>
                                <div className="relative z-10 flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-primary to-gold-highlight p-0.5 shadow-lg shadow-gold-primary/20">
                                        <div className="w-full h-full bg-[#1a1f2e] rounded-xl flex items-center justify-center overflow-hidden">
                                            <span className="text-2xl font-bold text-white">{email ? email.substring(0, 2).toUpperCase() : '??'}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-medium text-sm mb-1">Bienvenido de nuevo,</p>
                                        <h2 className="text-3xl font-bold text-white font-display tracking-wide">{email ? email.split('@')[0] : 'Invitado'}</h2>
                                    </div>
                                </div>
                            </div>

                            {/* Server Status Widget - Spans 1 column */}
                            <div className="bg-[#151921] rounded-2xl p-6 border border-white/5 flex flex-col justify-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                <h3 className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-gold-primary"></span>
                                    Estado del Sistema
                                </h3>
                                <div className="space-y-3 relative z-10">
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                                        <span className="text-sm font-medium text-gray-300">Servidores</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${serverData?.status ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                                            <span className="text-xs font-mono text-white">{serverData?.status ? 'ONLINE' : 'OFFLINE'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 gap-6 flex-1">
                            {/* Hero / Season Card */}
                            <div className="bg-[#151921] rounded-2xl overflow-hidden border border-white/5 relative group min-h-[400px]">
                                <div className="absolute inset-0 bg-[url('https://cdn.leilos.qzz.io/media/bg1.jpg')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/60 to-transparent"></div>
                                
                                <div className="absolute bottom-0 left-0 p-8 w-full">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="px-3 py-1 rounded-full bg-gold-primary text-bg-dark text-xs font-bold border border-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.4)]">
                                            TEMPORADA 1
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold backdrop-blur-md border border-white/10">
                                            CAPÍTULO 5
                                        </span>
                                    </div>
                                    <h2 className="text-5xl font-bold text-white mb-4 font-display drop-shadow-lg">UNDERGROUND<br/>SOCIETY</h2>
                                    <p className="text-gray-200 mb-8 max-w-xl text-sm leading-relaxed drop-shadow-md font-medium">
                                        Únete a la resistencia. El mapa clásico, las armas originales y la experiencia auténtica de Fortnite han regresado. ¿Estás listo para el salto?
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <LaunchButton />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'settings':
                return (
                    <div className="max-w-4xl mx-auto pt-10 animate-fade-in p-6">
                        <h2 className="text-3xl font-bold text-white mb-8 font-display">Configuración</h2>
                        
                        <div className="grid grid-cols-1 gap-6">
                            {/* Game Path Configuration - Redesigned */}
                            <div className="bg-[#151921] rounded-2xl p-8 border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-primary/5 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-75"></div>
                                
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-blue-500/10 rounded-xl">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white">Ruta de Instalación</h3>
                                            <p className="text-gray-400 text-sm">Ubicación de los archivos del juego (Build 28.30)</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col md:flex-row gap-4 items-center">
                                        <div className="w-full flex-1 bg-black/40 rounded-xl border border-white/10 px-4 py-4 flex items-center gap-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 shrink-0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                            <span className="text-gray-300 font-mono text-sm truncate select-all">{fortnitePath || 'No seleccionado'}</span>
                                        </div>
                                        <button 
                                            onClick={handleSelectPath}
                                            className="w-full md:w-auto bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-xl font-bold text-sm transition-all border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-95"
                                        >
                                            Cambiar Ruta
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* About Section - Simplified & Clean */}
                            <div className="bg-[#151921] rounded-2xl p-8 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-gold-primary to-gold-highlight rounded-xl flex items-center justify-center shadow-lg shadow-gold-primary/20">
                                        <span className="text-bg-dark font-bold text-xl">L</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white font-display">Leilos Launcher</h3>
                                        <p className="text-gray-500 text-sm">Versión {appVersion} • <span className="text-gold-primary">Stable</span></p>
                                    </div>
                                </div>
                                
                                <div className="flex gap-3">
                                    <button onClick={() => open('https://discord.gg/rNtPqQyBwg')} className="p-3 bg-white/5 rounded-xl hover:bg-[#5865F2]/20 hover:text-[#5865F2] transition-all border border-white/5 hover:border-[#5865F2]/30 group cursor-pointer">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:scale-110"><path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"></path></svg>
                                    </button>
                                    <button onClick={() => open('https://github.com/leilosFN')} className="p-3 bg-white/5 rounded-xl hover:bg-white/20 hover:text-white transition-all border border-white/5 hover:border-white/30 group cursor-pointer">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:scale-110"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                                    </button>
                                    <button onClick={() => open('https://leilos.qzz.io')} className="p-3 bg-white/5 rounded-xl hover:bg-gold-primary/20 hover:text-gold-primary transition-all border border-white/5 hover:border-gold-primary/30 group cursor-pointer">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:scale-110"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'download':
                return (
                    <div className="max-w-5xl mx-auto pt-10 animate-fade-in p-6">
                        <div className="bg-[#151921] rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
                            <div className="flex flex-col md:flex-row">
                                {/* Left Side: Cover Art */}
                                <div className="w-full md:w-80 h-96 relative group">
                                    <div className="absolute inset-0 bg-[url('https://cdn.leilos.qzz.io/media/logo.jpg')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#151921] to-transparent md:bg-gradient-to-r"></div>
                                </div>
                                
                                {/* Right Side: Content */}
                                <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-4xl font-bold font-display text-white">Fortnite</h2>
                                        <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-mono text-gray-400 border border-white/5">v28.30</span>
                                    </div>
                                    
                                    <p className="text-gold-primary font-medium tracking-widest text-sm uppercase mb-4 font-display">Capítulo 5 - Temporada 1</p>
                                    
                                    {/* Description Added as Requested */}
                                    <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/5">
                                        <p className="text-gray-300 text-sm leading-relaxed">
                                            Esta versión fue lanzada en <span className="text-white font-bold">Febrero 2024</span>. 
                                            La Temporada 28 (Subterránea) terminó en <span className="text-white font-bold">Marzo 2024</span>.
                                            Experimenta el mapa y las armas clásicas exactamente como eran.
                                        </p>
                                    </div>
                                    
                                    <div className="flex gap-4 mb-8">
                                        <button 
                                            onClick={handleStartDownload}
                                            disabled={downloadProgress?.state === 'downloading' || downloadProgress?.state === 'extracting'}
                                            className="w-full bg-gold-primary text-bg-dark px-8 py-4 rounded-xl font-bold hover:bg-gold-highlight transition-all duration-300 font-display tracking-widest disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transform hover:-translate-y-1"
                                        >
                                            {downloadProgress?.state === 'downloading' ? 'DESCARGANDO...' : 
                                             downloadProgress?.state === 'extracting' ? 'EXTRAYENDO...' : 'INSTALAR JUEGO'}
                                        </button>
                                    </div>

                                    {downloadProgress && (
                                        <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                                            <div className="flex justify-between mb-2 text-sm font-display tracking-wide">
                                                <span className="capitalize text-gray-300">{downloadProgress.state}</span>
                                                <span className="text-gold-primary">{downloadProgress.percent}%</span>
                                            </div>
                                            <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/5">
                                                <div 
                                                    className="bg-gold-primary h-full transition-all duration-300 shadow-[0_0_10px_rgba(212,175,55,0.5)]" 
                                                    style={{ width: `${downloadProgress.percent}%` }}
                                                ></div>
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500 text-right font-mono">
                                                {(downloadProgress.downloaded / 1024 / 1024).toFixed(2)} MB / {(downloadProgress.total / 1024 / 1024).toFixed(2)} MB
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return <div>View not found</div>;
        }
    };

    return (
        <Layout currentView={currentView} onChangeView={setCurrentView}>
            {renderContent()}
            
            <LoginModal 
                isOpen={isLoginOpen} 
                onClose={() => {
                    // Prevent closing if no email
                    if (email) setIsLoginOpen(false);
                }} 
            />
        </Layout>
    );
};

export default App;