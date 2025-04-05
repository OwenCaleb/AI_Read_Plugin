@echo off
chcp 65001 > nul
echo Creating Edge extension package...

if not exist dist mkdir dist

echo Cleaning old files...
if exist dist\coze_extension.zip del dist\coze_extension.zip

echo Packaging extension files...
powershell -command "Compress-Archive -Path manifest.json, popup.html, popup.js, background.js, icons\* -DestinationPath dist\coze_extension.zip -Force"

echo Package completed!
echo Extension file is located at: %CD%\dist\coze_extension.zip
echo.
echo Press any key to exit...
pause > nul 