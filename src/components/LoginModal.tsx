import React, { useState } from 'react';
import { open as openShell } from '@tauri-apps/api/shell';
import { useUserStore } from '../stores/userStore';
import { useConfigStore } from '../stores/configStore';
import { useTranslation } from '../utils/translations';

import { useGameStore } from '../stores/gameStore';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const { discordId, setCredentials, fetchUserProfile } = useUserStore();
    const { language, setLanguage } = useConfigStore();
    const { t } = useTranslation();
    const [localDiscordId, setLocalDiscordId] = useState(discordId || '');
    const { setErrorMsg } = useGameStore();

    if (!isOpen) return null;

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        if (!localDiscordId) {
            setErrorMsg(t('login.error'));
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

                <div className="space-y-6">
                    <button
                        type="button"
                        onClick={() => {
                            openShell('https://api.leilos.qzz.io/api/v2/discord/launcher?port=4080');
                        }}
                        className="w-full bg-[#5865F2] text-white font-bold py-4 rounded-xl hover:bg-[#4752C4] transition-all duration-300 font-display tracking-widest uppercase shadow-[0_0_20px_rgba(88,101,242,0.3)] hover:shadow-[0_0_30px_rgba(88,101,242,0.5)] transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-4 group"
                    >
                        <svg className="w-6 h-6 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z"/>
                        </svg>
                        <span className="text-sm">{t('login.discord')}</span>
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5">
                    <p className="text-[9px] text-center text-gray-700 uppercase tracking-[0.2em] font-display">
                        {t('login.footer')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
