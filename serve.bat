@echo off
echo Starting local PromptVault server...
echo Access it in Chrome at http://localhost:5173
python -m http.server 5173
pause
