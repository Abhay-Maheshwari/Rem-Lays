# Phase 3: Hard Features — Task Tracker

Status: **Feature 1 COMPLETE**

## Tasks

- [x] **Feature 1: Shared Boards & Public Read-Only Link**
  - [x] Migration: add `share_token` column + anon RLS policy
  - [x] Model: add `share_token` to `Item` interface
  - [x] Edge Function: `shared-media` for signed URLs
  - [x] Service: `shareItem()`, `unshareItem()`, `fetchSharedItem()`
  - [x] Component: `SharedItemViewerComponent` (public page)
  - [x] Context menu: "Share" / "Unshare" actions + badge
  - [x] App routing: render shared viewer for `/shared/:token` URLs
  - [x] Build check: `ng build` — PASSED ✅

- [ ] **Feature 2: Email-to-Inbox** (PENDING)
- [ ] **Feature 3: Weekly Digest (Enhanced)** (PENDING)
- [ ] **Feature 4: Natural-Language Search** (PENDING)
- [ ] **Feature 5: Voice Notes** (PENDING)
- [ ] **Feature 6: Screenshot Auto-Detect** (DEFERRED)
