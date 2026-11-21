@echo off
rem Tranche Guard launcher. Runs dev.ps1 even where PowerShell blocks .ps1 scripts.
rem   dev.cmd            set up and start everything
rem   dev.cmd stop       stop the API and the web app
rem   dev.cmd status     show what is running and the URLs
rem   dev.cmd db         connect backend\.env to Supabase (asks for the database password)
rem   dev.cmd key       copy DEVICE_API_KEY to the clipboard
rem   dev.cmd firewall   allow port 8000 for the phone (asks for admin)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev.ps1" %*
