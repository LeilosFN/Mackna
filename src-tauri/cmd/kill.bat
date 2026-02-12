@echo off
title Leilos - Close Fortnite v28.30
echo -----------------------------------------------
echo     CERRANDO FORTNITE Y PROCESOS ASOCIADOS
echo -----------------------------------------------
echo.
taskkill /F /IM FortniteClient-Win64-Shipping_BE.exe /T
taskkill /F /IM FortniteClient-Win64-Shipping_EAC.exe /T
taskkill /F /IM FortniteClient-Win64-Shipping.exe /T
taskkill /F /IM EpicGamesLauncher.exe /T
taskkill /F /IM FortniteLauncher.exe /T
taskkill /F /IM FortniteCrashHandler.exe /T
taskkill /F /IM UnrealCEFSubProcess.exe /T
taskkill /F /IM CrashReportClient.exe /T

echo.
echo -----------------------------------------------
echo     PROCESO COMPLETADO
echo -----------------------------------------------
echo Ya puedes cerrar esta ventana.
pause
