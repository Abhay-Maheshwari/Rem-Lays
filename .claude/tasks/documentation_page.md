# Task: Create Detailed Documentation Page (`website/docs.html`)

## Status: COMPLETED

## Goal
Build a comprehensive, beautifully styled, interactive documentation page (`website/docs.html`) for the Rem-Lays website. The documentation serves as the complete manual for all user-facing features, workflows, and platform capabilities, matching the Obsidian Pro aesthetic (Glassmorphism, dark palette, modern typography, responsive layout).

## Key Components & Architecture

1. **New Documentation Page (`website/docs.html`)**:
   - Modern glassmorphic floating navbar matching other pages (`index.html`, `features.html`, etc.).
   - Interactive 2-column documentation layout:
     - **Sticky Sidebar Navigation**: Categorized sections with active scroll-spy highlighting, quick filter, and smooth jump anchors.
     - **Main Content Area**: Detailed step-by-step guides, UI callout boxes, keyboard shortcut tables, platform availability badges, and interactive search filter.
   - Comprehensive documentation sections:
     - **1. Quick Start & Account Setup**: Web app access, Desktop installation (Windows/macOS/Linux), Android app setup, Google OAuth sign-in, account settings.
     - **2. Capturing Content**: Quick Notes, Smart Link Enrichment, Instagram Reels & Embeds, Media Uploads, Drag-and-Drop, Bulk Upload Queue with progress, Webcam/Camera Snapping, Clipboard Paste, Android Share Sheet, and Duplicate Detection.
     - **3. Organizing & Collections**: Item Collections/Bundles, Custom Group Covers & Renaming, Drag-and-Drop Organization, Bulk Selection toolbar (Tag/Move/Pin/Archive/Delete), Card Pinning, Archiving, and 30-day Trash lifecycle.
     - **4. Tags, Filters & Instant Search**: Dynamic hashtags, deterministic 10-color tag palette, Multi-tag AND/OR/NOT filtering modes, full-text search, quick filter tabs (`All`, `Active`, `Starred`, `Due Soon`, `Archived`, `Trash`).
     - **5. Deadlines, Reminders & Snooze**: Snooze presets (Tonight, Tomorrow, Next Week) and custom wakeup times, Task Deadlines with urgency color borders, Recurring Reminders (Daily, Weekly, Monthly), Expiration timers.
     - **6. Collaborative Boards**: Board creation, customizable icons & colors, manual reordering, Hashtag auto-routing rules, Owner/Editor/Viewer roles, Invite links, and Member management.
     - **7. Calendar View & Weekly Digest**: Interactive Month Calendar with item badges, Resizable Agenda sidebar, Home Mini-Calendar widget, and 7-day Weekly Digest insights & analytics.
     - **8. Cross-Device Sync & Offline Mode**: Real-time Supabase sync, Offline queue with auto-reconnection flush, Device fleet list with active session indicators, Remote device logout.
     - **9. Desktop App (Tauri)**: Frameless glass window, System tray minimization & background daemon, Launch on startup, Frameless native notification toasts with inline quick-reply, Global shortcut keys.
     - **10. Android App & Widgets**: 5 Jetpack Glance Home Screen Widgets (Inbox, Quick Capture, Calendar Month, iOS Split, Agenda variants), Notification shade Quick Capture bar with `RemoteInput`, Push notifications via FCM, and Swipe gestures (Swipe Right to Archive, Swipe Left to Delete/Snooze).
     - **11. Sharing & 1-Click Data Export**: Public `/shared/:token` links with instant token revocation, Public read-only web viewer, and 1-Click Data Export (Markdown, JSON, CSV).
     - **12. Customization, Themes & Layouts**: 7 UI Themes (System, Obsidian Dark, Light, OLED Pure Black, VS Code, Dracula, Translucent Glass), Feed layout toggles (Masonry Grid, Compact Rows, Media View), Dashboard gradient wallpaper tints.
     - **13. Keyboard Shortcuts Reference**: Complete hotkey cheatsheet (`Ctrl/Cmd+K`, `N`, `L`, `I`, `B`, `C`, `Esc`, `Delete`, `?`).
     - **14. FAQ & Troubleshooting**: Common troubleshooting topics (Sync issues, Instagram preview caching, Notification permissions, Camera device permissions).

2. **Cross-Site Navigation & SEO Updates**:
   - Added "Docs" link to the navbar and mobile drawer across `website/index.html`, `website/features.html`, `website/about.html`, `website/faq.html`, `website/downloads.html`, and `website/404.html`.
   - Added "Docs" link to the footer navigation on all pages.
   - Updated `website/sitemap.xml` with `/docs.html` (`priority: 0.8`, `changefreq: monthly`).

## Tasks Breakdown & Changes Made
1. [x] **Write implementation plan and obtain user approval**: Created task tracking document and implementation plan artifact.
2. [x] **Create `website/docs.html`**: Implemented complete 14-section user documentation guide with sticky sidebar, real-time documentation search filtering, scroll-spy table of contents, platform tags (`Web`, `Desktop`, `Android`), callout blocks, and keyboard shortcut table.
3. [x] **Update website navigation bars and footers**: Added `Docs` navigation link across `website/index.html`, `website/features.html`, `website/about.html`, `website/faq.html`, `website/downloads.html`, and `website/404.html`. Cleaned up HTML structure across all static website pages.
4. [x] **Update `website/sitemap.xml`**: Added `<loc>https://rem-lays.vercel.app/docs.html</loc>` entry.
5. [x] **Verification**: Confirmed valid markup, consistent navigation across all pages, functioning live search, responsive sidebar, and smooth scroll anchors.
