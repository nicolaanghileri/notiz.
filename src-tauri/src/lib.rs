mod ai;
mod ai_runner;
mod capture;
mod commands;
mod db;
mod embedder;
mod models;
mod notes;
mod search;
mod secrets;
mod settings;
mod timerange;

use tauri::{Manager, RunEvent};

pub fn run() {
    let app = tauri::Builder::default()
        // Muss das erste Plugin sein: ein zweiter Start zeigt nur das Fenster.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            capture::show_main(app);
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(capture::on_shortcut)
                .build(),
        )
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            app.manage(db::Db::open(&data_dir.join("notiz.db"))?);
            app.manage(embedder::SemanticIndex::new());
            app.manage(secrets::Secrets::new());
            app.manage(ai_runner::AiState::new());
            app.manage(capture::CaptureState::default());
            embedder::start(app.handle().clone(), data_dir.join("models"));

            let shortcut = settings::capture_shortcut(&app.state::<db::Db>().lock())?;
            if let Err(error) = capture::set_shortcut(app.handle(), &shortcut) {
                log::warn!("{error}");
            }
            capture::keep_running_on_close(app.handle());
            capture::create_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::notes_list,
            commands::notes_counts,
            commands::note_get,
            commands::note_create,
            commands::note_update,
            commands::note_set_pinned,
            commands::note_delete,
            commands::note_restore,
            commands::note_delete_forever,
            commands::search,
            commands::ai_transform,
            commands::ai_summarize_notes,
            commands::ai_cancel,
            commands::settings_get,
            commands::settings_set,
            commands::api_key_set,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        // macOS: Klick aufs Dock-Icon, wenn kein Fenster offen ist
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } = event
        {
            capture::show_main(app);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}
