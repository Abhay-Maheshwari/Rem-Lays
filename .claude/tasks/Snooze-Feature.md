# Goal Description

Implement the "Snooze / remind-me-later" feature (Phase 2). This will allow users to temporarily hide an item from their feed. Once the snooze duration expires, the item will automatically reappear in their inbox and a local OS notification will alert the user.

## User Review Required

Please review the proposed approach for adding a new column to the database and utilizing a background timer for the notifications.

## Open Questions

- What specific time increments do you want in the "Snooze" menu? (e.g., 4 Hours, Tomorrow, Next Week)
- Do you want a dedicated "Snoozed" view in the sidebar to see all currently snoozed items, or should they just be completely hidden until they wake up?

## Proposed Changes

### 1. Database Schema
#### [NEW] `supabase/migrations/20260729151000_add_snooze_until.sql`
- Create a SQL migration to add a `snooze_until timestamptz` column to the `items` table.
- Push the migration to the remote database using `npx supabase db push`.

### 2. Models & Services
#### [MODIFY] `item.model.ts`
- Add `snooze_until: string | null` to the `Item` interface.

#### [MODIFY] `items.service.ts`
- Add a `snooze(id: string, hours: number)` method to update the database.
- Create a `currentTime` signal that updates every minute using `setInterval()`.
- Update the `filteredItems` computed property to depend on `currentTime` and exclude items where `snooze_until > currentTime()`.
- Add a periodic check within the same timer to detect items whose snooze has *just* expired, and trigger a local notification via `NativeNotificationService`.

### 3. UI Updates
#### [MODIFY] `item-card.component.ts`
- Add a "Snooze" option to the right-click Context Menu.
- Provide a submenu for Snooze intervals (e.g., Later Today, Tomorrow, Next Week).

## Verification Plan
### Manual Verification
- Snooze an item for 1 hour, verify it disappears from the feed instantly.
- Manually edit the database to make the snooze expire soon, and verify the item pops back into the feed automatically (via the signal reactivity) without refreshing the page.
- Verify that a local OS notification is triggered when it wakes up.
