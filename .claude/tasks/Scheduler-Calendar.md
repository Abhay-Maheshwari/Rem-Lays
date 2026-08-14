# Scheduler, Calendar, and Custom Snooze

## Goal
Implement a Scheduler, Calendar, Deadline Indicator, and Custom Snooze option in the Rem-Lays application. 
The Calendar and Scheduler will be integrated into the existing Home/Dashboard view. 
The custom snooze option will use a custom UI rather than a native date picker.

## Tasks

- [ ] **1. Custom Snooze UI Component**
  - Create a new Angular standalone component `src/app/components/datetime-picker`.
  - Design a custom UI for selecting a date (calendar grid) and time.
  - Wire it to emit the selected `Date`.

- [ ] **2. Item Card (Custom Snooze)**
  - Update `item-card.component.ts` to add a "Custom..." option in the Snooze context menu.
  - When "Custom..." is clicked, open the new `datetime-picker` as a modal or dropdown inline.
  - Dispatch the selected date to `itemsSvc.setSnooze`.

- [ ] **3. Item Card (Deadline Indicator)**
  - Update `item-card.component.ts`'s `updateExpireText()` to evaluate both `expires_at` and `snooze_until`.
  - Introduce visual cues (e.g., color-coded classes: warning for < 24h, danger for < 1h).
  - Update `item-card.component.html` and `.scss` to style the new deadline badge based on these states.

- [ ] **4. Calendar & Scheduler (Integrated View)**
  - Modify `src/app/components/home/home.component` to integrate the calendar and scheduler.
  - Create the Calendar Grid UI displaying the current month and indicators on days that have items expiring or snoozed.
  - Create the Scheduler List UI below or beside the calendar, showing a chronological list of upcoming items.
  - Connect the Calendar/Scheduler to `itemsSvc.items()` and filter for items with active `snooze_until` or `expires_at` dates.

- [ ] **5. Verification**
  - Manual verification of custom snooze setting, deadline indicator updates, and the calendar/scheduler view logic.
