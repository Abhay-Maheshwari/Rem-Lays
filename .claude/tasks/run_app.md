# Task Plan: Resolve Missing Cargo Dependency & Run Rem-Lays Application

## Root Cause Analysis
- `npm run tauri:dev` failed because Rust's `cargo` toolchain is not installed or not found in system PATH (`failed to run 'cargo metadata' ... program not found`).

## Proposed Options & Tasks

### Option A (Recommended MVP - Web Mode)
Run the Angular web app server directly without requiring Rust / Tauri desktop compilation.
- **Task**: Execute `npm start` inside `d:\Projects\rem-lays-scaffold\rem-lays`.
- **Outcome**: Starts the Angular dev server on `http://localhost:4200/`.

### Option B (Desktop Mode with Rust Installation)
Install Rust toolchain to enable Tauri desktop development.
- **Task 1**: Install Rust via `rustup` (e.g. `winget install Rustlang.Rustup` or from https://rustup.rs).
- **Task 2**: Restart shell/environment path to pick up `cargo`.
- **Task 3**: Execute `npm run tauri:dev`.

## Status & Tracking
- [x] NPM dependencies installed (`npm i` completed)
- [ ] Option selected and server/app launched
