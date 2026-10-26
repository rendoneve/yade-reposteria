@echo off
rem Inicia todo el proyecto en Windows. Solo revisa que exista Node; lo demas lo hace dev.mjs.
where node >nul 2>nul
if errorlevel 1 (
  echo Falta instalar Node.js ^(version LTS^):
  echo   - Descarga: https://nodejs.org/
  echo   - Con winget: winget install OpenJS.NodeJS.LTS
  echo Despues abre una terminal nueva y vuelve a ejecutar dev.cmd
  exit /b 1
)
node "%~dp0dev.mjs" %*
