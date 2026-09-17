//! Integração com o Explorer do Windows: menu de contexto ("Abrir com
//! Umbra" em pastas) e associação de arquivo (`.md` na lista "Abrir com").
//!
//! Tudo em `HKEY_CURRENT_USER\Software\Classes` — por usuário, sem exigir
//! administrador, e completamente reversível (o "desativar" apaga
//! exatamente as chaves que o "ativar" criou). Compilado só no Windows;
//! `lib.rs` expõe stubs nas outras plataformas.

use std::env;
use winreg::enums::*;
use winreg::RegKey;
use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};

const CONTEXT_MENU_LABEL: &str = "Abrir com Umbra";
const PROG_ID: &str = "Umbra.md";

fn exe_path() -> Result<String, String> {
    env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Não foi possível localizar o executável: {e}"))
}

fn classes_root() -> RegKey {
    RegKey::predef(HKEY_CURRENT_USER)
}

/// Avisa o Explorer que associações de arquivo/menu de contexto mudaram —
/// sem isso, o Windows mantém o cache antigo (nem o "Abrir com" nem a lista
/// de apps padrão em Configurações refletem a mudança até um logoff).
fn notify_shell_changed() {
    unsafe {
        SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
    }
}

// --- Menu de contexto em pastas ----------------------------------------

/// `(subchave em Software\Classes, argumento passado ao executável)` — uma
/// entrada para o clique com o botão direito numa pasta, outra para o
/// clique no fundo vazio de uma pasta já aberta.
const CONTEXT_MENU_KEYS: [(&str, &str); 2] = [
    ("Directory\\shell\\Umbra", "%1"),
    ("Directory\\Background\\shell\\Umbra", "%V")
];

pub fn set_context_menu(enabled: bool) -> Result<(), String> {
    let hkcu = classes_root();
    if enabled {
        let exe = exe_path()?;
        for (key_path, arg) in CONTEXT_MENU_KEYS {
            let full = format!("Software\\Classes\\{key_path}");
            let (key, _) = hkcu.create_subkey(&full).map_err(|e| e.to_string())?;
            key.set_value("", &CONTEXT_MENU_LABEL).map_err(|e| e.to_string())?;
            key.set_value("Icon", &format!("\"{exe}\"")).map_err(|e| e.to_string())?;
            let (cmd, _) = key.create_subkey("command").map_err(|e| e.to_string())?;
            cmd.set_value("", &format!("\"{exe}\" \"{arg}\"")).map_err(|e| e.to_string())?;
        }
    } else {
        for (key_path, _) in CONTEXT_MENU_KEYS {
            let full = format!("Software\\Classes\\{key_path}");
            let _ = hkcu.delete_subkey_all(&full);
        }
    }
    notify_shell_changed();
    Ok(())
}

pub fn context_menu_enabled() -> bool {
    classes_root()
        .open_subkey("Software\\Classes\\Directory\\shell\\Umbra")
        .is_ok()
}

// --- Associação de arquivo (.md) ---------------------------------------

pub fn set_file_association(enabled: bool) -> Result<(), String> {
    let hkcu = classes_root();
    if enabled {
        let exe = exe_path()?;
        let (prog, _) = hkcu
            .create_subkey(format!("Software\\Classes\\{PROG_ID}"))
            .map_err(|e| e.to_string())?;
        prog.set_value("", &"Documento Markdown").map_err(|e| e.to_string())?;
        let (icon, _) = prog.create_subkey("DefaultIcon").map_err(|e| e.to_string())?;
        icon.set_value("", &format!("\"{exe}\",0")).map_err(|e| e.to_string())?;
        let (cmd, _) = prog.create_subkey("shell\\open\\command").map_err(|e| e.to_string())?;
        cmd.set_value("", &format!("\"{exe}\" \"%1\"")).map_err(|e| e.to_string())?;

        let (ext, _) = hkcu
            .create_subkey("Software\\Classes\\.md\\OpenWithProgids")
            .map_err(|e| e.to_string())?;
        ext.set_value(PROG_ID, &"").map_err(|e| e.to_string())?;
    } else {
        if let Ok(ext) =
            hkcu.open_subkey_with_flags("Software\\Classes\\.md\\OpenWithProgids", KEY_SET_VALUE)
        {
            let _ = ext.delete_value(PROG_ID);
        }
        let _ = hkcu.delete_subkey_all(format!("Software\\Classes\\{PROG_ID}"));
    }
    notify_shell_changed();
    Ok(())
}

pub fn file_association_enabled() -> bool {
    classes_root()
        .open_subkey(format!("Software\\Classes\\{PROG_ID}"))
        .is_ok()
}
