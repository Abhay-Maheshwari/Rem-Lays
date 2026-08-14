# Add Deadline Feature for Tasks

You requested that the "Upcoming" / Calendar widget should only show tasks that have a specific deadline to be completed, rather than showing items that are snoozed or expiring soon.

Currently, items don't have a concept of a "deadline". To support this, I propose the following implementation:

## Proposed Changes

### `src/app/models/item.model.ts`
- Update the `Item` interface to indicate that `payload` can contain an optional `deadline` string (ISO 8601 date). We will store the deadline inside the unstructured JSON `payload` to avoid needing database schema changes.

### `src/app/services/items.service.ts`
- Add a new method `setDeadline(id: string, deadline: string | null)` that updates an item's payload to include or remove the deadline.

### `src/app/components/item-card/item-card.component.ts` & `.html`
- Add a "Set Deadline" option to the item's context menu (the three-dots menu). It will have options similar to snooze/expiration (e.g., Later today, Tomorrow, Custom date/time).
- Update the item card UI to visually indicate if an item has a deadline (e.g. showing "Deadline: 2 days left" in red/orange depending on urgency).

### `src/app/components/calendar-widget/calendar-widget.component.ts`
- Change the `scheduledItems` logic. Instead of fetching items that have `snooze_until` or `expires_at`, it will ONLY fetch items that have `payload.deadline` set.
- Update the sorting and target time logic to use this deadline.

## User Review Required
> [!IMPORTANT]
> - Since the Calendar widget will now only show items with a `deadline`, your **snoozed** and **expiring** items will no longer appear on the calendar. Is this exactly what you want?
> - Let me know if you approve this approach so I can start implementing it!
