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
    gemini_api_key: Mutex<String>,
    openrouter_api_key: Mutex<String>,
    fal_api_key: Mutex<String>,
    has_unsaved_icon: Mutex<bool>,
}

const STORE_FILE: &str = "app-icon-maker.json";
const OPENAI_API_KEY_KEY: &str = "openai.api_key";
const GEMINI_API_KEY_KEY: &str = "gemini.api_key";
const OPENROUTER_API_KEY_KEY: &str = "openrouter.api_key";
const FAL_API_KEY_KEY: &str = "fal.api_key";

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
    let image_bytes = base64::engine::general_purpose::STANDARD
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
// Gemini API interaction
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct GeminiContentPart {
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    inline_data: Option<GeminiInlineData>,
}

#[derive(Serialize)]
struct GeminiInlineData {
    mime_type: String,
    data: String,
}

#[derive(Serialize)]
struct GeminiContent {
    parts: Vec<GeminiContentPart>,
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
}

#[derive(Deserialize)]
struct GeminiApiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContentResponse>,
}

#[derive(Deserialize)]
struct GeminiContentResponse {
    parts: Vec<GeminiPartResponse>,
}

#[derive(Deserialize)]
struct GeminiPartResponse {
    #[serde(default)]
    inline_data: Option<GeminiInlineDataResponse>,
}

#[derive(Deserialize)]
struct GeminiInlineDataResponse {
    mime_type: String,
    data: String,
}

/// Generate images via Google Gemini API (generateContent).
/// Makes `count` parallel requests since some models only return one image per call.
async fn gemini_generate_images(
    api_key: &str,
    model: &str,
    prompt: &str,
    count: u32,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        model
    );

    let mut handles = Vec::new();
    for _ in 0..count.min(3) {
        let payload = GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiContentPart {
                    text: Some(prompt.to_string()),
                    inline_data: None,
                }],
            }],
        };

        let client = client.clone();
        let url = url.clone();
        let api_key = api_key.to_string();

        handles.push(tokio::spawn(async move {
            let res = client
                .post(&url)
                .header("x-goog-api-key", &api_key)
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Gemini network error: {}", e))?;

            if !res.status().is_success() {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                return Err(format!("Gemini API error {}: {}", status, body));
            }

            let json: GeminiApiResponse = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;

            // Extract first image from the response candidates
            if let Some(candidates) = json.candidates {
                for c in candidates {
                    if let Some(content) = c.content {
                        for part in content.parts {
                            if let Some(data) = part.inline_data {
                                if data.mime_type.starts_with("image/") {
                                    return Ok(data.data);
                                }
                            }
                        }
                    }
                }
            }
            Err("Gemini returned no image data.".to_string())
        }));
    }

    let mut images = Vec::new();
    for h in handles {
        match h.await {
            Ok(Ok(b64)) => images.push(b64),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(format!("Task failed: {}", e)),
        }
    }

    if images.is_empty() {
        return Err("Gemini returned no image data.".to_string());
    }
    Ok(images)
}

/// Edit images via Google Gemini API — reference image sent as inlineData.
async fn gemini_edit_images(
    api_key: &str,
    model: &str,
    prompt: &str,
    reference_b64: &str,
    count: u32,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        model
    );

    let mut handles = Vec::new();
    for _ in 0..count.min(3) {
        let payload = GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![
                    GeminiContentPart {
                        text: None,
                        inline_data: Some(GeminiInlineData {
                            mime_type: "image/png".to_string(),
                            data: reference_b64.to_string(),
                        }),
                    },
                    GeminiContentPart {
                        text: Some(prompt.to_string()),
                        inline_data: None,
                    },
                ],
            }],
        };

        let client = client.clone();
        let url = url.clone();
        let api_key = api_key.to_string();

        handles.push(tokio::spawn(async move {
            let res = client
                .post(&url)
                .header("x-goog-api-key", &api_key)
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Gemini network error: {}", e))?;

            if !res.status().is_success() {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                return Err(format!("Gemini API error {}: {}", status, body));
            }

            let json: GeminiApiResponse = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;

            if let Some(candidates) = json.candidates {
                for c in candidates {
                    if let Some(content) = c.content {
                        for part in content.parts {
                            if let Some(data) = part.inline_data {
                                if data.mime_type.starts_with("image/") {
                                    return Ok(data.data);
                                }
                            }
                        }
                    }
                }
            }
            Err("Gemini returned no image data.".to_string())
        }));
    }

    let mut images = Vec::new();
    for h in handles {
        match h.await {
            Ok(Ok(b64)) => images.push(b64),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(format!("Task failed: {}", e)),
        }
    }

    if images.is_empty() {
        return Err("Gemini returned no image data.".to_string());
    }
    Ok(images)
}

