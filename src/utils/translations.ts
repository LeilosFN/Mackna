import { useConfigStore, Language } from '../stores/configStore';

const translations = {
    es: {
        login: {
            title: 'INICIAR SESIÓN',
            subtitle: 'Bienvenido a Leilos',
            email: 'Correo',
            password: 'Contraseña',
            button: 'Entrar',
            footer: 'Protegido por Seguridad Leilos',
            error: 'Por favor ingresa correo y contraseña'
        },
        nav: {
            home: 'Inicio',
            settings: 'Ajustes',
            download: 'Descargar'
        },
        home: {
            systemStatus: 'Estado del Sistema',
            welcome: 'Bienvenido',
            guest: 'Invitado',
            season: 'TEMPORADA ?',
            chapter: 'CAPÍTULO ?',
            heroTitle: 'MACKNA 404 NOT FOUND',
            heroDesc: '¿?¿?¿?¿?',
            launch: 'INICIAR',
            launching: 'INICIANDO...',
            stop: 'DETENER JUEGO',
            error: 'ERROR - REINTENTAR'
        },
        settings: {
            title: 'Configuración',
            gamePath: 'Ruta de Instalación',
            gamePathDesc: 'Ubicación de los archivos del juego (Build 24.20)',
            changePath: 'Cambiar Ruta',
            notSelected: 'No seleccionado',
            language: 'Idioma del Launcher',
            languageDesc: 'Selecciona tu idioma preferido',
            about: 'Sobre Leilos Launcher',
            version: 'Versión',
            stable: 'Estable'
        },
        download: {
            title: 'Fortnite',
            chapter: 'Capítulo ?',
            season: 'Temporada ?',
            desc: '¿?¿?¿?¿?',
            install: 'INSTALAR JUEGO',
            downloading: 'DESCARGANDO...',
            extracting: 'EXTRAYENDO...',
            mb: 'MB'
        },
        notifications: {
            title: 'Leilos Launcher',
            gameLaunching: 'Iniciando Juego',
            firstTimeMsg: 'Ten en cuenta que la primera vez puede tardar un poco, ¡la segunda ya será más rápido!'
        }
    },
    en: {
        login: {
            title: 'LOGIN',
            subtitle: 'ENTER THE UNDERWORLD',
            email: 'Email',
            password: 'Password',
            button: 'Login',
            footer: 'Protected by Leilos Security',
            error: 'Please enter email and password'
        },
        nav: {
            home: 'Home',
            settings: 'Settings',
            download: 'Download'
        },
        home: {
            systemStatus: 'System Status',
            welcome: 'Welcome',
            guest: 'Guest',
            season: 'SEASON ?',
            chapter: 'CHAPTER ?',
            heroTitle: 'MACKNA 404 NOT FOUND',
            heroDesc: '¿?¿?¿?¿?',
            launch: 'LAUNCH',
            launching: 'LAUNCHING...',
            stop: 'STOP GAME',
            error: 'ERROR - RETRY'
        },
        settings: {
            title: 'Settings',
            gamePath: 'Installation Path',
            gamePathDesc: 'Location of game files (Build 24.20)',
            changePath: 'Change Path',
            notSelected: 'Not selected',
            language: 'Launcher Language',
            languageDesc: 'Select your preferred language',
            about: 'About Leilos Launcher',
            version: 'Version',
            stable: 'Stable'
        },
        download: {
            title: 'Fortnite',
            chapter: 'Chapter ?',
            season: 'Season ?',
            desc: '¿?¿?¿?¿?',
            install: 'INSTALL GAME',
            downloading: 'DOWNLOADING...',
            extracting: 'EXTRACTING...',
            mb: 'MB'
        },
        notifications: {
            title: 'Leilos Launcher',
            gameLaunching: 'Starting Game',
            firstTimeMsg: 'Keep in mind that the first time may take a while, the second time will be faster!'
        }
    }
};

export const useTranslation = () => {
    const language = useConfigStore((state) => state.language);
    
    const t = (path: string) => {
        const keys = path.split('.');
        let current: any = translations[language];
        
        for (const key of keys) {
            if (current[key] === undefined) {
                return path; // Fallback to path string if not found
            }
            current = current[key];
        }
        
        return current;
    };

    return { t, language };
};
