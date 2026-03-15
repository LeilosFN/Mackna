import React, { useState } from 'react';
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
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black animate-fade-in overflow-hidden">
            {/* Background Image with blur */}
            <div className="absolute inset-0 bg-[url('https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg')] bg-cover bg-center opacity-30 blur-sm"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>

            <div className="relative z-10 w-full max-w-md bg-[#151921]/90 border border-gold-primary/20 rounded-2xl shadow-[0_0_50px_rgba(212,175,55,0.15)] overflow-hidden p-10 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
                {/* Language Switcher in Login */}
                <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                        onClick={() => setLanguage('es')}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${language === 'es' ? 'bg-gold-primary text-bg-dark' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                    >
                        ES
                    </button>
                    <button 
                        onClick={() => setLanguage('en')}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${language === 'en' ? 'bg-gold-primary text-bg-dark' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                    >
                        EN
                    </button>
                </div>

                <div className="text-center mb-10">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gold-primary to-gold-highlight p-0.5 shadow-lg shadow-gold-primary/20 mx-auto mb-6">
                        <div className="w-full h-full bg-[#1a1f2e] rounded-xl flex items-center justify-center overflow-hidden">
                            <img src="https://cdn.leilos.qzz.io/public/media/images/logo/logo.jpg" alt="Leilos Logo" className="w-full h-full object-cover" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2 font-display tracking-widest">{t('login.title')}</h2>
                    <p className="text-gold-primary/60 text-xs font-sans tracking-[0.2em] uppercase">{t('login.subtitle')}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-gray-400 text-[10px] font-bold mb-2 uppercase tracking-widest font-display">{t('login.email')}</label>
                        <input
                            type="text"
                            value={localDiscordId}
                            onChange={(e) => setLocalDiscordId(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-gold-primary/50 transition-all outline-none"
                            placeholder="Tu ID de Discord"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gold-primary text-bg-dark font-bold py-4 rounded-xl hover:bg-gold-highlight transition-all duration-300 font-display tracking-widest uppercase shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30_rgba(212,175,55,0.5)] transform hover:-translate-y-1 active:scale-95"
                    >
                        {t('login.button')}
                    </button>
                </form>

                <div className="mt-10 text-center border-t border-white/5 pt-6">
                    <p className="text-[9px] text-gray-600 uppercase tracking-[0.3em] font-display">
                        {t('login.footer')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
