@echo off
rem Cartheco launcher. Runs dev.ps1 even where PowerShell blocks .ps1 scripts.
rem   dev.cmd            set up and start the API and the web app
rem   dev.cmd sim        start the Python simulator (a reading every 5 s, saved in Supabase)
rem   dev.cmd apk        build the phone app pointed at this PC (dist\Cartheco.apk), install it over USB
rem   dev.cmd all        everything: servers, simulator, APK
rem   dev.cmd stop       stop the API, the web app and the simulator
rem   dev.cmd status     show what is running and the URLs
rem   dev.cmd db         connect backend\.env to Supabase (asks for the database password)
rem   dev.cmd key        copy DEVICE_API_KEY to the clipboard
rem   dev.cmd firewall   allow port 8000 for the phone (asks for admin)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
