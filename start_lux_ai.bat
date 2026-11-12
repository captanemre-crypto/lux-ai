@echo off
setlocal
cd /d "%~dp0"

REM Bagimliliklar kurulu degilse once kur (aksi halde Electron sessizce kapaniyordu).
if not exist "node_modules\electron\package.json" (
  echo [Lux AI] Bagimliliklar kuruluyor... Bu ilk calistirmada birkac dakika surebilir.
  call npm install
  if errorlevel 1 (
    echo.
    echo [HATA] npm install basarisiz oldu. Node.js 22.12+ kurulu mu? https://nodejs.org
    pause
    exit /b 1
  )
)

REM Monaco vendor dosyalari eksikse senkronla (IDE icin gerekli).
if not exist "src\vendor\monaco\vs\loader.js" (
  echo [Lux AI] Monaco dosyalari hazirlaniyor...
  call npm run vendor:monaco
)

start "" node node_modules\electron\cli.js .
endlocal
