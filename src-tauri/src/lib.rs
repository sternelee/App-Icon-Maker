use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};
use tauri_plugin_store::StoreExt;

// ---------------------------------------------------------------------------
// Shared application state
// ---------------------------------------------------------------------------

struct AppState {
    openai_api_key: Mutex<String>,
    has_unsaved_icon: Mutex<bool>,
}

const STORE_FILE: &str = "app-icon-maker.json";
const API_KEY_STORE_KEY: &str = "openai.api_key";

// ---------------------------------------------------------------------------
// Icon resize constants
// ---------------------------------------------------------------------------

const ICON_SIZES: &[(&str, u32)] = &[
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
];

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const SYSTEM_PREFIX: &str =
    "Premium macOS app icon artwork, centered composition, single object only, \
     no text, no letters, no UI mockup, \
     clean cohesive background, \
     object fills the square canvas naturally, \
     NO rounded rectangle container, NO squircle, NO icon plate, \
     NO app icon frame, NO border, NO bezel, NO tile background, \
     background is part of the artwork itself, not a separate shape or container, \
     balanced full-canvas composition, \
     minimalistic, clean, high contrast, \
     3D depth with soft studio lighting, \
     premium material rendering, subtle gradients, \
     SF Symbols inspired simplicity, \
     macOS native aesthetic";

// ---------------------------------------------------------------------------
// OpenAI API interaction
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct OpenAIGenerationRequest {
    model: String,
    prompt: String,
    n: u32,
    size: String,
    quality: String,
}

#[derive(Deserialize)]
struct OpenAIImageData {
    b64_json: String,
}

#[derive(Deserialize)]
struct OpenAIGenerationResponse {
    data: Vec<OpenAIImageData>,
}

async fn openai_generate_images(
    api_key: &str,
    model: &str,
    prompt: &str,
    count: u32,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let payload = OpenAIGenerationRequest {
        model: model.to_string(),
        prompt: prompt.to_string(),
        n: count.min(10),
        size: "1024x1024".to_string(),
        quality: "high".to_string(),
    };

    let res = client
        .post("https://api.openai.com/v1/images/generations")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error {}: {}", status, body));
    }

    let json: OpenAIGenerationResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let images: Vec<String> = json.data.into_iter().map(|d| d.b64_json).collect();
    if images.is_empty() {
        return Err("OpenAI returned no image data.".to_string());
    }
    Ok(images)
}

async fn openai_edit_images(
    api_key: &str,
    model: &str,
    prompt: &str,
    reference_b64: &str,
    count: u32,
) -> Result<Vec<String>, String> {
    let image_bytes =
        base64::engine::general_purpose::STANDARD
            .decode(reference_b64)
            .map_err(|e| format!("Invalid base64 reference image: {}", e))?;

    let part = reqwest::multipart::Part::bytes(image_bytes)
        .file_name("reference.png")
        .mime_str("image/png")
        .map_err(|e| format!("Failed to create multipart: {}", e))?;

    let form = reqwest::multipart::Form::new()
        .text("model", model.to_string())
        .text("prompt", prompt.to_string())
        .text("n", count.min(10).to_string())
        .text("size", "1024x1024".to_string())
        .text("quality", "high".to_string())
        .part("image", part);

    let client = reqwest::Client::new();
    let res = client
        .post("https://api.openai.com/v1/images/edits")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error {}: {}", status, body));
    }

    let json: OpenAIGenerationResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let images: Vec<String> = json.data.into_iter().map(|d| d.b64_json).collect();
    if images.is_empty() {
        return Err("OpenAI returned no image data.".to_string());
    }
    Ok(images)
}

// ---------------------------------------------------------------------------
// Icon build helpers (.iconset → .icns via sips + iconutil)
// ---------------------------------------------------------------------------

fn run_command(cmd: &str, args: &[&str]) -> Result<(), String> {
    let output = std::process::Command::new(cmd)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run '{}': {}", cmd, e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("'{}' failed: {}", cmd, stderr.trim()));
    }
    Ok(())
}

