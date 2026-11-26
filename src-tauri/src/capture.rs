//! Quick Capture: globaler Shortcut, eigenes rahmenloses Fenster (`/capture`),
//! Tray-Icon und Hintergrundbetrieb.

use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{
    AppHandle, LogicalSize, Manager, PhysicalPosition, Runtime, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

pub const MAIN: &str = "main";
pub const CAPTURE: &str = "capture";
/// Fenstergrösse inkl. transparentem Rand für den Schatten der Karte.
/// Das Frontend darf sie anpassen (`core:window:allow-set-size`).
const CAPTURE_SIZE: (f64, f64) = (760.0, 300.0);
/// Abstand vom oberen Bildschirmrand, Anteil der Höhe
const CAPTURE_TOP: f64 = 0.18;

/// Aktuell registrierter Shortcut
#[derive(Default)]
pub struct CaptureState {
    shortcut: Mutex<Option<Shortcut>>,
}

/// Prüft ein Tastenkürzel wie „Alt+Space“. Ohne Modifier wäre die Taste
/// systemweit blockiert, deshalb Pflicht.
pub fn parse_shortcut(text: &str) -> Result<Shortcut, String> {
    let shortcut: Shortcut = text
        .trim()
        .parse()
        .map_err(|_| format!("Ungültiges Tastenkürzel: {text}"))?;
    if shortcut.mods.is_empty() {
        return Err(
            "Das Tastenkürzel braucht mindestens eine Zusatztaste (z. B. Alt, Ctrl, Shift)".into(),
        );
    }
    Ok(shortcut)
}

/// Registriert `text` als Quick-Capture-Shortcut und gibt den alten frei.
/// Schlägt die Registrierung fehl, bleibt der alte aktiv.
pub fn set_shortcut<R: Runtime>(app: &AppHandle<R>, text: &str) -> Result<(), String> {
    let shortcut = parse_shortcut(text)?;
    let state = app.state::<CaptureState>();
    let mut current = state.shortcut.lock().unwrap_or_else(|e| e.into_inner());
    if current.as_ref() == Some(&shortcut) {
        return Ok(());
    }
    let shortcuts = app.global_shortcut();
    shortcuts.register(shortcut).map_err(|e| {
        format!("Tastenkürzel {text} lässt sich nicht verwenden (schon belegt?): {e}")
    })?;
    if let Some(old) = current.replace(shortcut)
        && let Err(error) = shortcuts.unregister(old)
    {
        log::warn!("Alter Shortcut nicht freigegeben: {error}");
    }
    Ok(())
}

/// Handler für das Shortcut-Plugin.
pub fn on_shortcut<R: Runtime>(app: &AppHandle<R>, _shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state == ShortcutState::Pressed {
        toggle_capture(app);
    }
}

fn capture_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    if let Some(window) = app.get_webview_window(CAPTURE) {
        return Ok(window);
    }
    let builder = WebviewWindowBuilder::new(app, CAPTURE, WebviewUrl::App("capture".into()))
        .title("Quick Capture")
        .inner_size(CAPTURE_SIZE.0, CAPTURE_SIZE.1)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .visible(false);
    let window = builder.build()?;
    let handle = app.clone();
    window.on_window_event(move |event| match event {
        // Schliessen = verstecken, das Fenster wird wiederverwendet.
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            if let Some(window) = handle.get_webview_window(CAPTURE) {
                let _ = window.hide();
            }
        }
        WindowEvent::Focused(false) => return_focus(&handle),
        _ => {}
    });
    Ok(window)
}

/// Nach dem Schliessen von Quick Capture soll das vorherige Programm wieder
/// vorne sein. Auf macOS geht das nur, indem die App sich versteckt. Das
/// passiert nur, wenn das Hauptfenster ohnehin nicht offen ist.
fn return_focus<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(target_os = "macos")]
    {
        let hidden = |label| {
            app.get_webview_window(label)
                .is_none_or(|window| !window.is_visible().unwrap_or(false))
        };
        if hidden(CAPTURE) && hidden(MAIN) {
            let _ = app.hide();
        }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

/// Oben mittig auf dem Bildschirm, auf dem der Mauszeiger ist.
fn place<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) -> tauri::Result<()> {
    let monitor = match app.cursor_position() {
        Ok(cursor) => app.monitor_from_point(cursor.x, cursor.y)?,
        Err(_) => None,
    };
    let Some(monitor) = monitor.or(app.primary_monitor()?) else {
        return window.center();
    };
    let area = monitor.work_area();
    let size = window.outer_size()?;
    let x = area.position.x + (area.size.width as i32 - size.width as i32) / 2;
    let y = area.position.y + (area.size.height as f64 * CAPTURE_TOP) as i32;
    window.set_position(PhysicalPosition::new(x, y))
}

pub fn toggle_capture<R: Runtime>(app: &AppHandle<R>) {
    let result = capture_window(app).and_then(|window| {
        if window.is_visible()? && window.is_focused()? {
            return window.hide();
        }
        // Grösse zurücksetzen, falls das Frontend sie geändert hat und neu startet
        if !window.is_visible()? {
            window.set_size(LogicalSize::new(CAPTURE_SIZE.0, CAPTURE_SIZE.1))?;
        }
        place(app, &window)?;
        window.show()?;
        window.set_focus()
    });
    if let Err(error) = result {
        log::error!("Quick Capture: {error}");
    }
}

pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Hauptfenster schliessen = verstecken. Die App läuft im Tray weiter.
pub fn keep_running_on_close<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let handle = window.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = handle.hide();
            }
        });
    }
}

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "notiz. öffnen", true, None::<&str>)?;
    let capture = MenuItem::with_id(app, "capture", "Quick Capture", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &capture, &separator, &quit])?;
    let mut tray = TrayIconBuilder::with_id("notiz")
        .tooltip("notiz.")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "capture" => toggle_capture(app),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shortcuts_need_a_modifier() {
        assert!(parse_shortcut("Alt+Space").is_ok());
        assert!(parse_shortcut("Ctrl+Shift+Space").is_ok());
        assert!(parse_shortcut("CmdOrCtrl+Shift+N").is_ok());
        assert!(parse_shortcut("Space").is_err());
        assert!(parse_shortcut("Alt+Leertaste").is_err());
        assert!(parse_shortcut("").is_err());
    }
}
