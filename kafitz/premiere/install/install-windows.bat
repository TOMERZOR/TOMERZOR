@echo off
REM Installs the Kafitz panel for Premiere Pro on Windows. Double-click this file, then restart Premiere.
set "SRC=%~dp0.."
set "DEST=%APPDATA%\Adobe\CEP\extensions\kafitz"
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "%SRC%" "%DEST%\" /e /i /q /y >nul
if exist "%DEST%\install" rmdir /s /q "%DEST%\install"
REM The panel is not signed through Adobe Exchange, so Premiere needs to allow unsigned panels.
for %%v in (9 10 11 12 13) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo.
echo Kafitz installed. Restart Premiere Pro and open: Window ^> Extensions ^> Kafitz
echo.
pause
