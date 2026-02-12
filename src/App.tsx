import React, { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api';
import { open as openShell } from '@tauri-apps/api/shell';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import Layout from './components/Layout';
import LaunchButton from './components/LaunchButton';
import LoginModal from './components/LoginModal';
import Particles from './components/Global/Particles';
import { useUserStore } from './stores/userStore';
import { useConfigStore } from './stores/configStore';
import { useGameStore } from './stores/gameStore';
import { RpcStart } from './utils/rpc';
import './styles/index.css';

interface DownloadState {
    state: string;
    percent: number;
    downloaded: number;
    total: number;
}

interface Service {
    name: string;
    status: string;
    color: string;
}

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState('home');
    const [appVersion, setAppVersion] = useState<string>('1.1.1');
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadState | null>(null);
    const [serverData, setServerData] = useState<{ status: boolean; services?: Service[]; news?: { title: string; content: string; date: string } } | null>(null);
    const [isOutdated, setIsOutdated] = useState(false);
    
    const { email, _hasHydrated } = useUserStore();
    const { 
        fortnitePath, setFortnitePath, 
        backendUrl, setBackendUrl, 
        hostUrl, setHostUrl,
        redirectDLL, setRedirectDLL,
        consoleDLL, setConsoleDLL
    } = useConfigStore();

    const compareVersions = (v1: string, v2: string) => {
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    };

    useEffect(() => {
        RpcStart().catch(console.error);

        const fetchData = async () => {
            try {
                const currentVersion = await getVersion();
                setAppVersion(currentVersion);

                // Fetch status
                const statusRes = await fetch('https://cdn.leilos.qzz.io/json/status.json');
                const statusJson = await statusRes.json();
                
                // Check version
                if (statusJson.version && compareVersions(statusJson.version, currentVersion) > 0) {
                    setIsOutdated(true);
                    return; // Stop loading if outdated
                }

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
                    services: statusJson.services,
                    news: newsData
                });
            } catch (error) {
                console.error('Failed to fetch server data:', error);
                // Fallback
                setServerData({ status: false });
            }
        };

        fetchData();
        // getVersion().then(setAppVersion).catch(() => {}); // Moved inside fetchData to sync with version check

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

    const chooseDLL = async (type: 'redirect' | 'console') => {
        try {
            const selected = await openDialog({
                multiple: false,
                filters: [{
                    name: 'DLL Files',
                    extensions: ['dll']
                }]
            });
    
            if (selected && typeof selected === 'string') {
                 if (type === 'redirect') setRedirectDLL(selected);
                 if (type === 'console') setConsoleDLL(selected);
            }
        } catch (error) {
            console.error('Failed to select DLL:', error);
        }
    };

    const clearDLL = (type: 'redirect' | 'console') => {
             if (type === 'redirect') setRedirectDLL('');
             if (type === 'console') setConsoleDLL('');
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
                            {/* Server Status Widget - Spans 2 columns (Larger) */}
                            <div className="md:col-span-2 bg-[#151921] rounded-2xl p-6 border border-white/5 flex flex-col justify-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                <h3 className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-gold-primary"></span>
                                    Estado del Sistema
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10 max-h-[150px] overflow-y-auto custom-scrollbar">
                                    {serverData?.services && serverData.services.length > 0 ? (
                                        serverData.services
                                            .map((service, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                                                <span className="text-sm font-medium text-gray-300">{service.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${
                                                        service.color === 'green' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
                                                        service.color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
                                                    }`}></span>
                                                    <span className="text-xs font-mono text-white uppercase">{service.status}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 col-span-2">
                                            <span className="text-sm font-medium text-gray-300">Servidores</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${serverData?.status ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                                                <span className="text-xs font-mono text-white">{serverData?.status ? 'ONLINE' : 'OFFLINE'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* User Welcome Card - Spans 1 column (Mini) */}
                            <div className="bg-[#151921] rounded-2xl p-6 border border-white/5 relative overflow-hidden group flex flex-col items-center justify-center text-center">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gold-primary/5 rounded-full blur-3xl -mr-10 -mt-10 transition-opacity group-hover:opacity-75"></div>
                                <div className="relative z-10 flex flex-col items-center gap-3">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-primary to-gold-highlight p-0.5 shadow-lg shadow-gold-primary/20">
                                        <div className="w-full h-full bg-[#1a1f2e] rounded-xl flex items-center justify-center overflow-hidden">
                                            <img src="/logo.jpg" alt="Leilos Logo" className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 font-medium text-xs mb-0.5">Bienvenido,</p>
                                        <h2 className="text-xl font-bold text-white font-display tracking-wide truncate max-w-[150px]">{email ? email.split('@')[0] : 'Invitado'}</h2>
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
                                        Únete a la resistencia y partele la boca con un 200 a tus enemigos. ¿Estás listo para el salto?
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
                    <div className="max-w-4xl mx-auto pt-10 animate-fade-in p-6 h-full overflow-y-auto">
                        <h2 className="text-3xl font-bold text-white mb-8 font-display">Configuración</h2>
                        
                        <div className="grid grid-cols-1 gap-6">
                            {/* Game Path Configuration */}
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
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shadow-lg shadow-gold-primary/20">
                                        <img src="/logo.jpg" alt="Leilos Logo" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white font-display">Leilos Launcher</h3>
                                        <p className="text-gray-500 text-sm">Versión {appVersion} • <span className="text-gold-primary">Stable</span></p>
                                    </div>
                                </div>
                                
                                <div className="flex gap-3">
                                    <button onClick={() => openShell('https://discord.gg/rNtPqQyBwg')} className="p-3 bg-white/5 rounded-xl hover:bg-[#5865F2]/20 hover:text-[#5865F2] transition-all border border-white/5 hover:border-[#5865F2]/30 group cursor-pointer">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="transition-transform group-hover:scale-110">
                                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
                                        </svg>
                                    </button>
                                    <button onClick={() => openShell('https://github.com/leilosFN')} className="p-3 bg-white/5 rounded-xl hover:bg-white/20 hover:text-white transition-all border border-white/5 hover:border-white/30 group cursor-pointer">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:scale-110"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                                    </button>
                                    <button onClick={() => openShell('https://leilos.qzz.io')} className="p-3 bg-white/5 rounded-xl hover:bg-gold-primary/20 hover:text-gold-primary transition-all border border-white/5 hover:border-gold-primary/30 group cursor-pointer">
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
                        <div className="helios-card overflow-hidden relative min-h-[500px] flex flex-col justify-center group">
                            {/* Background Image & Gradient */}
                            <div className="absolute inset-0 bg-[url('https://cdn.leilos.qzz.io/media/bg1.jpg')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14] via-[#0B0E14]/60 to-transparent"></div>
                            
                            {/* Content */}
                            <div className="relative z-10 p-8 md:p-12 max-w-2xl">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-5xl font-bold font-display text-white drop-shadow-lg">Fortnite</h2>
                                    <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-mono text-gray-400 border border-white/5 backdrop-blur-md">v28.30</span>
                                </div>
                                
                                <div className="flex items-center gap-3 mb-8">
                                    <span className="text-gold-primary font-medium tracking-widest text-sm uppercase font-display drop-shadow-md">Capítulo 5</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                                    <span className="text-gray-300 font-medium tracking-widest text-sm uppercase font-display drop-shadow-md">Temporada 1</span>
                                </div>
                                
                                <div className="mb-10 p-6 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-sm shadow-xl">
                                    <p className="text-gray-200 text-sm leading-relaxed font-medium">
                                        La temporada comenzó el <span className="text-white font-bold">3 de diciembre de 2023</span> y concluyó el <span className="text-white font-bold">8 de marzo de 2024</span>. 
                                        Experimenta el mapa y las armas clásicas exactamente como eran.
                                    </p>
                                </div>
                                
                                <div className="flex gap-4 mb-8">
                                    <button 
                                        onClick={handleStartDownload}
                                        disabled={downloadProgress?.state === 'downloading' || downloadProgress?.state === 'extracting'}
                                        className="w-full md:w-auto bg-gold-primary text-bg-dark px-10 py-4 rounded-xl font-bold hover:bg-gold-highlight transition-all duration-300 font-display tracking-widest disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transform hover:-translate-y-1 border border-gold-primary/20 min-w-[240px]"
                                    >
                                        {downloadProgress?.state === 'downloading' ? 'DESCARGANDO...' : 
                                         downloadProgress?.state === 'extracting' ? 'EXTRAYENDO...' : 'INSTALAR JUEGO'}
                                    </button>
                                </div>

                                {downloadProgress && (
                                    <div className="bg-black/60 p-5 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
                                        <div className="flex justify-between mb-3 text-sm font-display tracking-wide">
                                            <span className="capitalize text-gray-300 flex items-center gap-2">
                                                {downloadProgress.state === 'downloading' && <span className="animate-pulse text-gold-primary">●</span>}
                                                {downloadProgress.state}
                                            </span>
                                            <span className="text-gold-primary font-bold">{downloadProgress.percent}%</span>
                                        </div>
                                        <div className="w-full bg-black/50 h-3 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className="bg-gradient-to-r from-gold-primary to-gold-highlight h-full transition-all duration-300 shadow-[0_0_15px_rgba(212,175,55,0.5)] relative" 
                                                style={{ width: `${downloadProgress.percent}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-xs text-gray-400 text-right font-mono flex justify-end gap-2">
                                            <span>{(downloadProgress.downloaded / 1024 / 1024).toFixed(2)} MB</span>
                                            <span className="text-gray-600">/</span>
                                            <span>{(downloadProgress.total / 1024 / 1024).toFixed(2)} MB</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            default:
                return <div>View not found</div>;
        }
    };

    if (isOutdated) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-black/95 text-white p-6 relative overflow-hidden">
                {/* Background effects */}
                <div className="absolute inset-0 bg-[url('https://cdn.leilos.qzz.io/media/bg1.jpg')] bg-cover bg-center opacity-20 blur-sm"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
                
                <div className="relative z-10 text-center space-y-8 max-w-md w-full p-10 rounded-2xl bg-[#151921] border border-orange-500/30 shadow-[0_0_50px_rgba(249,115,22,0.15)] flex flex-col items-center">
                    
                    {/* Warning Icon */}
                    <div className="w-24 h-24 rounded-full bg-orange-500/10 flex items-center justify-center mb-2 animate-pulse shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-orange-500">
                            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                        </svg>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-white font-display tracking-wide">ACTUALIZACIÓN<br/>REQUERIDA</h1>
                        <div className="h-1 w-20 bg-orange-500 mx-auto rounded-full"></div>
                    </div>
                    
                    <p className="text-gray-400 font-rajdhani text-lg leading-relaxed">
                        Tu versión actual <span className="text-orange-400 font-mono font-bold">v{appVersion}</span> está obsoleta.
                        <br/>
                        Para seguir jugando, necesitas descargar la última versión del launcher.
                    </p>

                    <button 
                        onClick={() => open('https://leilos.qzz.io/downloads')}
                        className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold rounded-xl hover:from-orange-500 hover:to-orange-400 transition-all duration-300 font-display tracking-widest shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] transform hover:-translate-y-1 uppercase flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Descargar Actualización
                    </button>
                    
                    <p className="text-xs text-gray-600 font-mono">Leilos Launcher • Sistema de Seguridad</p>
                </div>
            </div>
        );
    }

    return (
        <Layout currentView={currentView} onChangeView={setCurrentView}>
            <Particles className="absolute inset-0 z-0 pointer-events-none" quantity={50} />
            <div className="relative z-10 w-full h-full">
                {renderContent()}
            </div>
            
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