@echo off
title Lux AI - Otonom Calisma Istasyonu
cd /d "%~dp0"
echo ==================================================
echo   Lux AI Baslatiliyor...
echo ==================================================

if not exist "node_modules\electron\package.json" (
  echo [Lux AI] Bagimliliklar kuruluyor... Ilk calistirmada birkac dakika surebilir.
  call npm install
  if errorlevel 1 (
    echo.
    echo [HATA] npm install basarisiz oldu.
    echo        Node.js 22.12 veya uzeri gerekiyor: https://nodejs.org
    pause
    exit /b 1
  )
)

call npm start
if errorlevel 1 pause
