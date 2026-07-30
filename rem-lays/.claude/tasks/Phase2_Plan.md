# Phase 2: Swipe Actions & Location Pins

This plan covers the next set of features to make the app more mobile-friendly and context-aware.

## Goal
Implement mobile swipe actions (Swipe to delete/pin) and Location tagging for items (capturing where an item was created).

## Proposed Changes

### 1. Swipe Actions (MVP)
We will add touch event listeners to the `ItemCardComponent` to allow users on touch devices to swipe cards horizontally.
- **Swipe Left**: Reveals a "Delete" action.
- **Swipe Right**: Reveals a "Pin/Unpin" action.
- We will use native Angular `(touchstart)`, `(touchmove)`, and `(touchend)` events to track the swipe delta, applying a CSS `transform: translateX(...)` dynamically as they swipe.
- Once a threshold is crossed (e.g., 100px), releasing the touch will trigger the action.

### 2. Location Pins (MVP)
When creating a text note or link on mobile, we can capture the device's current location.
- **Database**: No migration needed! The `items` table uses a `jsonb` column for `payload`. We can just store `{ location: { lat, lng } }` inside it.
- **Frontend Capture**: Add a small "Location" toggle button near the "Send" input area. When toggled on, it calls `navigator.geolocation.getCurrentPosition()`.
- **Item Card UI**: If an item's payload has `location`, display a small location pin icon `📍` in the `.meta` footer. Clicking it could open Google Maps in a new tab `https://www.google.com/maps?q={lat},{lng}`.

## User Review Required
> [!IMPORTANT]
> **Location Permission**: Browsers require user permission to access location. If the user denies it, we will just silently disable the location toggle. Is that acceptable?
> **Swipe Threshold**: I plan to use 100px as the swipe threshold for triggering the action.

## Verification Plan
1. Simulate mobile touch events in Chrome DevTools to verify swipe-to-delete.
2. Allow location access in the browser and add a note, then verify the Maps link opens the correct coordinates.
