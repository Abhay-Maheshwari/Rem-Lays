# Feature Roadmap & Implementation Plan

## Overview
This document categorizes the requested features based on ease of implementation.

## 🟢 Phase 1: Easy (Quick Wins, Low Complexity)
These features mostly involve straightforward frontend changes or simple database schema updates.

- [ ] **Mark as unread / Pin to top**
  - **Implementation**: Add boolean flags (`is_unread`, `is_pinned`) to the database schema. Add toggle buttons in the UI and update sorting logic.
- [ ] **Keyboard shortcuts**
  - **Implementation**: Add global event listeners to map key presses to existing actions (e.g., open search, add item).
- [ ] **Full data export**
  - **Implementation**: Query all items from the DB, serialize to JSON/CSV, and use Tauri's FS API to trigger a save dialog.
- [ ] **Duplicate detection**
  - **Implementation**: Before saving a new link, check if the URL already exists. Offer to merge tags or update the timestamp.
- [ ] **Auto-expiring items**
  - **Implementation**: Add an `expires_at` timestamp. Filter expired items from the main view and run a background cleanup task.

## 🟡 Phase 2: Medium (Moderate Effort)
These features require new UI paradigms, native OS APIs, or more complex logic.

- [ ] **Quick swipe actions**
  - **Implementation**: Implement swipeable list item components for quick actions (archive, pin, tag).
- [ ] **Location pins**
  - **Implementation**: Request geolocation permissions on save. Store coordinates and use a reverse-geocoding API for addresses.
- [ ] **Snooze / remind-me-later**
  - **Implementation**: Add `snooze_until` timestamp. Use Tauri's local notification API to alert the user at the specified time.
- [ ] **Weekly digest**
  - **Implementation**: Generate an in-app summary view querying items from the last 7 days. (Email digest would require a backend).

## 🔴 Phase 3: Hard (High Complexity, but achievable with FREE Serverless tools)
We can bypass the need for a 24/7 custom backend by utilizing generous free tiers of "Serverless" platforms and fully local AI.

- [ ] **Shared boards & Public read-only link**
  - **Implementation**: Instead of hosting a server, we can integrate **Firebase** or **Supabase** (both have permanent, generous free tiers). The app talks directly to this cloud database to sync shared items or host a simple public web page on their free hosting.
- [ ] **Email-to-inbox**
  - **Implementation**: Use a free email forwarder (like **Cloudflare Email Routing**) connected to a free serverless function (Cloudflare Worker). When you email the address, the Worker simply writes the data into your free Firebase/Supabase database. Your app pulls it down when you open it.
- [ ] **Weekly digest (Email)**
  - **Implementation**: To avoid email costs, keep this entirely local. The app computes the digest on-device and shows it in a beautiful UI when you open the app on Sunday.
- [ ] **Natural-language search**
  - **Implementation**: Run a small, open-source embedding model *locally* on the device (using WebAssembly or Tauri Rust). This means zero API costs and total privacy.
- [ ] **Voice notes**
  - **Implementation**: Capture audio locally and transcribe it using a free on-device Speech-to-Text model.
- [ ] **Screenshot auto-detect**
  - **Implementation**: Requires a native Android background service via Tauri plugins to monitor the media store.
