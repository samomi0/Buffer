use std::fs;
use std::path::{Path, PathBuf};
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

// ── 终端集成 ──────────────────────────────────────────────────────────
//
// 基于 portable-pty（Windows 使用 ConPTY）为每个会话创建伪终端，
// 输出通过 term-output 事件实时推送到前端，输入/尺寸调整通过命令下发。
// 默认 shell 为 bash.exe（Git Bash 优先），可在设置中配置自定义路径。

use std::collections::HashMap;
use std::io::Write;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::Emitter;

/// 终端会话滚动缓冲区上限（字节）
const TERM_BUFFER_CAP: usize = 512 * 1024;

struct TermSession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: std::sync::Arc<Mutex<Box<dyn Write + Send>>>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    /// 滚动缓冲区，输出线程写入，term_attach 回放
    buffer: std::sync::Arc<Mutex<Vec<u8>>>,
}

struct TerminalState {
    sessions: Mutex<HashMap<String, TermSession>>,
}

/// 探测可用的 bash.exe（Git Bash 优先，其次常见路径，最后 WSL）
#[tauri::command]
fn term_detect_shell() -> Result<String, String> {
    let candidates = [
        "D:\\software\\git\\Git\\bin\\bash.exe",
        "D:\\software\\git\\Git\\usr\\bin\\bash.exe",
        "C:\\Program Files\\Git\\bin\\bash.exe",
        "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
        "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
        "C:\\msys64\\usr\\bin\\bash.exe",
        "C:\\Windows\\System32\\bash.exe",
    ];
    for c in candidates {
        if Path::new(c).exists() {
            return Ok(c.to_string());
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(out) = std::process::Command::new("where").arg("bash").output() {
            if out.status.success() {
                if let Some(first) = String::from_utf8_lossy(&out.stdout)
                    .lines()
                    .next()
                    .map(|s| s.trim().to_string())
                {
                    if !first.is_empty() {
                        return Ok(first);
                    }
                }
            }
        }
    }
    Ok("bash".to_string())
}

/// 创建终端会话，启动后台读取线程并推送 term-output 事件
#[tauri::command]
fn term_create(
    app: tauri::AppHandle,
    state: tauri::State<'_, TerminalState>,
    id: String,
    shell: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let shell = shell.unwrap_or_else(|| "bash".to_string());
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("创建伪终端失败: {}", e))?;

    let mut cmd = CommandBuilder::new(&shell);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    let cwd = cwd.filter(|s| !s.trim().is_empty()).map(PathBuf::from);
    if let Some(dir) = &cwd {
        if dir.exists() {
            cmd.cwd(dir);
        }
    }
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("启动 shell {} 失败: {}", shell, e))?;
    drop(pair.slave);

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("获取终端写入端失败: {}", e))?;
    let writer = std::sync::Arc::new(Mutex::new(writer));
    let writer2 = std::sync::Arc::clone(&writer);
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("获取终端读取端失败: {}", e))?;

    let app2 = app.clone();
    let id2 = id.clone();
    let buffer = std::sync::Arc::new(Mutex::new(Vec::<u8>::new()));
    let buffer2 = std::sync::Arc::clone(&buffer);
    std::thread::spawn(move || {
        // 输出流处理器：
        //  - 解析 CSI 序列并维护近似光标位置 (row, col)
        //  - 拦截 ESC[6n 光标位置查询，直接应答（ESC[row;colR），不进入缓冲/前端。
        //    否则首次创建时 bash 等待应答会一直阻塞不输出提示符；
        //    而回放缓冲里的查询序列又会让 xterm 自动应答产生多余输入（多出 R）。
        let mut pending: Vec<u8> = Vec::new();
        let mut cursor_row: u16 = 1;
        let mut cursor_col: u16 = 1;

        // 收集一个 CSI 序列（起点为 ESC 所在下标），返回参数与最终字节。
        // 注意必须接受参数字节范围 0x30-0x3f（含 ? < = > 私有前缀）与中间字节
        // 0x20-0x2f，否则 Git Bash 输出的 \x1b[?9001h 等私有模式序列会让解析器
        // 误判为"未完成"而卡住，导致后续所有输出无法透传（表现为终端空白）。
        fn parse_csi(data: &[u8], start: usize) -> Option<(Vec<u16>, u8, usize)> {
            let mut i = start + 2;
            let mut params: Vec<u16> = Vec::new();
            let mut cur: u16 = 0;
            let mut has_param = false;
            while i < data.len() {
                let b = data[i];
                if b.is_ascii_digit() {
                    cur = cur.saturating_mul(10).saturating_add((b - b'0') as u16);
                    has_param = true;
                } else if b == b';' {
                    params.push(if has_param { cur } else { 0 });
                    cur = 0;
                    has_param = false;
                } else if (0x30..=0x3f).contains(&b) {
                    // 参数字节范围内的其它字符（?:<> 等私有模式前缀），忽略
                } else if (0x20..=0x2f).contains(&b) {
                    // 中间字节，忽略
                } else if (0x40..=0x7e).contains(&b) {
                    params.push(if has_param { cur } else { 0 });
                    return Some((params, b, i - start + 1));
                } else {
                    return None;
                }
                i += 1;
            }
            None
        }

        loop {
            let mut buf = [0u8; 4096];
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    let mut clean: Vec<u8> = Vec::new();
                    let mut i = 0usize;
                    while i < pending.len() {
                        let b = pending[i];
                        if b == 0x1b {
                            // CSI 序列 ESC[
                            if i + 1 < pending.len() && pending[i + 1] == b'[' {
                                if let Some((params, final_byte, len)) = parse_csi(&pending, i) {
                                    match final_byte {
                                        b'n' if params == vec![6] => {
                                            // 光标位置查询 → 后端直接应答，不进入缓冲/前端。
                                            // 这样首次创建时 bash 能正常继续输出提示符；
                                            // 同时查询序列不会进入缓冲，重进回放不会让
                                            // xterm 自动应答产生多余输入（多出 R）。
                                            if let Ok(mut w) = writer2.lock() {
                                                let resp = format!("\x1b[{};{}R", cursor_row, cursor_col);
                                                let _ = w.write_all(resp.as_bytes());
                                                let _ = w.flush();
                                            }
                                        }
                                        _ => {
                                            // 更新光标位置
                                            match final_byte {
                                                b'H' | b'f' => {
                                                    cursor_row = params.get(0).copied().unwrap_or(1).max(1);
                                                    cursor_col = params.get(1).copied().unwrap_or(1).max(1);
                                                }
                                                b'A' => cursor_row = cursor_row.saturating_sub(params.get(0).copied().unwrap_or(1).max(1)).max(1),
                                                b'B' => cursor_row = cursor_row.saturating_add(params.get(0).copied().unwrap_or(1).max(1)),
                                                b'C' => cursor_col = cursor_col.saturating_add(params.get(0).copied().unwrap_or(1).max(1)),
                                                b'D' => cursor_col = cursor_col.saturating_sub(params.get(0).copied().unwrap_or(1).max(1)).max(1),
                                                b'G' => cursor_col = params.get(0).copied().unwrap_or(1).max(1),
                                                b'd' => cursor_row = params.get(0).copied().unwrap_or(1).max(1),
                                                _ => {}
                                            }
                                            clean.extend_from_slice(&pending[i..i + len]);
                                        }
                                    }
                                    i += len;
                                    continue;
                                } else {
                                    break; // CSI 序列未完成，保留尾部等下一次读取
                                }
                            }
                            // OSC 序列 ESC]：透传，直到 BEL 或 ESC\ (ST)
                            if i + 1 < pending.len() && pending[i + 1] == b']' {
                                let mut j = i + 2;
                                let mut end = None;
                                while j < pending.len() {
                                    if pending[j] == 0x07 {
                                        end = Some(j + 1);
                                        break;
                                    }
                                    if pending[j] == 0x1b && j + 1 < pending.len() && pending[j + 1] == b'\\' {
                                        end = Some(j + 2);
                                        break;
                                    }
                                    j += 1;
                                }
                                if let Some(end) = end {
                                    clean.extend_from_slice(&pending[i..end]);
                                    i = end;
                                    continue;
                                } else {
                                    break; // OSC 未完成
                                }
                            }
                            // 其它 ESC 前缀，直接透传
                            clean.push(b);
                            i += 1;
                        } else {
                            // 普通字节：更新近似光标位置
                            match b {
                                b'\r' => cursor_col = 1,
                                b'\n' => {
                                    cursor_row = cursor_row.saturating_add(1);
                                    cursor_col = 1;
                                }
                                0x20..=0x7e => cursor_col = cursor_col.saturating_add(1),
                                _ => {}
                            }
                            clean.push(b);
                            i += 1;
                        }
                    }
                    if i < pending.len() {
                        pending.drain(..i);
                    } else {
                        pending.clear();
                    }

                    if !clean.is_empty() {
                        let data = String::from_utf8_lossy(&clean).to_string();
                        if let Ok(mut b) = buffer2.lock() {
                            b.extend_from_slice(data.as_bytes());
                            if b.len() > TERM_BUFFER_CAP {
                                let excess = b.len() - TERM_BUFFER_CAP;
                                let start = b
                                    .iter()
                                    .enumerate()
                                    .skip(excess)
                                    .find(|(_, byte)| **byte == b'\n' || **byte == b'\r')
                                    .map(|(i, _)| i + 1)
                                    .unwrap_or(excess);
                                b.drain(..start);
                            }
                        }
                        let _ = app2.emit(
                            "term-output",
                            serde_json::json!({ "id": id2, "data": data }),
                        );
                    }
                }
            }
        }
    });

    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.insert(
        id.clone(),
        TermSession {
            master: pair.master,
            writer,
            child,
            buffer,
        },
    );
    Ok(())
}

