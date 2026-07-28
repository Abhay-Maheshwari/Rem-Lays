# Goal Description

Update the Rem-Lays Angular application's UI to exactly match the design implemented in the `rem-lays-ui-mockup.html` file. This includes the typography, radial gradient backgrounds, sidebar styling with icons and brand logo, dynamic feed layout with rich media cards, and the minimalist action bar.

## User Review Required

Please review this plan. My previous attempt applied a generic minimalist theme, but I now understand you want the exact layout, colors, and components from the `rem-lays-ui-mockup.html` perfectly replicated in the Angular app.

## Proposed Changes

### 1. Global Setup (`index.html`, `styles.scss`)
#### [MODIFY] [index.html](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/index.html)
- Add Google Fonts for `Inter` and `Inter Tight`.

#### [MODIFY] [styles.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/styles.scss)
- Copy all CSS variables from the mockup's `:root`.
- Apply the multi-layered radial gradient background to `body`.
- Set global typography defaults.

### 2. App Shell (`app.component.html`, `app.component.scss`)
#### [MODIFY] [app.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/app.component.scss)
- Ensure `.app-shell` spans the screen with no background (allowing body gradients to show).
- The `app-shell` needs to adapt the `.shell` properties (border-radius, shadow) if running as a web app, or fill the window completely for Tauri.

### 3. Sidebar (`sidebar.component.html`, `sidebar.component.scss`)
#### [MODIFY] [sidebar.component.html](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/sidebar/sidebar.component.html)
#### [MODIFY] [sidebar.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/sidebar/sidebar.component.scss)
- Add the "R" brand logo with the purple/blue gradient.
- Add the search input field with its SVG icon.
- Add SVG icons to all filter buttons and apply the mockup's `.active` state (soft blue background, inset shadow).
- Update device presence indicators to include the `.pulse` animation for the active device.
- Update sidebar footer text styling.

### 4. Feed & Header (`feed.component.html`, `feed.component.scss`)
#### [MODIFY] [feed.component.html](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/feed/feed.component.html)
#### [MODIFY] [feed.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/feed/feed.component.scss)
- Update the main header to use `Inter Tight` and include the subtitle.
- Style the refresh button to look like the mockup's `.demo-btn`.
- Add the "While you were away" banner styling (to be triggered when `unseenCount > 0`).

### 5. Item Cards (`item-card.component.html`, `item-card.component.scss`)
#### [MODIFY] [item-card.component.html](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/item-card/item-card.component.html)
#### [MODIFY] [item-card.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/item-card/item-card.component.scss)
- Completely overhaul the card structure to use `.card-thumb` and `.card-body`.
- Implement colored gradient backgrounds for thumbnails of text/links when no image is present.
- Add the `NEW` badge for unseen items.
- Structure the meta footer (source, dot separator, time).
- Add SVG icons for different content types (link favicon, image icon, play button for video).
- Add the incoming/new animation (`@keyframes incoming`).

### 6. Quick Action Bar (`quick-action-bar.component.html`, `quick-action-bar.component.scss`)
#### [MODIFY] [quick-action-bar.component.html](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/quick-action-bar/quick-action-bar.component.html)
#### [MODIFY] [quick-action-bar.component.scss](file:///d:/Projects/rem-lays-scaffold/rem-lays/src/app/components/quick-action-bar/quick-action-bar.component.scss)
- Use the `.action-inner` container styling from the mockup.
- Replace the "Send" text button with the mockup's blue SVG arrow button.
- Restyle the attach icon and text input to match the mockup perfectly.

## Verification Plan

### Manual Verification
- After applying these changes, compare the running Tauri app (`npm run tauri:dev`) with the provided `rem-lays-ui-mockup.html` in the browser to ensure a 1:1 pixel-perfect match.

---

## Completion Log

The UI has been successfully redesigned to achieve a 1:1 match with the `rem-lays-ui-mockup.html` file.
- **Global**: Added Google Fonts `Inter` and `Inter Tight` to `index.html`. Updated `styles.scss` with the exact CSS variables and the multi-layered glowing radial gradient background.
- **App Shell**: Updated `app.component.html` and SCSS to use `.app` and `.shell` wrappers to properly frame the app on desktop.
- **Sidebar**: Replaced all markup with the mockup's structure, including the gradient "R" brand logo, search bar, filter icons, and the pulsing device status dots.
- **Feed**: Added the title block and "While you were away" banner styling, preserving Angular logic for unseen counts.
- **Item Cards**: Completely rewrote the item card templates to use `.card-thumb` and `.card-body`. Added a `thumbGradient` getter to `ItemCardComponent` to hash item IDs into consistent colorful gradients for text/link thumbnails. Restructured metadata layout and added all appropriate icons/badges.
- **Action Bar**: Rewrote HTML to utilize `.action-inner`, replaced standard buttons with the exact SVG icons from the mockup, and wired them up to the existing `submit()`, `onFileSelected()`, etc. component logic.
