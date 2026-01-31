import React, { useState } from 'react';
import { useUserStore } from '../stores/userStore';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const { email, setCredentials } = useUserStore();
    const [localEmail, setLocalEmail] = useState(email || '');
    const [localPassword, setLocalPassword] = useState('');

    if (!isOpen) return null;

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        if (!localEmail || !localPassword) {
            alert('Por favor ingresa correo y contraseña');
            return;
        }

        setCredentials(localEmail, localPassword);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-dark-bg border border-gold-primary/20 rounded shadow-[0_0_50px_rgba(212,175,55,0.1)] overflow-hidden p-8" onClick={(e) => e.stopPropagation()}>
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gold-primary mb-2 font-display tracking-widest">INICIAR SESIÓN</h2>
                    <p className="text-gray-400 text-sm font-sans tracking-wide">ENTRA AL SUBMUNDO</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-gold-primary/80 text-xs font-bold mb-2 uppercase tracking-wider font-display">Correo</label>
                        <input
                            type="text"
                            value={localEmail}
                            onChange={(e) => setLocalEmail(e.target.value)}
                            className="input-field"
                            placeholder="usuario@email.com"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-gold-primary/80 text-xs font-bold mb-2 uppercase tracking-wider font-display">Contraseña</label>
                        <input
                            type="password"
                            value={localPassword}
                            onChange={(e) => setLocalPassword(e.target.value)}
                            className="input-field"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gold-primary text-bg-dark font-bold py-3 rounded hover:bg-gold-secondary transition-all duration-300 font-display tracking-widest uppercase shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transform hover:scale-[1.02]"
                    >
                        Entrar
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-white/5 pt-4">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest font-display">
                        Protegido por Seguridad Leilos
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
