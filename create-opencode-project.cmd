@echo off
setlocal

if "%~1"=="" (
  echo Usage:
  echo %~n0 ^<project-name^>
  exit /b 1
)

set "PROJECT_NAME=%~1"
set "ZIP_PATH=D:\projects\opencode-guide\opencode-reusable-skill-pack.zip"
set "PROJECT_DIR=%CD%\%PROJECT_NAME%"

if not exist "%ZIP_PATH%" (
  echo Skill pack zip not found:
  echo   "%ZIP_PATH%"
  exit /b 1
)

if not exist "%PROJECT_DIR%" (
  mkdir "%PROJECT_DIR%"
  if errorlevel 1 exit /b 1
)

echo Created project directory: "%PROJECT_DIR%"

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$tempDir = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName()); New-Item -ItemType Directory -Path $tempDir | Out-Null; try { Expand-Archive -LiteralPath $env:ZIP_PATH -DestinationPath $tempDir -Force; $entries = Get-ChildItem -LiteralPath $tempDir -Force; if ($entries.Count -eq 1 -and $entries[0].PSIsContainer) { $sourceDir = $entries[0].FullName } else { $sourceDir = $tempDir }; Get-ChildItem -LiteralPath $sourceDir -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $env:PROJECT_DIR -Recurse -Force } } finally { if (Test-Path -LiteralPath $tempDir) { Remove-Item -LiteralPath $tempDir -Recurse -Force } }"
if errorlevel 1 exit /b 1

echo Extracted skill pack into project root: "%PROJECT_DIR%"
echo Project initialized successfully!
exit /b 0
