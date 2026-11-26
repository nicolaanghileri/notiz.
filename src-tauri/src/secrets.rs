//! API-Key im System-Keychain (macOS Schlüsselbund, Windows Anmeldeinformationen).
//! Nie im Klartext auf der Disk. Im Speicher gecacht, damit nicht jede
//! Anfrage den Keychain abfragt (unsignierte Dev-Builds fragen sonst jedes Mal nach).

use std::sync::Mutex;

const SERVICE: &str = "app.notiz.desktop";
const ACCOUNT: &str = "anthropic-api-key";

pub struct Secrets {
    /// `None` = noch nicht gelesen, `Some(None)` = kein Key hinterlegt
    cache: Mutex<Option<Option<String>>>,
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| format!("Keychain nicht verfügbar: {e}"))
}

impl Secrets {
    pub fn new() -> Self {
        Self {
            cache: Mutex::new(None),
        }
    }

    pub fn api_key(&self) -> Result<Option<String>, String> {
        let mut cache = self.cache.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(key) = cache.as_ref() {
            return Ok(key.clone());
        }
        let key = match entry()?.get_password() {
            Ok(key) if !key.trim().is_empty() => Some(key),
            Ok(_) | Err(keyring::Error::NoEntry) => None,
            Err(e) => return Err(format!("API-Key kann nicht gelesen werden: {e}")),
        };
        *cache = Some(key.clone());
        Ok(key)
    }

    /// Leerer Key = löschen.
    pub fn set_api_key(&self, key: &str) -> Result<(), String> {
        let key = key.trim();
        let entry = entry()?;
        let result = if key.is_empty() {
            match entry.delete_credential() {
                Err(keyring::Error::NoEntry) => Ok(()),
                other => other,
            }
        } else {
            entry.set_password(key)
        };
        result.map_err(|e| format!("API-Key kann nicht gespeichert werden: {e}"))?;
        *self.cache.lock().unwrap_or_else(|e| e.into_inner()) =
            Some((!key.is_empty()).then(|| key.to_string()));
        Ok(())
    }
}
