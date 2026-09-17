use serde::Serialize;
use std::fs;
use std::path::Path;
use std::sync::Mutex;

/// Diretórios que nunca fazem sentido varrer num leitor de markdown.
const IGNORED_DIRS: &[&str] = &["node_modules", "target", "dist", "build", ".svelte-kit"];

const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown"];
const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];
const PDF_EXTENSIONS: &[&str] = &["pdf"];

/// Tipo de um arquivo suportado pela árvore, usado pelo frontend para
/// decidir qual visualizador abrir.
#[derive(Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
enum FileKind {
    Markdown,
    Image,
    Pdf,
}

fn file_kind_for(path: &Path) -> Option<FileKind> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    if MARKDOWN_EXTENSIONS.contains(&ext.as_str()) {
        Some(FileKind::Markdown)
    } else if IMAGE_EXTENSIONS.contains(&ext.as_str()) {
        Some(FileKind::Image)
    } else if PDF_EXTENSIONS.contains(&ext.as_str()) {
        Some(FileKind::Pdf)
    } else {
        None
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DirNode {
    name: String,
    path: String,
    is_dir: bool,
    kind: Option<FileKind>,
    children: Option<Vec<DirNode>>,
}

/// Guarda o diretório passado como argumento de linha de comando
/// (usado pela entrada do menu de contexto do Explorer).
struct InitialDir(Mutex<Option<String>>);

/// Monta recursivamente a árvore de pastas/arquivos suportados (markdown,
/// imagens, PDF) a partir de `dir`. Pastas ocultas e as listadas em
/// IGNORED_DIRS são puladas. Uma pasta só aparece na árvore se contiver,
/// direta ou indiretamente, algum arquivo suportado.
fn build_tree(dir: &Path) -> std::io::Result<Vec<DirNode>> {
    let mut entries: Vec<_> = fs::read_dir(dir)?.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.file_name());

    let mut dirs = Vec::new();
    let mut files = Vec::new();

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };

        if file_type.is_dir() {
            if IGNORED_DIRS.contains(&name.as_str()) {
                continue;
            }
            if let Ok(children) = build_tree(&path) {
                // Pasta totalmente vazia (sem nada dentro, nem oculto): provavelmente
                // acabou de ser criada pelo usuário para organizar — mostra mesmo
                // assim. Uma pasta com conteúdo mas nada suportado (ex.: só código)
                // continua oculta, para não poluir a árvore.
                let is_empty_dir = fs::read_dir(&path).map(|mut it| it.next().is_none()).unwrap_or(false);
                if !children.is_empty() || is_empty_dir {
                    dirs.push(DirNode {
                        name,
                        path: path.to_string_lossy().to_string(),
                        is_dir: true,
                        kind: None,
                        children: Some(children),
                    });
                }
            }
        } else if file_type.is_file() {
            if let Some(kind) = file_kind_for(&path) {
                files.push(DirNode {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: false,
                    kind: Some(kind),
                    children: None,
                });
            }
        }
    }

    dirs.extend(files);
    Ok(dirs)
}

#[tauri::command]
fn list_workspace_tree(root: String) -> Result<Vec<DirNode>, String> {
    let path = Path::new(&root);
    if !path.is_dir() {
        return Err(format!("Diretório não encontrado: {root}"));
    }
    build_tree(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_markdown_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Falha ao ler {path}: {e}"))
}

#[tauri::command]
fn write_markdown_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Falha ao salvar {path}: {e}"))
}

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err(format!("Já existe um item chamado \"{}\"", file_name_of(&path)));
    }
    fs::create_dir(&path).map_err(|e| format!("Falha ao criar pasta: {e}"))
}

#[tauri::command]
fn create_markdown_file(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err(format!("Já existe um item chamado \"{}\"", file_name_of(&path)));
    }
    fs::write(&path, "").map_err(|e| format!("Falha ao criar arquivo: {e}"))
}

#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| format!("Falha ao excluir: {e}"))
}

#[tauri::command]
fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    if Path::new(&new_path).exists() {
        return Err(format!("Já existe um item chamado \"{}\"", file_name_of(&new_path)));
    }
    fs::rename(&old_path, &new_path).map_err(|e| format!("Falha ao renomear: {e}"))
}

fn file_name_of(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

#[tauri::command]
fn get_initial_dir(state: tauri::State<InitialDir>) -> Option<String> {
    state.0.lock().unwrap().clone()
}

/// Extrai o diretório inicial dos argumentos de linha de comando.
/// Aceita tanto um caminho de pasta quanto o de um arquivo dentro dela
/// (nesse caso usa o diretório pai).
fn initial_dir_from_args() -> Option<String> {
    std::env::args().skip(1).find_map(|arg| {
        let p = Path::new(&arg);
        if p.is_dir() {
            Some(p.to_string_lossy().to_string())
        } else if p.is_file() {
            p.parent().map(|parent| parent.to_string_lossy().to_string())
        } else {
            None
        }
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(InitialDir(Mutex::new(initial_dir_from_args())))
        .invoke_handler(tauri::generate_handler![
            list_workspace_tree,
            read_markdown_file,
            write_markdown_file,
            create_directory,
            create_markdown_file,
            rename_path,
            delete_path,
            get_initial_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
