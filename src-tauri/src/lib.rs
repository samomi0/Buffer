use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    data_dir: Mutex<Option<String>>,
}

fn config_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&dir).ok();
    dir.join("workbench-config.json")
}

#[tauri::command]
fn get_data_dir(state: tauri::State<AppState>) -> Result<Option<String>, String> {
    let guard = state.data_dir.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
fn check_saved_data_dir(app: tauri::AppHandle, state: tauri::State<AppState>) -> Result<Option<String>, String> {
    let cfg_path = config_path(&app);
    if cfg_path.exists() {
        if let Ok(raw) = fs::read_to_string(&cfg_path) {
            if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(dir) = cfg.get("dataDir").and_then(|v| v.as_str()) {
                    let pb = PathBuf::from(dir);
                    if pb.exists() && pb.is_dir() {
                        let dir_str = dir.to_string();
                        let mut guard = state.data_dir.lock().map_err(|e| e.to_string())?;
                        *guard = Some(dir_str.clone());
                        return Ok(Some(dir_str));
                    }
                }
            }
        }
    }
    Ok(None)
}

#[tauri::command]
async fn select_data_dir(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app
        .dialog()
        .file()
        .blocking_pick_folder();

    if let Some(p) = path {
        let dir = match &p {
            tauri_plugin_dialog::FilePath::Path(pb) => pb.to_string_lossy().to_string(),
            tauri_plugin_dialog::FilePath::Url(u) => u.to_string(),
        };
        let cfg_path = config_path(&app);
        let cfg = serde_json::json!({ "dataDir": &dir });
        fs::write(&cfg_path, serde_json::to_string_pretty(&cfg).unwrap_or_default())
            .map_err(|e| e.to_string())?;
        let mut guard = state.data_dir.lock().map_err(|e| e.to_string())?;
        *guard = Some(dir.clone());
        Ok(Some(dir))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn read_msg_templates(data_dir: String) -> Result<String, String> {
    let path = PathBuf::from(&data_dir).join("msg_templates.json");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("[]".to_string())
    }
}

#[tauri::command]
fn write_msg_templates(data_dir: String, json: String) -> Result<(), String> {
    // Validate JSON
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?;
    let path = PathBuf::from(&data_dir).join("msg_templates.json");
    fs::write(&path, &json).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_vault_file(data_dir: String) -> Result<String, String> {
    let path = PathBuf::from(&data_dir).join("secure_vault.enc");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

#[tauri::command]
fn write_vault_file(data_dir: String, content: String) -> Result<(), String> {
    let dir = PathBuf::from(&data_dir);
    let path = dir.join("secure_vault.enc");

    // 先写入临时文件，再重命名，确保写入原子性
    // 防止写入过程中崩溃导致文件损坏
    let tmp_name = format!("secure_vault.tmp.{}.enc", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos());
    let tmp_path = dir.join(&tmp_name);

    fs::write(&tmp_path, &content).map_err(|e| format!("写入临时文件失败: {}", e))?;
    fs::rename(&tmp_path, &path).map_err(|e| format!("重命名文件失败: {}", e))?;

    Ok(())
}

// ── DevLog 命令 ────────────────────────────────────────────────────

fn devlog_dir(data_dir: &str) -> Result<PathBuf, String> {
    let dir = PathBuf::from(data_dir).join("devlog");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
fn list_devlog_notes(data_dir: String) -> Result<String, String> {
    let dir = devlog_dir(&data_dir)?;
    let mut notes: Vec<serde_json::Value> = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            // 跳过非笔记文件：tags.json 和 images/ 目录
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name == "tags.json" { continue; }
                if name == "images" { continue; }
            }
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(raw) = fs::read_to_string(&path) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
                        notes.push(v);
                    }
                }
            }
        }
    }
    serde_json::to_string(&notes).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_devlog_note(data_dir: String, id: String) -> Result<String, String> {
    let path = devlog_dir(&data_dir)?.join(format!("{}.json", id));
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Err(format!("Note {} not found", id))
    }
}

