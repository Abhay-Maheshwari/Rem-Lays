@echo off
echo =========================================
echo Loading Environment Variables from .env
echo =========================================
if exist .env (
    for /F "eol=# tokens=1,* delims==" %%a in (.env) do (
        set "%%a=%%~b"
    )
    echo Loaded .env successfully.
) else (
    echo Warning: .env file not found.
)

echo.
echo =========================================
echo Building Desktop App (EXE / MSI)
echo =========================================
call npm run tauri:build
if %errorlevel% neq 0 (
    echo Error during Desktop build!
    pause
    exit /b %errorlevel%
)

echo.
echo =========================================
echo Building Android App (APK / AAB) - aarch64 only
echo =========================================
call npm run tauri:android:build -- --target aarch64
if %errorlevel% neq 0 (
    echo Error during Android build!
    pause
    exit /b %errorlevel%
)

echo.
echo =========================================
echo All builds completed successfully!
echo The executables can be found in:
echo Desktop: src-tauri\target\release\
echo Android: src-tauri\gen\android\app\build\outputs\apk\
echo =========================================
pause