/// 向终端写入输入
#[tauri::command]
fn term_write(
    state: tauri::State<'_, TerminalState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get_mut(&id).ok_or_else(|| "终端不存在".to_string())?;
    let mut writer = session
        .writer
        .lock()
        .map_err(|e| format!("锁定终端写入端失败: {}", e))?;
    writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("写入终端失败: {}", e))
}

/// 调整终端尺寸
#[tauri::command]
fn term_resize(
    state: tauri::State<'_, TerminalState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get_mut(&id).ok_or_else(|| "终端不存在".to_string())?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("调整终端尺寸失败: {}", e))
}

/// 关闭终端会话（结束子进程）
#[tauri::command]
fn term_close(state: tauri::State<'_, TerminalState>, id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&id) {
        let _ = session.child.kill();
    }
    Ok(())
}

/// 列出当前会话 id
#[tauri::command]
fn term_list(state: tauri::State<'_, TerminalState>) -> Result<Vec<String>, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    Ok(sessions.keys().cloned().collect())
}

/// 重新挂载时返回会话的滚动缓冲区（用于回放历史输出）
#[tauri::command]
fn term_attach(state: tauri::State<'_, TerminalState>, id: String) -> Result<String, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions.get(&id).ok_or_else(|| "终端不存在".to_string())?;
    let guard = session.buffer.lock().map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&guard).to_string())
}

/// 应用退出时结束所有终端子进程
fn kill_all_terminals(state: &TerminalState) {
    let mut sessions = match state.sessions.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    for (_, session) in sessions.iter_mut() {
        let _ = session.child.kill();
    }
    sessions.clear();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            data_dir: Mutex::new(None),
        })
        .manage(TerminalState {
            sessions: Mutex::new(HashMap::new()),
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
            open_dir_with_cmd,
            term_detect_shell,
            term_create,
            term_write,
            term_resize,
            term_close,
            term_list,
            term_attach
        ])
        .setup(|_app| {
            // 注释掉自动打开 DevTools，避免每次 tauri dev 都弹出 F12 控制台
            // 如需手动打开，在窗口中按 F12 即可
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Buffer");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<TerminalState>() {
                kill_all_terminals(&state);
            }
        }
    });
}