async fn build_icns(
    image_data: Vec<u8>,
    iconset_dir: &std::path::Path,
    icns_path: &std::path::Path,
) -> Result<(), String> {
    let tmp = std::env::temp_dir().join(format!("iconmaker-{}", std::process::id()));
    std::fs::create_dir_all(&tmp).map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let src_png = tmp.join("icon_1024.png");
    std::fs::write(&src_png, &image_data)
        .map_err(|e| format!("Failed to write temp PNG: {}", e))?;

    let _ = std::fs::remove_dir_all(iconset_dir);
    let _ = std::fs::remove_file(icns_path);

    std::fs::create_dir_all(iconset_dir)
        .map_err(|e| format!("Failed to create iconset dir: {}", e))?;

    for (name, size) in ICON_SIZES {
        run_command(
            "sips",
            &[
                "-z",
                &size.to_string(),
                &size.to_string(),
                src_png.to_str().unwrap(),
                "--out",
                iconset_dir.join(name).to_str().unwrap(),
            ],
        )?;
    }

    run_command(
        "iconutil",
        &[
            "-c",
            "icns",
            iconset_dir.to_str().unwrap(),
            "--output",
            icns_path.to_str().unwrap(),
        ],
    )?;

    let _ = std::fs::remove_dir_all(&tmp);
    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn set_openai_api_key(
    api_key: String,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    let trimmed = api_key.trim().to_string();
    if trimmed.is_empty() {
        return Err("API key cannot be empty.".to_string());
    }
    // Persist to store
    if let Ok(store) = app.store(STORE_FILE) {
        store.set(API_KEY_STORE_KEY, serde_json::Value::String(trimmed.clone()));
        let _ = store.save();
    }
    // Also keep in memory
    let mut key = state.openai_api_key.lock().map_err(|e| e.to_string())?;
    *key = trimmed;
    Ok(())
}

#[tauri::command]
fn get_openai_api_key_status(state: State<AppState>) -> Result<OpenAIApiKeyStatus, String> {
    let key = state.openai_api_key.lock().map_err(|e| e.to_string())?;
    Ok(OpenAIApiKeyStatus {
        openai_key_required: true,
        has_openai_key: !key.is_empty(),
    })
}

#[tauri::command]
fn get_stored_openai_api_key(state: State<AppState>) -> Result<StoredApiKey, String> {
    let key = state.openai_api_key.lock().map_err(|e| e.to_string())?;
    Ok(StoredApiKey {
        api_key: key.clone(),
    })
}

#[tauri::command]
fn set_unsaved_icon_state(unsaved: bool, state: State<AppState>) -> Result<(), String> {
    let mut s = state.has_unsaved_icon.lock().map_err(|e| e.to_string())?;
    *s = unsaved;
    Ok(())
}

#[tauri::command]
async fn generate_icon(
    prompt: String,
    model: String,
    reference_image: String,
    seed: i32,
    state: State<'_, AppState>,
) -> Result<GenerateIconResponse, String> {
    let _ = seed;

    let api_key = {
        let key = state.openai_api_key.lock().map_err(|e| e.to_string())?;
        if key.is_empty() {
            return Err("No OpenAI API key. Add one in the settings.".to_string());
        }
        key.clone()
    };

    let model_name = if model.trim().is_empty() {
        "gpt-image-1"
    } else {
        model.trim()
    };

    let full_prompt = format!("{}, {}", SYSTEM_PREFIX, prompt.trim());

    let images = if reference_image.is_empty() {
        openai_generate_images(&api_key, model_name, &full_prompt, 3).await?
    } else {
        openai_edit_images(&api_key, model_name, &full_prompt, &reference_image, 3).await?
    };

    Ok(GenerateIconResponse { images })
}

#[tauri::command]
async fn save_icon(
    app_handle: tauri::AppHandle,
    image_data: Vec<u8>,
) -> Result<SaveIconResponse, String> {
    use tauri_plugin_dialog::DialogExt;

    let desktop_path = dirs::desktop_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("app.icns");

    let result = app_handle
        .dialog()
        .file()
        .add_filter("macOS icon", &["icns"])
        .set_file_name("app.icns")
        .set_directory(desktop_path.parent().unwrap_or(std::path::Path::new(".")))
        .blocking_save_file();

    match result {
        Some(file_path) => {
            let pb = file_path.into_path().unwrap_or_default();
            let parent_dir = pb.parent().unwrap_or(std::path::Path::new(".")).to_path_buf();
            let file_stem = pb.file_stem().and_then(|s| s.to_str()).unwrap_or("App");
            let iconset_dir = parent_dir.join(format!("{}.iconset", file_stem));
            let icns_path = parent_dir.join(format!("{}.icns", file_stem));

            build_icns(image_data, &iconset_dir, &icns_path).await?;

            Ok(SaveIconResponse {
                saved_path: parent_dir.to_string_lossy().to_string(),
                canceled: false,
                icns_path: icns_path.to_string_lossy().to_string(),
            })
        }
        None => Ok(SaveIconResponse {
            saved_path: String::new(),
            canceled: true,
            icns_path: String::new(),
        }),
    }
}

#[tauri::command]
fn show_path_in_finder(path: String) -> Result<(), String> {
    run_command("open", &["-R", &path])
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    run_command("open", &[&url])
}

#[tauri::command]
fn read_file_as_base64(path: String) -> Result<String, String> {
    let data = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct OpenAIApiKeyStatus {
    openai_key_required: bool,
    has_openai_key: bool,
}

#[derive(Serialize)]
struct StoredApiKey {
    api_key: String,
}

#[derive(Serialize)]
struct GenerateIconResponse {
    images: Vec<String>,
}

#[derive(Serialize)]
struct SaveIconResponse {
    saved_path: String,
    canceled: bool,
    icns_path: String,
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState {
            openai_api_key: Mutex::new(String::new()),
            has_unsaved_icon: Mutex::new(false),
        })
        .setup(|app| {
            // Load persisted API key from store on startup
            if let Ok(store) = app.store(STORE_FILE) {
                if let Some(val) = store.get(API_KEY_STORE_KEY) {
                    if let Some(key_str) = val.as_str() {
                        let state = app.state::<AppState>();
                        if let Ok(mut key) = state.openai_api_key.lock() {
                            *key = key_str.to_string();
                        };
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Handle close request: warn about unsaved changes
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                let has_unsaved = *state.has_unsaved_icon.lock().unwrap();
                if has_unsaved {
                    // Prevent immediate close; frontend must call set_unsaved_icon_state(false) first
                    api.prevent_close();
                }
                // If save was clicked and state is clean, window closes naturally
            }
        })
        .invoke_handler(tauri::generate_handler![
            generate_icon,
            save_icon,
            show_path_in_finder,
            open_external_url,
            set_openai_api_key,
            get_openai_api_key_status,
            get_stored_openai_api_key,
            set_unsaved_icon_state,
            read_file_as_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
