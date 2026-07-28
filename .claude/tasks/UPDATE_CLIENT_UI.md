# Goal Description

Redesign the Rem-Lays desktop and mobile Angular client to perfectly align with Blip's sleek, minimalist dark aesthetic, adapting its exceptionally clean layout to the account-centered inbox architecture.

## User Review Required

Please review the proposed UI design changes before I start applying them to the Angular components.

## Proposed Changes

### Global Theming (`styles.scss`)
#### [MODIFY] [styles.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/styles.scss)
- Update CSS variables to a deeper, flatter dark mode base (`--bg-sidebar`, `--bg-main`).
- Refine the `--accent` variable for a crisper, more vibrant blue.
- Enhance typography (e.g., using specific font weights) for a cleaner, modern feel.

### Shell & Structural Layout (`app.component.scss`)
#### [MODIFY] [app.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/app.component.scss)
- Introduce subtle translucency (`backdrop-filter` where applicable) to emulate Windows 11's Mica effect, making the app feel lightweight and native.
- Clean up borders between the sidebar and main pane to be ultra-subtle.

### Sidebar Layout & Presence (`sidebar.component.scss`)
#### [MODIFY] [sidebar.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/sidebar/sidebar.component.scss)
- **Active State:** Redesign the `.active` filter item to use a subtle rounded grey/dark container with the crisp blue highlight for the icon and text (exactly like Blip).
- **Presence Indicators:** Keep device items read-only and minimal. Reduce spacing to group them cleanly.

### Feed & Cards (`feed.component.scss`, `item-card.component.scss`)
#### [MODIFY] [feed.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/feed/feed.component.scss)
#### [MODIFY] [item-card.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/item-card/item-card.component.scss)
- **Feed:** Update headers and empty states with thinner, more elegant typography to match Blip's aesthetic. Maximize negative space.
- **Item Cards:** Simplify borders. Instead of heavy structural lines, rely on subtle background color differences (`rgba(255,255,255,0.02)`) and micro-interactions (e.g., a slight translation on hover or a thin blue pulse for incoming items).

### Action Bar (`quick-action-bar.component.scss`)
#### [MODIFY] [quick-action-bar.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/quick-action-bar/quick-action-bar.component.scss)
- Redesign the input bar to sit subtly at the bottom. Use a minimal text input row with simple flat icons. Ensure the send/action button is cleanly integrated without feeling chunky.

## Verification Plan

### Manual Verification
- View the running `npm run tauri:dev` instance to verify that the app closely mimics Blip's visual style.
- Toggle between a wide desktop window and a narrow mobile-width window to ensure the responsive design accurately reflects the clean layout on both platforms.


## Completed Changes
- **Global Theming**: Updated `src/styles.scss` CSS variables. Adopted deeper dark mode (gba(20,20,23,0.85) sidebar and gba(26,26,30,0.75) main), changed accent blue to #3b82f6 for crispness, and made borders very subtle (gba(255,255,255,0.05)).
- **Shell Backgrounds**: Added `backdrop-filter: blur(24px) saturate(130%)` to `.main-pane` in `src/app/app.component.scss` and similar to the sidebar to get the Windows 11 Mica-like translucency effect.
- **Sidebar**: Updated `src/app/components/sidebar/sidebar.component.scss`. Made .filter-item.active match the Blip aesthetic with a subtle translucent dark background gba(255,255,255,0.06) and crisp blue icon/text (ar(--accent)).
- **Feed & Cards**: In `src/app/components/feed/feed.component.scss`, adjusted typography to be thinner and cleaner, and maximized spacing. In `item-card.component.scss`, replaced the explicit 1px white borders with transparent borders and relied on subtle background color differentials (gba(255,255,255,0.02)) that elevate on hover with translation.
- **Action Bar**: Updated `src/app/components/quick-action-bar/quick-action-bar.component.scss` to feature a transparent outer border and a flat inner input background, focusing entirely on clean minimalist interaction.
