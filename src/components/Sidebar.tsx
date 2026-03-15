import React from 'react';
import { useUserStore } from '../stores/userStore';
import { useTranslation } from '../utils/translations';

interface SidebarProps {
    currentView: string;
    onChangeView: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
    const { email, username, avatar, clearCredentials } = useUserStore();
    const { t } = useTranslation();

    const navItems = [
        { id: 'home', label: t('nav.home'), icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        )},
        { id: 'download', label: t('nav.download'), icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        )},
        { id: 'settings', label: t('nav.settings'), icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        )},
    ];

    return (
        <div className="w-20 lg:w-64 h-full bg-[#0F1219] flex flex-col shrink-0 transition-all duration-300">
            {/* Logo Area */}
            <div className="p-6 flex items-center justify-center lg:justify-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gold-primary to-gold-highlight rounded-xl flex items-center justify-center shadow-lg shadow-gold-primary/20">
                    <span className="font-bold text-black text-lg font-display">L</span>
                </div>
                <h1 className="hidden lg:block text-xl font-bold tracking-wider text-white font-display">LEILOS</h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 flex flex-col gap-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onChangeView(item.id)}
                        className={`
                            group flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200
                            ${currentView === item.id 
                                ? 'bg-gold-primary text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]' 
                                : 'text-gray-400 hover:text-white hover:bg-white/5'}
                        `}
                        title={item.label}
                    >
                        <div className={`w-6 h-6 flex items-center justify-center ${currentView === item.id ? 'text-black' : 'text-current'}`}>
                            {item.icon}
                        </div>
                        <span className={`hidden lg:block font-medium tracking-wide ${currentView === item.id ? 'font-bold' : ''}`}>{item.label}</span>
                        
                        {/* Active Indicator for collapsed view */}
                        {currentView === item.id && (
                            <div className="lg:hidden absolute left-0 w-1 h-8 bg-gold-primary rounded-r-full" />
                        )}
                    </button>
                ))}
            </nav>

            {/* User Profile */}
            <div className="p-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors cursor-default group">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-sm font-bold text-white shadow-inner overflow-hidden">
                        {avatar ? (
                            <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            email ? email.substring(0, 2).toUpperCase() : '??'
                        )}
                    </div>
                    <div className="hidden lg:block flex-1 overflow-hidden">
                        <p className="text-sm font-bold text-white truncate font-display">{username || (email ? email.split('@')[0] : t('home.guest'))}</p>
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-xs text-gray-400">{t('home.welcome')}</p>
                        </div>
                    </div>
                    <button 
                        onClick={clearCredentials}
                        className="hidden lg:block text-gray-500 hover:text-red-400 transition-colors p-1"
                        title="Cerrar Sesión"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
