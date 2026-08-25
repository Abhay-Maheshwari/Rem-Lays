# Task: Generate v1.7.0 Release Artifacts (APK, EXE, MSI) & Version Bump

## Status: COMPLETED

## Summary of Changes
- **Version Bump to 1.7.0**:
  - `package.json` updated to `1.7.0`
  - `src-tauri/tauri.conf.json` updated to `1.7.0`
  - `src-tauri/Cargo.toml` updated to `1.7.0`
  - `website/downloads.html` updated with `v1.7.0` badges and download links
- **Builds Completed**:
  - **Angular Frontend**: Production bundle compiled in `dist/rem-lays/browser/`
  - **Windows Desktop NSIS Installer**: `src-tauri/target/release/bundle/nsis/Rem-Lays_1.7.0_x64-setup.exe` (35.2 MB) -> copied to `website/downloads/Rem-Lays-Setup.exe`
  - **Windows Desktop MSI Package**: `src-tauri/target/release/bundle/msi/Rem-Lays_1.7.0_x64_en-US.msi` (37.8 MB) -> copied to `website/downloads/Rem-Lays-Setup.msi`
  - **Android Universal Release APK**: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk` (455.6 MB) -> copied to `website/downloads/Rem-Lays.apk`
