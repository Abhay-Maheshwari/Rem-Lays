# Collections Page Implementation Plan

## Overview
Create a new `CollectionsPageComponent` to replicate the structure and layout of the provided screenshot, but adapt the visual style to use the application's existing design system (CSS variables, dynamic themes) instead of the neobrutalist aesthetic.

## Proposed Changes

### Component: Collections Page
#### [NEW] `src/app/components/collections-page/collections-page.component.ts`
- Create a standalone Angular component `CollectionsPageComponent`.
- Include necessary imports (CommonModule, icons, etc.).

#### [NEW] `src/app/components/collections-page/collections-page.component.html`
- Build the layout structure:
  - Header: Settings, share, search icons using standard app icon buttons.
  - Headline: "Save now. Find anytime."
  - Link Input: Input field with `# Paste link to quick save` placeholder, and an action button (e.g., standard primary or accent button instead of the yellow `+`).
  - Notification Banner: Info banner using standard accent/success colors.
  - Subtitle: "My Collections".
  - Grid: 2 columns of collection cards.
  - Cards: Folder-styled cards but using `var(--bg-card)`, `var(--border-subtle)`, and standard rounded corners (`var(--radius-lg)`). Folder colored tabs will use softer accents or standard colors to blend with the active theme.

#### [NEW] `src/app/components/collections-page/collections-page.component.scss`
- Implement theme-compliant CSS:
  - Use `var(--border-subtle)` and `var(--border-strong)` instead of solid black borders.
  - Use `var(--bg-main)` and `var(--bg-card)` for backgrounds.
  - Soft drop shadows or subtle borders based on the active theme.
  - Maintain the folder-tab layout but visually aligned with existing `app-item-card` and other components.

---

### Component: Core App wiring

#### [MODIFY] `src/app/app.component.ts`
- Update `activeView` signal type to include `'collections'`.
- Import `CollectionsPageComponent`.
- Add `CollectionsPageComponent` to the `imports` array.

#### [MODIFY] `src/app/app.component.html`
- Add a new `<ng-container>` block for `activeView() === 'collections'` to render `<app-collections-page>`.
- Wire up the sidebar `(openCollections)` output to set `activeView.set('collections')`.

#### [MODIFY] `src/app/components/sidebar/sidebar.component.ts`
- Add `@Output() openCollections = new EventEmitter<void>();`

#### [MODIFY] `src/app/components/sidebar/sidebar.component.html`
- Add a sidebar navigation button for "Collections" using the existing `.filter-item` style to allow users to navigate to the new page.

## Verification Plan
1. Manually launch the app and click on the new Collections sidebar item.
2. Verify the rendered UI matches the provided screenshot's layout, but successfully respects the app's global themes (Dark, Light, Dracula, etc.).
