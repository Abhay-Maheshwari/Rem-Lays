# Task: Implement Logo across Rem-Lays Website

## Goal
Implement the official Rem-Lays layered brand logo across all pages in the `website/` directory, replacing the placeholder "r" text box in the header, adding the favicon to all pages, enhancing the footer with brand identity, and updating UI previews with the logo.

## Tasks Breakdown

- [x] **1. Asset Preparation**
  - Created `website/assets/` directory.
  - Copied `logo_square.png`, `icon.png`, `logo_dark_mode.png`, and `logo_light_mode.png` into `website/assets/`.

- [x] **2. Favicon Integration**
  - Added `<link rel="icon" type="image/png" href="assets/logo_square.png">` and `<link rel="apple-touch-icon" href="assets/logo_square.png">` to the `<head>` across all 6 pages.

- [x] **3. Navbar Branding Upgrade**
  - Replaced the placeholder `<div class="brand-mark">r</div>` with `<img src="assets/logo_square.png" alt="RemLays" class="brand-mark">`.
  - Wrapped branding in `<a href="rem-lays-hero.html" class="brand">` for smooth navigation.
  - Styled `.brand-mark` with `width: 28px; height: 28px; border-radius: 7px; object-fit: contain;`.

- [x] **4. Footer Branding Integration**
  - Added `.footer-brand` mark containing the logo and brand wordmark to the footer across all 6 pages.
  - Updated `website/integrate.py` to keep footer and nav templates consistent for any future runs.

- [x] **5. Download Page App Window Titlebar Preview**
  - Updated `rem-lays-download.html` mock desktop app window title bar to feature the app logo icon next to `rem-lays — Inbox`.

- [x] **6. Verification**
  - Verified all HTML files via automated script (`scratch/verify_website.js`). All 6 pages passed favicon, brand mark, brand link, and footer brand checks.

## Implementation Details & Handover Notes
- **Assets Location**: `website/assets/` contains the high-resolution logo assets.
- **Brand Consistency**: The navbar brand mark is consistently sized (28px) and links back to `rem-lays-hero.html`.
- **Footer**: The footer now displays `<div class="footer-brand">` with `logo_square.png` (22px) and stylized text `<b>Rem</b><span>Lays</span>`.
- **Integration Script**: `website/integrate.py` contains the matching `footer_html` template.