// ---------------------------------------------------------------------------
// OpenRouter API interaction (chat completions with image generation)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct OpenRouterChoice {
    message: OpenRouterMessage,
}

#[derive(Deserialize)]
struct OpenRouterMessage {
    #[serde(default)]
    images: Option<Vec<OpenRouterImage>>,
}

#[derive(Deserialize)]
struct OpenRouterImage {
    image_url: OpenRouterImageUrl,
}

#[derive(Deserialize)]
struct OpenRouterImageUrl {
    url: String,
}

#[derive(Deserialize)]
struct OpenRouterResponse {
    choices: Vec<OpenRouterChoice>,
}

/// Generate images via OpenRouter chat completions API.
/// Makes `count` parallel requests.
async fn openrouter_generate_images(
    api_key: &str,
    model: &str,
    prompt: &str,
    count: u32,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let url = "https://openrouter.ai/api/v1/chat/completions";

    let mut handles = Vec::new();
    for _ in 0..count.min(3) {
        #[derive(Serialize)]
        struct Msg {
            role: String,
            content: String,
        }
        #[derive(Serialize)]
        struct Body {
            model: String,
            messages: Vec<Msg>,
            modalities: Vec<String>,
        }

        let payload = Body {
            model: model.to_string(),
            messages: vec![Msg {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
            modalities: vec!["image".to_string()],
        };

        let client = client.clone();
        let api_key = api_key.to_string();

        handles.push(tokio::spawn(async move {
            let res = client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("OpenRouter network error: {}", e))?;

            if !res.status().is_success() {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                return Err(format!("OpenRouter API error {}: {}", status, body));
            }

            let json: OpenRouterResponse = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse OpenRouter response: {}", e))?;

            if let Some(choice) = json.choices.first() {
                if let Some(images) = &choice.message.images {
                    if let Some(img) = images.iter().next() {
                        let url = &img.image_url.url;
                        // Strip data URL prefix if present
                        if let Some(comma) = url.find(",") {
                            return Ok(url[comma + 1..].to_string());
                        }
                        return Ok(url.clone());
                    }
                }
            }
            Err("OpenRouter returned no image data.".to_string())
        }));
    }

    let mut images = Vec::new();
    for h in handles {
        match h.await {
            Ok(Ok(b64)) => images.push(b64),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(format!("Task failed: {}", e)),
        }
    }

    if images.is_empty() {
        return Err("OpenRouter returned no image data.".to_string());
    }
    Ok(images)
}

/// Generate images via OpenRouter chat completions with a reference image.
async fn openrouter_edit_images(
    api_key: &str,
    model: &str,
    prompt: &str,
    reference_b64: &str,
    count: u32,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let url = "https://openrouter.ai/api/v1/chat/completions";

    let mut handles = Vec::new();
    for _ in 0..count.min(3) {
        // Build multi-part content: image + text
        let content = serde_json::json!([
            {
                "type": "image_url",
                "image_url": {
                    "url": format!("data:image/png;base64,{}", reference_b64)
                }
            },
            {
                "type": "text",
                "text": prompt
            }
        ]);

        let payload = serde_json::json!({
            "model": model,
            "messages": [{
                "role": "user",
                "content": content
            }],
            "modalities": ["image", "text"]
        });

        let client = client.clone();
        let api_key = api_key.to_string();
        let url = url.to_string();

        handles.push(tokio::spawn(async move {
            let res = client
                .post(&url)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("OpenRouter network error: {}", e))?;

            if !res.status().is_success() {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                return Err(format!("OpenRouter API error {}: {}", status, body));
            }

            let json: OpenRouterResponse = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse OpenRouter response: {}", e))?;

            if let Some(choice) = json.choices.first() {
                if let Some(images) = &choice.message.images {
                    if let Some(img) = images.iter().next() {
                        let url = &img.image_url.url;
                        if let Some(comma) = url.find(",") {
                            return Ok(url[comma + 1..].to_string());
                        }
                        return Ok(url.clone());
                    }
                }
            }
            Err("OpenRouter returned no image data.".to_string())
        }));
    }

    let mut images = Vec::new();
    for h in handles {
        match h.await {
            Ok(Ok(b64)) => images.push(b64),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(format!("Task failed: {}", e)),
        }
    }

    if images.is_empty() {
        return Err("OpenRouter returned no image data.".to_string());
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


// ---------------------------------------------------------------------------
// fal.ai API interaction (queue-based)
// ---------------------------------------------------------------------------

use std::time::Duration;

#[derive(Deserialize)]
struct FalSubmitResponse {
    request_id: String,
}

#[derive(Deserialize)]
struct FalStatusResponse {
    status: String,
}

#[derive(Deserialize)]
struct FalResultResponse {
    images: Option<Vec<FalResultImage>>,
}

#[derive(Deserialize)]
struct FalResultImage {
    url: String,
}

/// Submit to fal.ai queue, poll until done, return base64 encoded images.
async fn fal_generate(
    api_key: &str,
    model: &str,
    prompt: &str,
    reference_b64: Option<&str>,
) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let base = "https://queue.fal.run";

    // Determine submit and status endpoints
    let submit_endpoint = if reference_b64.is_some() {
        format!("{}/edit", model)
    } else {
        model.to_string()
    };
    let submit_url = format!("{}/{}", base, submit_endpoint);
    // Status/result URLs use the base model path (without /edit suffix)
    let model_base = model.to_string();

    // Build request body
    let body = if let Some(ref_b64) = reference_b64 {
        // Upload the reference image first, or use data URL: fal.ai accepts data URLs
        serde_json::json!({
            "prompt": prompt,
            "image_url": format!("data:image/png;base64,{}", ref_b64)
        })
    } else {
        serde_json::json!({
            "prompt": prompt
        })
    };

    // Submit the request
    let submit_res = client
        .post(&submit_url)
        .header("Authorization", format!("Key {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("fal.ai network error: {}", e))?;

    if !submit_res.status().is_success() {
        let status = submit_res.status();
        let body = submit_res.text().await.unwrap_or_default();
        return Err(format!("fal.ai API error {}: {}", status, body));
    }

    let submit_json: FalSubmitResponse = submit_res
        .json()
        .await
        .map_err(|e| format!("Failed to parse fal.ai submit response: {}", e))?;

    let request_id = submit_json.request_id;
    let status_url = format!("{}/{}/requests/{}/status", base, model_base, request_id);
    let result_url = format!("{}/{}/requests/{}", base, model_base, request_id);

    // Poll for status
    let max_attempts = 120; // ~2 minutes max
    for attempt in 0..max_attempts {
        tokio::time::sleep(Duration::from_millis(1000)).await;

        let status_res = client
            .get(&status_url)
            .header("Authorization", format!("Key {}", api_key))
            .send()
            .await
            .map_err(|e| format!("fal.ai status poll error: {}", e))?;

        let poll_status = status_res.status();
        if !poll_status.is_success() {
            let body = status_res.text().await.unwrap_or_default();
            return Err(format!("fal.ai status error {}: {}", poll_status, body));
        }

        let status_json: FalStatusResponse = status_res
            .json()
            .await
            .map_err(|e| format!("Failed to parse fal.ai status: {}", e))?;

        match status_json.status.as_str() {
            "COMPLETED" => {
                // Fetch result
                let result_res = client
                    .get(&result_url)
                    .header("Authorization", format!("Key {}", api_key))
                    .send()
                    .await
                    .map_err(|e| format!("fal.ai result fetch error: {}", e))?;

                let result_status = result_res.status();
                if !result_status.is_success() {
                    let body = result_res.text().await.unwrap_or_default();
                    return Err(format!("fal.ai result error {}: {}", result_status, body));
                }

                let result_json: FalResultResponse = result_res
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse fal.ai result: {}", e))?;

                if let Some(images) = result_json.images {
                    if images.is_empty() {
                        return Err("fal.ai returned no images.".to_string());
                    }
                    // Download each image and convert to base64
                    let mut results = Vec::new();
                    for img in &images {
                        let img_res = client
                            .get(&img.url)
                            .send()
                            .await
                            .map_err(|e| format!("Failed to download fal.ai image: {}", e))?;
                        let img_bytes = img_res
                            .bytes()
                            .await
                            .map_err(|e| format!("Failed to read fal.ai image: {}", e))?;
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&img_bytes);
                        results.push(b64);
                    }
                    return Ok(results);
                }
                return Err("fal.ai returned no images.".to_string());
            }
            "FAILED" => {
                return Err(format!("fal.ai request {} failed", request_id));
            }
            _ => {
                // IN_QUEUE or IN_PROGRESS — keep polling
                if attempt == max_attempts - 1 {
                    return Err("fal.ai request timed out.".to_string());
                }
            }
        }
    }

    Err("fal.ai request timed out.".to_string())
}

/// Generate images via fal.ai. Makes parallel requests for multiple images.
async fn fal_generate_images(
    api_key: &str,
    model: &str,
    prompt: &str,
    reference_b64: Option<&str>,
    count: u32,
) -> Result<Vec<String>, String> {
    let mut handles = Vec::new();
    for _ in 0..count.min(3) {
        let api_key = api_key.to_string();
        let model = model.to_string();
        let prompt = prompt.to_string();
        let ref_b64 = reference_b64.map(|s| s.to_string());

        handles.push(tokio::spawn(async move {
            fal_generate(&api_key, &model, &prompt, ref_b64.as_deref()).await
        }));
    }

    let mut images = Vec::new();
    for h in handles {
        match h.await {
            Ok(Ok(mut imgs)) => images.append(&mut imgs),
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(format!("Task failed: {}", e)),
        }
    }

    if images.is_empty() {
        return Err("fal.ai returned no image data.".to_string());
    }
    Ok(images)
}

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
    if let Ok(store) = app.store(STORE_FILE) {
        store.set(
            OPENAI_API_KEY_KEY,
            serde_json::Value::String(trimmed.clone()),
        );
        let _ = store.save();
    }
    let mut key = state.openai_api_key.lock().map_err(|e| e.to_string())?;
    *key = trimmed;
    Ok(())
}

#[tauri::command]
fn get_openai_api_key_status(state: State<AppState>) -> Result<ApiKeyStatus, String> {
    let key = state.openai_api_key.lock().map_err(|e| e.to_string())?;
    Ok(ApiKeyStatus {
        key_required: true,
        has_key: !key.is_empty(),
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
fn set_gemini_api_key(
    api_key: String,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    let trimmed = api_key.trim().to_string();
    if trimmed.is_empty() {
        return Err("API key cannot be empty.".to_string());
    }
    if let Ok(store) = app.store(STORE_FILE) {
        store.set(
            GEMINI_API_KEY_KEY,
            serde_json::Value::String(trimmed.clone()),
        );
        let _ = store.save();
    }
    let mut key = state.gemini_api_key.lock().map_err(|e| e.to_string())?;
    *key = trimmed;
    Ok(())
}

#[tauri::command]
fn get_gemini_api_key_status(state: State<AppState>) -> Result<ApiKeyStatus, String> {
    let key = state.gemini_api_key.lock().map_err(|e| e.to_string())?;
    Ok(ApiKeyStatus {
        key_required: true,
        has_key: !key.is_empty(),
    })
}

#[tauri::command]
fn get_stored_gemini_api_key(state: State<AppState>) -> Result<StoredApiKey, String> {
    let key = state.gemini_api_key.lock().map_err(|e| e.to_string())?;
    Ok(StoredApiKey {
        api_key: key.clone(),
    })
}


// ---------------------------------------------------------------------------
// fal.ai API key management
// ---------------------------------------------------------------------------

#[tauri::command]
fn set_fal_api_key(
    api_key: String,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    let trimmed = api_key.trim().to_string();
    if trimmed.is_empty() {
        return Err("API key cannot be empty.".to_string());
    }
    if let Ok(store) = app.store(STORE_FILE) {
        store.set(FAL_API_KEY_KEY, serde_json::Value::String(trimmed.clone()));
        let _ = store.save();
    }
    let mut key = state.fal_api_key.lock().map_err(|e| e.to_string())?;
    *key = trimmed;
    Ok(())
}

#[tauri::command]
fn get_fal_api_key_status(state: State<AppState>) -> Result<ApiKeyStatus, String> {
    let key = state.fal_api_key.lock().map_err(|e| e.to_string())?;
    Ok(ApiKeyStatus {
        key_required: true,
        has_key: !key.is_empty(),
    })
}

#[tauri::command]
fn get_stored_fal_api_key(state: State<AppState>) -> Result<StoredApiKey, String> {
    let key = state.fal_api_key.lock().map_err(|e| e.to_string())?;
    Ok(StoredApiKey {
        api_key: key.clone(),
    })
}


// ---------------------------------------------------------------------------
// OpenRouter API key management
#[tauri::command]
fn set_openrouter_api_key(
    api_key: String,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    let trimmed = api_key.trim().to_string();
    if trimmed.is_empty() {
        return Err("API key cannot be empty.".to_string());
    }
    if let Ok(store) = app.store(STORE_FILE) {
        store.set(
            OPENROUTER_API_KEY_KEY,
            serde_json::Value::String(trimmed.clone()),
        );
        let _ = store.save();
    }
    let mut key = state.openrouter_api_key.lock().map_err(|e| e.to_string())?;
    *key = trimmed;
    Ok(())
}

#[tauri::command]
fn get_openrouter_api_key_status(state: State<AppState>) -> Result<ApiKeyStatus, String> {
    let key = state.openrouter_api_key.lock().map_err(|e| e.to_string())?;
    Ok(ApiKeyStatus {
        key_required: true,
        has_key: !key.is_empty(),
    })
}

#[tauri::command]
fn get_stored_openrouter_api_key(state: State<AppState>) -> Result<StoredApiKey, String> {
    let key = state.openrouter_api_key.lock().map_err(|e| e.to_string())?;
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
    provider: String,
    reference_image: String,
    seed: i32,
    state: State<'_, AppState>,
) -> Result<GenerateIconResponse, String> {
    let _ = seed;

    let full_prompt = format!("{}, {}", SYSTEM_PREFIX, prompt.trim());
    let model_name = if model.trim().is_empty() {
        match provider.as_str() {
            "gemini" => "gemini-2.5-flash-image",
            "openrouter" => "google/gemini-2.5-flash-image",
            "fal" => "fal-ai/nano-banana",
            _ => "gpt-image-1",
        }
    } else {
        model.trim()
    };

    match provider.as_str() {
        "fal" => {
            let api_key = {
                let key = state.fal_api_key.lock().map_err(|e| e.to_string())?;
                if key.is_empty() {
                    return Err("No fal.ai API key. Add one in the settings.".to_string());
                }
                key.clone()
            };

            let reference_b64 = if reference_image.is_empty() {
                None
            } else {
                Some(reference_image.as_str())
            };

            let images = fal_generate_images(&api_key, model_name, &full_prompt, reference_b64, 3).await?;
            Ok(GenerateIconResponse { images })
        }
        "openrouter" => {
            let api_key = {
                let key = state.openrouter_api_key.lock().map_err(|e| e.to_string())?;
                if key.is_empty() {
                    return Err("No OpenRouter API key. Add one in the settings.".to_string());
                }
                key.clone()
            };

            let images = if reference_image.is_empty() {
                openrouter_generate_images(&api_key, model_name, &full_prompt, 3).await?
            } else {
                openrouter_edit_images(&api_key, model_name, &full_prompt, &reference_image, 3).await?
            };
            Ok(GenerateIconResponse { images })
        }
        "gemini" => {
            let api_key = {
                let key = state.gemini_api_key.lock().map_err(|e| e.to_string())?;
                if key.is_empty() {
                    return Err("No Gemini API key. Add one in the settings.".to_string());
                }
                key.clone()
            };

            let images = if reference_image.is_empty() {
                gemini_generate_images(&api_key, model_name, &full_prompt, 3).await?
            } else {
                gemini_edit_images(&api_key, model_name, &full_prompt, &reference_image, 3).await?
            };
            Ok(GenerateIconResponse { images })
        }
        _ => {
            // OpenAI
            let api_key = {
                let key = state.openai_api_key.lock().map_err(|e| e.to_string())?;
                if key.is_empty() {
                    return Err("No OpenAI API key. Add one in the settings.".to_string());
                }
                key.clone()
            };

            let images = if reference_image.is_empty() {
                openai_generate_images(&api_key, model_name, &full_prompt, 3).await?
            } else {
                openai_edit_images(&api_key, model_name, &full_prompt, &reference_image, 3).await?
            };
            Ok(GenerateIconResponse { images })
        }
    }
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
            let parent_dir = pb
                .parent()
                .unwrap_or(std::path::Path::new("."))
                .to_path_buf();
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
struct ApiKeyStatus {
    key_required: bool,
    has_key: bool,
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
            gemini_api_key: Mutex::new(String::new()),
            openrouter_api_key: Mutex::new(String::new()),
            fal_api_key: Mutex::new(String::new()),
            has_unsaved_icon: Mutex::new(false),
        })
        .setup(|app| {
            if let Ok(store) = app.store(STORE_FILE) {
                // Load OpenAI API key
                if let Some(val) = store.get(OPENAI_API_KEY_KEY) {
                    if let Some(key_str) = val.as_str() {
                        let state = app.state::<AppState>();
                        if let Ok(mut key) = state.openai_api_key.lock() {
                            *key = key_str.to_string();
                        };
                    }
                }
                // Load Gemini API key
                if let Some(val) = store.get(GEMINI_API_KEY_KEY) {
                    if let Some(key_str) = val.as_str() {
                        let state = app.state::<AppState>();
                        if let Ok(mut key) = state.gemini_api_key.lock() {
                            *key = key_str.to_string();
                        };
                    }
                }
                // Load fal.ai API key
                if let Some(val) = store.get(FAL_API_KEY_KEY) {
                    if let Some(key_str) = val.as_str() {
                        let state = app.state::<AppState>();
                        if let Ok(mut key) = state.fal_api_key.lock() {
                            *key = key_str.to_string();
                        };
                    }
                }
                // Load OpenRouter API key
                if let Some(val) = store.get(OPENROUTER_API_KEY_KEY) {
                    if let Some(key_str) = val.as_str() {
                        let state = app.state::<AppState>();
                        if let Ok(mut key) = state.openrouter_api_key.lock() {
                            *key = key_str.to_string();
                        };
                    }
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                let has_unsaved = *state.has_unsaved_icon.lock().unwrap();
                if has_unsaved {
                    api.prevent_close();
                }
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
            set_gemini_api_key,
            get_gemini_api_key_status,
            get_stored_gemini_api_key,
            set_fal_api_key,
            get_fal_api_key_status,
            get_stored_fal_api_key,
            set_openrouter_api_key,
            get_openrouter_api_key_status,
            get_stored_openrouter_api_key,
            set_unsaved_icon_state,
            read_file_as_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
