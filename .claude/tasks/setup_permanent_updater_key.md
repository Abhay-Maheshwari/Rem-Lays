# Task: Set Up Permanent Signing Keys & Auto-Updater Infrastructure (Option 2)

## Goal
Generate a permanent cryptographic key pair for Tauri's in-app updater, configure `tauri.conf.json` with the new public key, securely save the private key in `.env` and `~/.tauri/`, generate the minisign signature for the v1.7.0 desktop installer, update `latest.json`, and re-package the v1.7.0 release binaries.

## Status: COMPLETED ✅

### Summary of Changes Made:
1. **Permanent Keypair Generated**:
   - Generated permanent Minisign/Ed25519 signing keypair (`~/.tauri/remlays.key` and `~/.tauri/remlays.key.pub`).
   - Private key: saved in `.env` (`TAURI_SIGNING_PRIVATE_KEY`) and in `~/.tauri/remlays.key`.
   - Public key: `dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IENFNTE3OEEzNkVFMUUyOEEKUldTSzR1RnVvM2hSenI5Y1o3SkNKYXZpaFZabjVkTUVtckNLZy9vZUV5TWpBaHVQN1FYMnZja2oK`.
2. **Tauri Configuration**:
   - Updated `src-tauri/tauri.conf.json` with the permanent `plugins.updater.pubkey`.
3. **Automated Signing Pipeline**:
   - Built `scripts/sign_release.py` to sign release binaries and verify signatures automatically.
   - Signed `Rem-Lays-Setup.exe` and wrote `website/downloads/Rem-Lays-Setup.exe.sig`.
   - Populated `latest.json` with the verified cryptographic Minisign signature.

## Implementation Plan

### 1. Key Generation
- Run `npx tauri signer generate` non-interactively to generate a new permanent key pair.
- Save the private key to `~/.tauri/remlays.key` and store `TAURI_SIGNING_PRIVATE_KEY` in `.env`.
- Update `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

### 2. Sign v1.7.0 Binaries & Populate `latest.json`
- Sign the Windows setup executable using `npx tauri signer sign`.
- Insert the resulting base64 minisign signature into `latest.json` under `platforms["windows-x86_64"].signature`.

### 3. Rebuild Signed v1.7.0 Desktop Installers
- Rebuild desktop binaries with the new public key embedded so that v1.7.0 installations can seamlessly update to future versions.
- Copy output binaries to `website/downloads/Rem-Lays-Setup.exe` and `website/downloads/Rem-Lays-Setup.msi`.

### 4. Verification
- Verify signature encoding in `latest.json`.
- Verify installer builds and signatures.
