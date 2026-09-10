@echo off
title Conector ARAM Arena
cd /d "%~dp0"
where node >nul 2>nul || (
  echo O Node.js precisa estar instalado para executar o conector.
  echo Baixe em https://nodejs.org/
  pause
  exit /b 1
)
echo Conector ativo. Mantenha esta janela aberta junto com o League of Legends.
node tools\riot-client-bridge.mjs
pause