#[tauri::command]
fn write_devlog_note(data_dir: String, id: String, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?;
    let path = devlog_dir(&data_dir)?.join(format!("{}.json", id));
    fs::write(&path, &json).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_devlog_note(data_dir: String, id: String) -> Result<(), String> {
    let path = devlog_dir(&data_dir)?.join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn read_devlog_tags(data_dir: String) -> Result<String, String> {
    let path = devlog_dir(&data_dir)?.join("tags.json");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("[]".to_string())
    }
}

#[tauri::command]
fn write_devlog_tags(data_dir: String, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?;
    let path = devlog_dir(&data_dir)?.join("tags.json");
    fs::write(&path, &json).map_err(|e| e.to_string())
}

// ── DevLog 图片命令 ────────────────────────────────────────────────

fn devlog_images_dir(data_dir: &str, note_id: &str) -> Result<PathBuf, String> {
    let dir = PathBuf::from(data_dir)
        .join("devlog")
        .join("images")
        .join(note_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
fn write_devlog_image(data_dir: String, note_id: String, data_url: String) -> Result<String, String> {
    // data_url: "data:image/png;base64,iVBORw0KGgo..."
    let (ext, b64) = parse_data_url(&data_url)?;
    let bytes = base64_decode(&b64)?;

    let image_id = uuid_v4();
    let filename = format!("{}.{}", image_id, ext);
    let dir = devlog_images_dir(&data_dir, &note_id)?;
    let path = dir.join(&filename);
    fs::write(&path, &bytes).map_err(|e| format!("写入图片失败: {}", e))?;
    // 返回完整相对路径，包含 note_id 子目录
    Ok(format!("images/{}/{}", note_id, filename))
}

#[tauri::command]
fn read_devlog_image(data_dir: String, image_path: String) -> Result<String, String> {
    let path = PathBuf::from(&data_dir).join("devlog").join(&image_path);
    if !path.exists() {
        return Err(format!("图片不存在: {}", image_path));
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    };
    let bytes = fs::read(&path).map_err(|e| format!("读取图片失败: {}", e))?;
    let b64 = base64_encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn delete_devlog_note_images(data_dir: String, note_id: String) -> Result<(), String> {
    let dir = PathBuf::from(&data_dir)
        .join("devlog")
        .join("images")
        .join(&note_id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("删除图片目录失败: {}", e))?;
    }
    Ok(())
}

/// 从 "data:image/png;base64,xxxx" 解析出扩展名和 base64 内容
fn parse_data_url(data_url: &str) -> Result<(String, String), String> {
    let without_prefix = data_url
        .strip_prefix("data:")
        .ok_or_else(|| "无效的 data URL 格式".to_string())?;
    let parts: Vec<&str> = without_prefix.splitn(2, "base64,").collect();
    if parts.len() != 2 {
        return Err("无效的 data URL：缺少 base64 部分".to_string());
    }
    let mime_part = parts[0].trim_end_matches(';');
    let b64 = parts[1].to_string();

    let ext = match mime_part {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/bmp" => "bmp",
        _ => "png",
    };
    Ok((ext.to_string(), b64))
}

/// base64 解码（处理 URL-safe 和非标准填充）
fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    use base64::Engine as _;
    let engine = base64::engine::general_purpose::STANDARD;
    engine
        .decode(input)
        .map_err(|e| format!("base64 解码失败: {}", e))
}

/// base64 编码
fn base64_encode(input: &[u8]) -> String {
    use base64::Engine as _;
    let engine = base64::engine::general_purpose::STANDARD;
    engine.encode(input)
}

/// 简单的 UUID v4 生成（避免引入 uuid crate）
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let ts = now.as_nanos();
    let rand_part: u64 = {
        let ptr = &ts as *const _ as usize;
        (ptr as u64).wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407)
    };
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (ts >> 32) as u32,
        (ts >> 16) as u16,
        (ts & 0xfff) as u16,
        (rand_part >> 48) as u16,
        rand_part & 0xffffffffffff
    )
}

// ── Calendar 命令 ─────────────────────────────────────────────────

/// 使用指定命令打开目录（默认 code，可在设置中更改）
#[tauri::command]
fn open_dir_with_cmd(path: String, cmd: String) -> Result<(), String> {
    let effective = if cmd.trim().is_empty() { "code".to_string() } else { cmd.trim().to_string() };

    // Windows 上 code 安装为 code.cmd，需要通过 cmd.exe /C 转指才能找到
    // 使用 CREATE_NO_WINDOW 防止 cmd 黑窗口出现并驻留
    #[cfg(target_os = "windows")]
    let spawn_result = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("cmd")
            .args(["/C", &effective, &path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
    };

    #[cfg(not(target_os = "windows"))]
    let spawn_result = std::process::Command::new(&effective)
        .arg(&path)
        .spawn();

    spawn_result
        .map(|_| ())
        .map_err(|e| format!("无法启动 {}: {}", effective, e))
}

#[tauri::command]
async fn fetch_holidays(year: String) -> Result<String, String> {
    let url = format!("https://api.apisbo.com/holidays/year/{}", year);
    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("请求节假日 API 失败: {}", e))?;
    let body = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    Ok(body)
}

#[tauri::command]
fn read_workbench_settings(data_dir: String) -> Result<String, String> {
    let path = PathBuf::from(&data_dir).join("workbench_settings.json");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("{}".to_string())
    }
}

#[tauri::command]
fn write_workbench_settings(data_dir: String, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?;
    let path = PathBuf::from(&data_dir).join("workbench_settings.json");
    fs::write(&path, &json).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_calendar_events(data_dir: String) -> Result<String, String> {
    let path = PathBuf::from(&data_dir).join("calendar_events.json");
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else {
        Ok("[]".to_string())
    }
}

#[tauri::command]
fn write_calendar_events(data_dir: String, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| e.to_string())?;
    let path = PathBuf::from(&data_dir).join("calendar_events.json");
    fs::write(&path, &json).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_info() -> String {
    serde_json::json!({
        "name": "Buffer",
        "version": "1.1.0",
        "platform": std::env::consts::OS,
    })
    .to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            data_dir: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_data_dir,
            check_saved_data_dir,
            select_data_dir,
            read_msg_templates,
            write_msg_templates,
            read_vault_file,
            write_vault_file,
            list_devlog_notes,
            read_devlog_note,
            write_devlog_note,
            delete_devlog_note,
            read_devlog_tags,
            write_devlog_tags,
            write_devlog_image,
            read_devlog_image,
            delete_devlog_note_images,
            fetch_holidays,
            read_workbench_settings,
            write_workbench_settings,
            read_calendar_events,
            write_calendar_events,
            open_dir_with_cmd
        ])
        .setup(|_app| {
            // 注释掉自动打开 DevTools，避免每次 tauri dev 都弹出 F12 控制台
            // 如需手动打开，在窗口中按 F12 即可
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Buffer");
}
