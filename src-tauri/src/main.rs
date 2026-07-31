// Entry point for the Tauri shell. This process hosts the Angular build
// (see ../dist/rem-lays/browser) inside a native window and wires up:
//  - a system tray icon (click to show, menu to quit for real)
//  - "close the window" actually just hides it instead of quitting —
//    that's the "minimize to tray instead of closing" behavior from the
//    design doc
//  - the notification + autostart plugins (actually enabling autostart,
//    and firing a notification, both happen from the Angular side via
//    their JS plugin bindings — see AutostartService / NativeNotificationService)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    rem_lays_lib::run()
}
