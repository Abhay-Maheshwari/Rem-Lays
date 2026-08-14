# Update Hero Page with New Interactive Version

## Goal
Replace the existing `rem-lays-hero.html` with the newly updated hero implementation from `rem-lays-hero(1).html`, preserving site-wide navigation/footer links, and remove the duplicate/temporary `rem-lays-hero(1).html` file.

## Reasoning
The user provided an enhanced version of the hero page (`rem-lays-hero(1).html`) featuring an updated chaos field animation, headline keep-out distance calculations, 8x3 desktop / 4x6 mobile grid layouts, dynamic card blur/fade proximity effects, and responsive navigation. We applied this as the primary `rem-lays-hero.html` and cleaned up the duplicate file.

## Tasks
- [x] 1. Update `website/rem-lays-hero.html` with the new design and script from `rem-lays-hero(1).html`, ensuring navigation links and CTA buttons connect to `rem-lays-features.html`, `rem-lays-about.html`, `rem-lays-faq.html`, `rem-lays-changelog.html`, and `rem-lays-download.html`.
- [x] 2. Remove the older / temporary `website/rem-lays-hero(1).html` file.
- [x] 3. Verify that links and layout render cleanly.

## Implementation Details
The new `website/rem-lays-hero.html` incorporates:
- 24 cards across 8x3 grid on desktop (`POS_DESKTOP`) and 4x6 grid on mobile (`POS_MOBILE`).
- Dynamic headline keep-out collision avoidance (`measureKeepout`, bounding box measurement with padded distance field for smoothstep proximity opacity and blur).
- Scroll-driven spring physics with jitter (`easeOutQuint`, `easeOutBack`, dead zone).
- Mobile menu drawer with smooth slideDown toggle animation and navbar blur on scroll (`.nav.scrolled`).
- Seamless nav & footer link integration across the Rem-Lays website pages (`Product`, `Features`, `About`, `FAQ`, `Changelog`, and `Get started` CTA to `rem-lays-download.html`).

## Completed Changes Summary
- **Updated**: `website/rem-lays-hero.html` with the latest layout, chaos field mechanics, keepout calculations, and relative link routing.
- **Removed**: `website/rem-lays-hero(1).html` to eliminate redundant artifacts and ensure single source of truth.
