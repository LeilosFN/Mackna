import React, { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api';
import { open as openShell } from '@tauri-apps/api/shell';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/api/notification';
import { useTranslation } from './utils/translations';
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

interface UserLoginPayload {
    discordId: string;
    username: string;
    avatar: string;
}

const App: React.FC = () => {
    const [currentView, setCurrentView] = useState('home');
    const [appVersion, setAppVersion] = useState<string>('1.1.2');
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadState | null>(null);
    const [serverData, setServerData] = useState<{ status: boolean; services?: Service[]; news?: { title: string; content: string; date: string } } | null>(null);
    const [isOutdated, setIsOutdated] = useState(false);
    const [currentServiceIndex, setCurrentServiceIndex] = useState(0);
    
    const { t } = useTranslation();
    const { email, discordId, username, avatar, fetchUserProfile, setCredentials, setUserInfo, _hasHydrated } = useUserStore();

    useEffect(() => {
        const unlistenLogin = listen<UserLoginPayload>('user-login-success', (event) => {
            const { discordId, username, avatar } = event.payload;
            const email = `${discordId}@leilos.tf`;
            const fixedPassword = '1234567890';
            
            setCredentials(discordId, email, fixedPassword);
            setUserInfo(username, avatar);
            setIsLoginOpen(false);
        });

        return () => {
            unlistenLogin.then(f => f());
        };
    }, [setCredentials, setUserInfo]);
    const { 
        fortnitePath, setFortnitePath, 
        backendUrl, setBackendUrl, 
        hostUrl, setHostUrl,
        redirectDLL, setRedirectDLL,
        consoleDLL, setConsoleDLL,
        language, setLanguage
    } = useConfigStore();

    useEffect(() => {
        if (discordId && !username) {
            fetchUserProfile(discordId);
        }
    }, [discordId, username, fetchUserProfile]);

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
                const statusRes = await fetch('https://cdn.leilos.qzz.io/api/status.json');
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
                        const newsRes = await fetch('https://cdn.leilos.qzz.io/api/news.json');
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

        // Notificación de inicio del juego (Solicitado por el usuario)
        const unlistenLaunching = listen<string>('game-launching', async (event) => {
            try {
                let permissionGranted = await isPermissionGranted();
                if (!permissionGranted) {
                    const permission = await requestPermission();
                    permissionGranted = permission === 'granted';
                }
                
                if (permissionGranted) {
                    const messageKey = event.payload === 'gameLaunching' ? 'notifications.firstTimeMsg' : event.payload;
                    sendNotification({ 
                        title: t('notifications.title'), 
                        body: t(messageKey) 
                    });
                }
            } catch (err) {
                console.error('Error al enviar la notificación:', err);
            }
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
            unlistenLaunching.then(f => f());
            unlistenStatus.then(f => f());
            unlistenDownload.then(f => f());
            clearInterval(intervalId);
        };
    }, []);

    const handleSelectPath = async () => {
        try {
            const path = await invoke<string>('select_folder');
            if (path) {
                // Check if the selected path contains Fortnite v28.30
                const isCorrectVersion = await invoke<boolean>('check_fortnite_version', { path });
                if (!isCorrectVersion) {
                    alert('Error: La versión seleccionada no es compatible. Por favor, selecciona la carpeta de Fortnite versión v28.30 exacta.');
                    return;
                }
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
            await openShell('https://mini.crisu.qzz.io/?d=LeilosFiles');
        } catch (error) {
            console.error('Failed to open download link:', error);
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

    useEffect(() => {
        if (!serverData?.services || serverData.services.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentServiceIndex((prev) => (prev + 1) % serverData.services!.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [serverData]);

    if (!_hasHydrated) {
        return <div className="flex items-center justify-center h-screen bg-bg-dark text-gold-primary font-display">{t('home.loadingSystem')}</div>;
    }

    const renderContent = () => {
        switch (currentView) {
            case 'home':
                return (
                    <div key="home" className="flex flex-col h-full animate-fade-in-up p-4 gap-6">
                        {/* Top Bar: User Profile & Quick Actions */}
                        <div className="flex flex-col md:flex-row gap-6">
                            
                            {/* User Profile Card */}
                            <div className="glass-panel rounded-2xl p-5 flex items-center gap-5 relative overflow-hidden group min-w-[300px]">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gold-primary/10 rounded-full blur-2xl -mr-8 -mt-8 transition-opacity group-hover:opacity-100 opacity-50"></div>
                                
                                <div className="relative z-10 w-16 h-16 rounded-xl p-0.5 bg-gradient-to-br from-gold-primary to-transparent">
                                    <div className="w-full h-full bg-black rounded-[10px] overflow-hidden">
                                        <img src={avatar || "https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg"} alt="User" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                
                                <div className="flex flex-col gap-1 relative z-10 flex-1">
                                    <h2 className="text-xl font-bold text-white font-display tracking-wide truncate">{username || (email ? email.split('@')[0] : t('home.guest'))}</h2>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => openShell('https://api.leilos.qzz.io/api/v2/discord/login')} 
                                            className="text-[10px] font-bold px-3 py-1 bg-[#5865F2]/10 text-[#5865F2] hover:bg-[#5865F2] hover:text-white border border-[#5865F2]/30 rounded-lg transition-all flex items-center gap-2 uppercase tracking-wider"
                                        >
                                            <i className="fa-brands fa-discord"></i>
                                            {t('home.account')}
                                        </button>
                                        <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                            <span className="text-[10px] text-green-500 font-mono">{t('home.online')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Server Status - Compact */}
                            <div className="glass-panel rounded-2xl p-5 flex-1 flex flex-col justify-center relative overflow-hidden">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-gray-400 text-[10px] font-bold tracking-[0.2em] uppercase flex items-center gap-2">
                                        <i className="fa-solid fa-server text-gold-primary"></i>
                                        {t('home.systemStatus')}
                                    </h3>
                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${serverData?.status ? 'text-green-400 border-green-500/30 bg-green-500/5' : 'text-red-400 border-red-500/30 bg-red-500/5'}`}>
                                        {serverData?.status ? t('home.operational') : t('home.issues')}
                                    </span>
                                </div>
                                <div className="relative h-10 flex items-center overflow-hidden bg-white/5 border border-white/5 rounded-xl px-4">
                                    {serverData?.services && serverData.services.length > 0 ? (
                                        <div 
                                            key={currentServiceIndex} 
                                            className="w-full flex items-center justify-between animate-fade-in-up"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`w-2 h-2 rounded-full ${serverData.services[currentServiceIndex].color === 'green' ? 'bg-green-500 shadow-[0_0_8px_lime]' : serverData.services[currentServiceIndex].color === 'red' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                                                <span className="text-sm font-medium text-gray-200">{serverData.services[currentServiceIndex].name}</span>
                                            </div>
                                            <span className="text-xs font-mono text-white/50 uppercase">{serverData.services[currentServiceIndex].status}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-500 italic">{t('home.loading')}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Main Hero Section */}
                        <div className="flex-1 glass-panel rounded-3xl overflow-hidden relative group flex flex-col justify-end">
                            {/* Dynamic Background */}
                            <div className="absolute inset-0 bg-[url('https://cdn.leilos.qzz.io/public/media/images/logo/logo.png')] bg-cover bg-center opacity-60 transition-transform duration-[20s] ease-linear group-hover:scale-105"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent"></div>
                            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent opacity-60"></div>
                            
                            {/* Content */}
                            <div className="relative z-10 p-8 md:p-10 w-full max-w-4xl">
                                <div className="flex items-center gap-3 mb-4 animate-fade-in-up delay-100">
                                    <div className="px-3 py-1 rounded-full bg-gold-primary text-black text-[10px] font-black tracking-widest uppercase border border-gold-primary shadow-[0_0_15px_rgba(212,175,55,0.4)]">
                                        {t('home.season')}
                                    </div>
                                    <div className="px-3 py-1 rounded-full glass-button text-white text-[10px] font-bold tracking-widest uppercase backdrop-blur-md">
                                        {t('home.chapter')}
                                    </div>
                                </div>
                                
                                <h1 className="text-5xl md:text-6xl font-black text-white mb-4 font-display tracking-tight leading-none drop-shadow-2xl animate-fade-in-up delay-200">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">{t('home.heroTitle')}</span>
                                    <br />
                                    <span className="text-gradient-gold">{t('home.heroSubtitle')}</span>
                                </h1>
                                
                                <p className="text-gray-300 mb-8 max-w-lg text-sm leading-relaxed font-medium drop-shadow-md border-l-2 border-gold-primary pl-4 animate-fade-in-up delay-300">
                                    {t('home.heroDesc')}
                                </p>
                                
                                <div className="animate-fade-in-up delay-300">
                                    <LaunchButton />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'settings':
                return (
                    <div key="settings" className="max-w-4xl mx-auto pt-4 animate-fade-in-up p-4 h-full overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-4 mb-8">
                            <h2 className="text-3xl font-bold text-white font-display tracking-wide">{t('settings.title')}</h2>
                            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6 pb-8">
                            {/* Language Configuration */}
                            <div className="glass-panel rounded-2xl p-6 border border-white/5 relative overflow-hidden group hover:border-gold-primary/30 transition-all">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-primary/5 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-50"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white font-display tracking-wide">{t('settings.language')}</h3>
                                            <p className="text-gray-400 text-xs font-medium">{t('settings.languageDesc')}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setLanguage('es')}
                                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border font-display tracking-wider ${language === 'es' ? 'bg-gold-primary text-bg-dark border-gold-primary shadow-[0_0_15px_rgba(212,175,55,0.3)] transform scale-[1.02]' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            ESPAÑOL
                                        </button>
                                        <button 
                                            onClick={() => setLanguage('en')}
                                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border font-display tracking-wider ${language === 'en' ? 'bg-gold-primary text-bg-dark border-gold-primary shadow-[0_0_15px_rgba(212,175,55,0.3)] transform scale-[1.02]' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            ENGLISH
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Game Path Configuration */}
                            <div className="glass-panel rounded-2xl p-6 border border-white/5 relative overflow-hidden group hover:border-gold-primary/30 transition-all">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-primary/5 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-50"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white font-display tracking-wide">{t('settings.gamePath')}</h3>
                                            <p className="text-gray-400 text-xs font-medium">{t('settings.gamePathDesc')}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col md:flex-row gap-4 items-center">
                                        <div className="w-full flex-1 bg-black/40 rounded-xl border border-white/10 px-4 py-3.5 flex items-center gap-3 group-hover:border-white/20 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 shrink-0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                            <span className="text-gray-300 font-mono text-xs truncate select-all">{fortnitePath || t('settings.notSelected')}</span>
                                        </div>
                                        <button 
                                            onClick={handleSelectPath}
                                            className="w-full md:w-auto bg-white/5 hover:bg-white/10 text-white px-6 py-3.5 rounded-xl font-bold text-xs transition-all border border-white/10 hover:border-white/30 font-display tracking-widest uppercase hover:shadow-lg active:scale-95 whitespace-nowrap"
                                        >
                                            {t('settings.changePath')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* About Section - Simplified & Clean */}
                            <div className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-gold-primary/30 transition-all">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg shadow-gold-primary/10 border border-white/10 p-1 bg-gradient-to-br from-white/10 to-transparent">
                                        <div className="w-full h-full rounded-xl overflow-hidden bg-black">
                                            <img src="https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg" alt="Leilos Logo" className="w-full h-full object-cover opacity-90" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white font-display tracking-wide">Leilos Launcher</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-300 border border-white/5">v{appVersion}</span>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                                                <span className="w-1 h-1 rounded-full bg-green-400"></span>
                                                {t('settings.stable')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-3">
                                    <button onClick={() => openShell('https://discord.gg/rNtPqQyBwg')} className="p-3 bg-white/5 rounded-xl hover:bg-[#5865F2] hover:text-white text-[#5865F2] transition-all border border-white/10 hover:border-[#5865F2] group cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(88,101,242,0.4)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="transition-transform group-hover:scale-110">
                                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
                                        </svg>
                                    </button>
                                    <button onClick={() => openShell('https://github.com/leilosFN')} className="p-3 bg-white/5 rounded-xl hover:bg-white hover:text-black text-white transition-all border border-white/10 hover:border-white group cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:scale-110"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                                    </button>
                                    <button onClick={() => openShell('https://leilos.qzz.io')} className="p-3 bg-white/5 rounded-xl hover:bg-gold-primary hover:text-bg-dark text-gold-primary transition-all border border-white/10 hover:border-gold-primary group cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:scale-110"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'download':
                return (
                    <div key="download" className="flex flex-col h-full animate-fade-in-up p-4">
                        <div className="flex-1 glass-panel rounded-3xl overflow-hidden relative group flex flex-col justify-end">
                            {/* Dynamic Background */}
                            <div className="absolute inset-0 bg-[url('https://cdn.leilos.qzz.io/public/media/images/logo/logo.png')] bg-cover bg-center opacity-60 transition-transform duration-[20s] ease-linear group-hover:scale-105"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent"></div>
                            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent opacity-60"></div>
                            
                            {/* Content */}
                            <div className="relative z-10 p-8 md:p-10 w-full max-w-4xl">
                                <div className="flex items-center gap-3 mb-4 animate-fade-in-up delay-100">
                                    <div className="px-3 py-1 rounded-full bg-gold-primary text-black text-[10px] font-black tracking-widest uppercase border border-gold-primary shadow-[0_0_15px_rgba(212,175,55,0.4)]">
                                        {t('download.season')}
                                    </div>
                                    <div className="px-3 py-1 rounded-full glass-button text-white text-[10px] font-bold tracking-widest uppercase backdrop-blur-md">
                                        {t('download.chapter')}
                                    </div>
                                </div>
                                
                                <h1 className="text-5xl md:text-6xl font-black text-white mb-4 font-display tracking-tight leading-none drop-shadow-2xl animate-fade-in-up delay-200">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">{t('download.heroTitle')}</span>
                                    <br />
                                    <span className="text-gradient-gold">{t('download.heroSubtitle')}</span>
                                </h1>
                                
                                <p className="text-gray-300 mb-8 max-w-lg text-sm leading-relaxed font-medium drop-shadow-md border-l-2 border-gold-primary pl-4 animate-fade-in-up delay-300">
                                    {t('download.desc')}
                                </p>
                                
                                <div className="animate-fade-in-up delay-300">
                                    <button 
                                        onClick={handleStartDownload}
                                        className="relative px-10 py-4 font-black text-lg transition-all duration-300 transform font-display tracking-[0.2em] uppercase overflow-hidden group bg-gradient-to-r from-gold-primary to-gold-secondary text-bg-dark hover:shadow-[0_0_50px_rgba(212,175,55,0.4)] hover:scale-105 active:scale-95"
                                        style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0% 100%)" }}
                                    >
                                        {/* Shine effect overlay */}
                                        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10"></div>
                                        
                                        <div className="relative z-20 flex items-center gap-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                            </svg>
                                            <span>{t('download.install')}</span>
                                        </div>
                                    </button>
                                </div>
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
                <div className="absolute inset-0 bg-[url('https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg')] bg-cover bg-center opacity-20 blur-sm"></div>
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

    if (!email) {
        return (
            <>
                <Particles className="absolute inset-0 z-0 pointer-events-none" quantity={50} />
                <LoginModal 
                    isOpen={true} 
                    onClose={() => {}} 
                />
            </>
        );
    }

    return (
        <Layout currentView={currentView} onChangeView={setCurrentView}>
            <Particles className="absolute inset-0 z-0 pointer-events-none" quantity={50} />
            <div className="relative z-10 w-full h-full">
                {renderContent()}
            </div>
        </Layout>
    );
};

export default App;