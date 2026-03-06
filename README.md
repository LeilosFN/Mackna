# Leilos Launcher

Launcher oficial de Leilos built con Tauri + React + TypeScript.

## Características

- ✨ Diseño con tema dorado
- 🔐 Autenticación con email/password
- 🎮 Lanzamiento de Fortnite con argumentos personalizados

## Requisitos Previos

- [Node.js](https://nodejs.org/) v18 o superior
- [Rust](https://rustup.rs/) (para compilar Tauri)
- Fortnite instalado

## Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/LeilosFN/launcher.git
cd leilos-launcher-beta
```

2. Instala las dependencias:
```bash
npm install
```

3. Asegúrate de tener los DLLs necesarios en la carpeta `dlls/`:
   - `leilos.dll` - Para autenticación (Gracias a @plooshi)

## Desarrollo

Para correr el launcher en modo desarrollo:

```bash
npm run dev
```

Esto iniciará el servidor de desarrollo de Vite y abrirá el launcher.

## Build de Producción

Para crear un ejecutable de producción:

```bash
npm run tauri build
```

El ejecutable se generará en `src-tauri/target/release/bundle/`.

## Configuración

### URLs del Backend

Por defecto, el launcher se conecta a:
- Backend: `https://launcher.leilos.qzz.io:443`
- Host: `http://**.leilos.qzz.io:7777`

Puedes cambiar estas URLs en el menú de Settings del launcher.

### Ruta de Fortnite

En la primera ejecución, deberás seleccionar la carpeta ROOT de tu instalación de Fortnite (la que contiene `FortniteGame/`).

## Uso

1. Abre el launcher
2. Inicia sesión con tu cuenta de Leilos
3. Selecciona la ruta de Fortnite (si no lo has hecho)
4. Click en "LAUNCH" para comenzar el juego

## Troubleshooting

### Si te aparece una pantalla de que el juego debes de haceer eso:
- 1 _Ve a la carpeta del launcher_
- 2 _Cambia el nombre de la carpeta `dlls/`_
- 3 _Abre el launcher e Inicia el juego_
- 4 _Espera asta que te ponga que no se pudo iniciar sesion y ahi le das en el launcher  `Cerrar Juego`_
- 5 _Vuelve a cambiar el nombre de la carpeta que cambiaste el nombre y vuelve a ponerle el nombre  `dlls/`_
- 6 _Y ya esta_

### El juego no inicia
- Verifica que la ruta de Fortnite sea correcta
- Asegúrate de que los DLLs estén en la carpeta `dlls/`
- Revisa que el backend esté funcionando

### Error de autenticación
- Verifica tus credenciales
- Comprueba que el backend en `launcher.leilo.qzz.io` esté accesible

## Tecnologías Utilizadas

- **Frontend**: React + TypeScript + TailwindCSS

