@echo off
rem Double-click to start WiFiDrop on Windows.
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul && goto use_py
where python >nul 2>nul && goto use_python
echo Python 3 is not installed.
echo Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
start https://www.python.org/downloads/
goto end
:use_py
py -3 wifidrop.py %*
goto end
:use_python
python wifidrop.py %*
:end
pause
