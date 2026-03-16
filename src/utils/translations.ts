import { useConfigStore, Language } from '../stores/configStore';

const translations = {
    es: {
        login: {
            title: 'INICIAR SESIÓN',
            subtitle: 'Bienvenido a Leilos',
            email: 'Ingresa tu ID de Discord',
            button: 'Entrar',
            footer: 'Protegido por Seguridad Leilos',
            error: 'Por favor ingresa tu ID de Discord'
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
            season: 'TEMPORADA 1',
            chapter: 'CAPÍTULO 5',
            heroTitle: 'Contra Cultura',
            heroSubtitle: 'Proyecto Leilos',
            heroDesc: ':)',
            launch: 'INICIAR',
            launching: 'INICIANDO...',
            stop: 'DETENER JUEGO',
            error: 'ERROR - REINTENTAR',
            account: 'CUENTA',
            online: 'EN LÍNEA',
            operational: 'OPERATIVO',
            issues: 'PROBLEMAS DETECTADOS',
            loading: 'Cargando servicios...',
            loadingSystem: 'CARGANDO SISTEMA...'
        },
        settings: {
            title: 'Configuración',
            gamePath: 'Ruta de Instalación',
            gamePathDesc: 'Ubicación de los archivos del juego (Build 28.30)',
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
            chapter: 'Capítulo 5',
            season: 'Temporada 1',
            heroTitle: 'Descarga',
            heroSubtitle: 'Versión 28.30',
            desc: ':)',
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
            subtitle: 'Welcome to Leilos',
            email: 'Enter your Discord ID',
            button: 'Login',
            footer: 'Protected by Leilos Security',
            error: 'Please enter your Discord ID'
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
            season: 'SEASON 1',
            chapter: 'CHAPTER 5',
            heroTitle: 'Underground',
            heroSubtitle: 'Project Leilos',
            heroDesc: ':)',
            launch: 'LAUNCH',
            launching: 'LAUNCHING...',
            stop: 'STOP GAME',
            error: 'ERROR - RETRY',
            account: 'ACCOUNT',
            online: 'ONLINE',
            operational: 'OPERATIONAL',
            issues: 'ISSUES DETECTED',
            loading: 'Loading services...',
            loadingSystem: 'LOADING SYSTEM...'
        },
        settings: {
            title: 'Settings',
            gamePath: 'Installation Path',
            gamePathDesc: 'Location of game files (Build 28.30)',
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
            chapter: 'Chapter 5',
            season: 'Season 1',
            heroTitle: 'Download',
            heroSubtitle: 'Version 28.30',
            desc: ':)',
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
