# Goal Description

Implement swipeable list item components for quick actions (archive, pin, tag) as the first feature of Phase 2. This will allow users to swipe an item card left or right on touch devices (or mouse drag) to quickly perform common actions.

## User Review Required

Please review the proposed approach for handling touch gestures natively in Angular without external dependencies. 

## Open Questions

- The database schema `ItemStatus` currently only supports `unseen`, `seen`, and `deleted`. There is no `archived` status. Should we map "Archive" to "Delete" (which removes the item from the main view), or do you want me to update the database schema and models to add an `archived` status?
- Since this is a desktop/mobile app via Tauri, should the swipe action be triggered by mouse drags as well as touch gestures, or just touch?

## Proposed Changes

### `rem-lays/src/app/components/item-card`

#### [MODIFY] `item-card.component.html`
- Wrap the main `.card` element inside a `.swipe-container`.
- Add action backgrounds (left and right) with icons (e.g., Pin on the left, Delete/Archive on the right).
- Bind touch events: `(touchstart)`, `(touchmove)`, `(touchend)` to the container. (Optionally add `(mousedown)`, `(mousemove)`, `(mouseup)` for desktop).

#### [MODIFY] `item-card.component.scss`
- Add styles for `.swipe-container` (relative, overflow hidden).
- Add styles for the action backgrounds (absolute, behind the card).
- Add transform transition for the card to snap back or slide out smoothly.

#### [MODIFY] `item-card.component.ts`
- Add logic to track start X/Y coordinates and current X translation.
- Apply `transform: translateX(Xpx)` dynamically during the drag.
- On release (`touchend`), evaluate if the drag crossed a specific threshold (e.g., 100px). 
  - If yes, trigger the respective action (Pin/Delete) and slide the card out.
  - If no, reset the translation back to 0.

## Verification Plan

### Manual Verification
- Test swiping the item card left and right in the Tauri dev environment (using mobile emulation or mouse drag if enabled).
- Verify that crossing the threshold triggers the actions (Pin, Delete) appropriately.
- Verify that releasing before the threshold smoothly snaps the card back to its original position.

## Completion Status
**Completed** - Added swipe logic for touch devices to enable Quick Actions (Archive on swipe right, Pin on swipe left).

### Changes Implemented:
- `ItemStatus` updated in `item.model.ts` to include `'archived'`.
- `items.service.ts` modified to filter out `'archived'` status in the main feed view and an `archive(id: string)` method was added.
- `item-card.component.html` updated to include `<div class="swipe-container">` wrapping the item card to attach touch gesture listeners.
- `item-card.component.scss` updated to define styles for the left/right `.swipe-actions` layouts underneath the swiping card.
- `item-card.component.ts` implemented with `touchstart`, `touchmove`, `touchend` tracking. Delta X is bounded with drag resistance when it passes the threshold. Delta Y is verified so it allows smooth vertical scrolling on the device. Action executes upon reaching a translation threshold of 80px.
