# Goal Description

Skip Location Pins as requested, and move to the final feature of Phase 2: **Weekly Digest**.
The Weekly Digest will query all items saved in the past 7 days and display a summary view inside the app. This helps the user review their recent activity, see how many notes/links they've collected, and catch up on unread items from the week.

## User Review Required

We need to decide *how* and *where* this Weekly Digest should be displayed in the app UI.

## Open Questions

1. **Trigger:** Where do you want the button to open the Weekly Digest? 
   - A dedicated button in the Sidebar (e.g., under "Inbox")?
   - A button in the top action bar of the app?
2. **Display Format:** How should the digest appear?
   - **Option A:** A popup Modal overlaying the app (like the shortcuts modal).
   - **Option B:** A dedicated full-page view that replaces the main feed temporarily when clicked.
3. **Content:** What exactly should the digest show? 
   - Simple stats (e.g., "You saved 5 notes and 2 links this week")?
   - A carousel/list of the actual items?
   - AI-generated summary (if we have an AI backend) or just a visual summary?

## Proposed Changes

### 1. Models & Services
#### [MODIFY] `items.service.ts`
- Add a method to calculate stats for the past 7 days (e.g., `getWeeklyStats()`).
- Add a method to fetch the items from the last 7 days.

### 2. UI Updates
#### [NEW] `weekly-digest.component`
- Create a new Angular component to render the digest view (stats, charts, or list of recent items).
#### [MODIFY] `sidebar.component.html` (or chosen trigger location)
- Add the button to open the digest.
#### [MODIFY] `app.component.html`
- Render the `weekly-digest` component (if using a Modal overlay approach).

## Verification Plan
### Manual Verification
- Click the Weekly Digest button.
- Verify the modal/page opens correctly.
- Ensure the stats accurately reflect only the items created in the last 7 days.
