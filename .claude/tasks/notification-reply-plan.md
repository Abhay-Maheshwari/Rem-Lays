# Add Optional Input to Notifications

This plan outlines how to add an optional "quick reply" input to notifications in Rem-Lays. This will allow you to quickly send a note or reply directly from the notification panel without opening the app.

> [!NOTE]
> This feature will primarily work for desktop notifications and local Android notifications (when the app is running in the background).

> [!WARNING]
> **Android FCM Limitation**: For push notifications received when the Android app is **completely closed** (swiped away), Firebase automatically handles the notification display. Standard Firebase automatic notifications do *not* support inline reply inputs. To support inline replies when fully closed, we would have to rewrite how FCM handles pushes (using data-only messages and custom Android native Kotlin code). This plan covers the Tauri-managed notifications which work when the app is alive or backgrounded.

## Proposed Changes

### 1. User Setting Configuration

Add a new toggle setting in the System settings to allow users to enable or disable the quick reply feature.

#### [MODIFY] `src/app/components/settings-page/settings-page.component.ts`
- Add a new state variable `enableQuickReply` loaded from `localStorage`.
- Add a toggle method to update `localStorage`.

#### [MODIFY] `src/app/components/settings-page/settings-page.component.html`
- Add the UI toggle inside the System tab (`*ngIf="activeTab === 'system'"`).

### 2. Notification Action Registration

Register the input action type with the Tauri notification plugin so the OS knows to show an input field.

#### [MODIFY] `src/app/services/native-notification.service.ts`
- In `init()`, read the `enableQuickReply` setting.
- If enabled, call `registerActionTypes` from `@tauri-apps/plugin-notification` to register an action type (e.g., `id: 'quick_reply'`) with an `input: true` action.
- Update `notifyIfBackgrounded` to include `actionTypeId: 'quick_reply'` in the `sendNotification` payload.
- Listen for the action using `onAction`. When the action is triggered and contains an input value, use `ItemsService` to save the reply as a new text item in the inbox.

### 3. Desktop Webview Notification Support

Update the custom HTML notification window used for desktop to support the input field.

#### [MODIFY] `src/assets/notification.html`
- Read a new `replyEnabled` query parameter.
- If true, display a text input field at the bottom of the notification.
- When submitted, emit a Tauri event (e.g., `quick-reply`) with the text and close the notification.

#### [MODIFY] `src/app/app.component.ts`
- Add an event listener for `quick-reply` (from the desktop webview).
- When triggered, save the text via `ItemsService.addTextItem`.

## Verification Plan

### Manual Verification
- Go to Settings -> System and enable "Quick Reply from Notifications".
- Background the app and trigger a notification (e.g. by sending a note from another device).
- **Desktop**: Verify that the custom notification window shows an input field, and typing/submitting creates a new item.
- **Android (Backgrounded)**: Verify that the Android notification shows a "Reply" action. Submitting the reply should create a new item.
- Toggle the setting off and verify that the input option disappears from future notifications.
