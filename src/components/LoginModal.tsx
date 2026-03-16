import React, { useState } from 'react';
import { open as openShell } from '@tauri-apps/api/shell';
import { useUserStore } from '../stores/userStore';
import { useConfigStore } from '../stores/configStore';
import { useTranslation } from '../utils/translations';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const { discordId, setCredentials, fetchUserProfile } = useUserStore();
    const { language, setLanguage } = useConfigStore();
    const { t } = useTranslation();
    const [localDiscordId, setLocalDiscordId] = useState(discordId || '');

    if (!isOpen) return null;

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        if (!localDiscordId) {
            alert(t('login.error'));
            return;
        }

        // Fixed password as requested previously
        const fixedPassword = '1234567890';
        const email = `${localDiscordId}@leilos.tf`;
        
        setCredentials(localDiscordId, email, fixedPassword);
        
        // Fetch profile info immediately after login to get username and avatar
        fetchUserProfile(localDiscordId).catch(console.error);
        
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in p-6">
            {/* Background Image with blur restored */}
            <div className="absolute inset-0 bg-[url('https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg')] bg-cover bg-center opacity-30 blur-sm"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50"></div>

            <div className="relative z-10 w-full max-w-[420px] glass-panel rounded-2xl overflow-hidden p-8 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
                
                {/* Language Switcher */}
                <div className="absolute top-4 right-4 flex gap-2">
                    {['es', 'en'].map((lang) => (
                        <button 
                            key={lang}
                            onClick={() => setLanguage(lang as any)}
                            className={`px-2 py-1 text-[10px] font-bold rounded transition-all uppercase ${
                                language === lang 
                                ? 'text-gold-primary bg-gold-primary/10 border border-gold-primary/20' 
                                : 'text-gray-600 hover:text-gray-400'
                            }`}
                        >
                            {lang}
                        </button>
                    ))}
                </div>

                <div className="text-center mb-8 mt-4">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl p-0.5 bg-gradient-to-br from-gold-primary/50 to-transparent shadow-[0_0_30px_rgba(212,175,55,0.1)]">
                        <div className="w-full h-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
                            <img src="https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg" alt="Leilos" className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2 font-display tracking-widest text-gradient-gold">{t('login.title')}</h2>
                    <p className="text-gray-500 text-xs font-sans tracking-[0.3em] uppercase">{t('login.subtitle')}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="group">
                        <label className="block text-gray-500 text-[10px] font-bold mb-2 uppercase tracking-widest font-display group-focus-within:text-gold-primary transition-colors">{t('login.email')}</label>
                        <input
                            type="text"
                            value={localDiscordId}
                            onChange={(e) => setLocalDiscordId(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3.5 text-white text-sm focus:border-gold-primary/50 focus:bg-black/60 focus:ring-1 focus:ring-gold-primary/20 transition-all outline-none placeholder:text-gray-700 font-mono"
                            placeholder="Tu ID de Discord"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gold-primary text-black font-bold py-3.5 rounded-xl hover:bg-gold-highlight transition-all duration-300 font-display tracking-widest uppercase shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transform hover:-translate-y-0.5 active:scale-95"
                    >
                        {t('login.button')}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/5">
                    <button
                        type="button"
                        onClick={() => {
                            openShell('https://api.leilos.qzz.io/api/v2/discord/login');
                        }}
                        className="w-full glass-button text-[#5865F2] hover:bg-[#5865F2]/10 hover:border-[#5865F2]/40 font-bold py-3 rounded-xl transition-all duration-300 font-display tracking-widest uppercase text-xs flex items-center justify-center gap-2 group"
                    >
                        <i className="fa-brands fa-discord text-lg group-hover:scale-110 transition-transform"></i>
                        <span>Gestionar Cuenta</span>
                    </button>
                    
                    <p className="mt-4 text-[9px] text-center text-gray-700 uppercase tracking-[0.2em] font-display">
                        {t('login.footer')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
