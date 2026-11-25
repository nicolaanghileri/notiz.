mod commands;
mod db;
mod models;
mod notes;
mod timerange;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let path = app.path().app_data_dir()?.join("notiz.db");
            app.manage(db::Db::open(&path)?);
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
