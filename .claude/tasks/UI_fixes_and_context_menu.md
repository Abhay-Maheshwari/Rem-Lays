# UI Fixes and Context Menu

## Tasks
- `[x]` Fix Logo and Hamburger Button alignment on mobile (`sidebar.component.scss`).
- `[x]` Fix Ctrl+C not copying text by adjusting keyboard shortcuts in `app.component.ts`.
- `[x]` Make item card actions (pin, unread) always visible on mobile devices (`item-card.component.scss`).
- `[x]` Implement Custom Right-Click Context Menu:
  - `[x]` Create `ContextMenuService` (`src/app/services/context-menu.service.ts`).
  - `[x]` Create `ContextMenuComponent` (`src/app/components/context-menu/...`).
  - `[x]` Add Context Menu to `app.component.html` and `app.component.ts`.
  - `[x]` Wire `contextmenu` event in `item-card.component.html|ts` to show the context menu with custom options.
