import { useConfigStore, Language } from '../stores/configStore';

const translations = {
    es: {
        login: {
            title: 'INICIAR SESIÓN',
            subtitle: 'Bienvenido a Leilos',
            email: 'Ingresa tu ID de Leilos',
            button: 'Entrar',
            discord: 'INICIAR SESIÓN CON DISCORD',
            register: 'REGÍSTRATE O ACCEDE A TU CUENTA',
            footer: 'Leilos • Crisutf',
            error: 'Por favor ingresa tu ID de Leilos',
        },
        nav: {
            home: 'Inicio',
            settings: 'Ajustes',
            download: 'Descargar',
            logout: 'Cerrar Sesión',
            minimize: 'Minimizar',
            close: 'Cerrar'
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
            issues: 'REVISANDO SISTEMA...',
            loading: 'Cargando servicios...',
            loadingSystem: 'CARGANDO SISTEMA...',
            errorDetected: 'ERROR DETECTADO',
            accept: 'ACEPTAR',
            versionError: 'La versión seleccionada no es compatible. Por favor, selecciona la carpeta de Fortnite versión v28.30 exacta.'
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
        },
        splash: {
            verifying: 'Verificando servidores...',
            loading: 'Cargando juego...'
        }
    },
    en: {
        login: {
            title: 'LOGIN',
            subtitle: 'Welcome to Leilos',
            email: 'Enter your Leilos ID',
            button: 'Login',
            discord: 'LOGIN WITH DISCORD',
            register: 'REGISTER OR ACCESS YOUR ACCOUNT',
            footer: 'Leilos • Crisutf',
            error: 'Please enter your Leilos ID'
        },
        nav: {
            home: 'Home',
            settings: 'Settings',
            download: 'Download',
            logout: 'Logout',
            minimize: 'Minimize',
            close: 'Close'
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
            issues: 'CHECKING SYSTEM...',
            loading: 'Loading services...',
            loadingSystem: 'LOADING SYSTEM...',
            errorDetected: 'ERROR DETECTED',
            accept: 'ACCEPT',
            versionError: 'The selected version is not compatible. Please select the exact Fortnite v28.30 folder.'
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
        },
        splash: {
            verifying: 'Verifying servers...',
            loading: 'Loading game...'
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
