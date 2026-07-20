// ============================================================================
// FFmpeg Binary Bundling (offline / supply-chain hardened)
// ============================================================================
// The PC release never downloads executable files during `cargo build`.
// It copies a locally installed, operator-approved FFmpeg binary into the
// Tauri sidecar directory and verifies that the binary can report its version.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Ensure a verified local FFmpeg binary is available under the target-specific
/// name required by Tauri's `externalBin` convention.
pub fn ensure_ffmpeg_binary() {
    let target = std::env::var("TARGET")
        .or_else(|_| std::env::var("HOST"))
        .expect("Neither TARGET nor HOST environment variable is set");

    let binary_name = if target.contains("windows") {
        format!("ffmpeg-{target}.exe")
    } else {
        format!("ffmpeg-{target}")
    };

    let manifest_dir = PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR")
            .expect("CARGO_MANIFEST_DIR environment variable is not set"),
    );
    let binaries_dir = manifest_dir.join("binaries");
    let bundled_path = binaries_dir.join(binary_name);

    if bundled_path.exists() && verify_ffmpeg_binary(&bundled_path) {
        println!(
            "cargo:warning=Using previously verified FFmpeg sidecar: {}",
            bundled_path.display()
        );
        return;
    }

    std::fs::create_dir_all(&binaries_dir)
        .expect("Failed to create the Tauri binaries directory");

    let source = resolve_local_ffmpeg().unwrap_or_else(|error| {
        panic!(
            "FFmpeg is required to build Meetily Thai. {error}. Install FFmpeg and ensure ffmpeg.exe is on PATH, or set MEETILY_FFMPEG_BINARY to an approved local binary."
        )
    });

    if !verify_ffmpeg_binary(&source) {
        panic!(
            "The selected FFmpeg binary failed verification: {}",
            source.display()
        );
    }

    if source != bundled_path {
        std::fs::copy(&source, &bundled_path).unwrap_or_else(|error| {
            panic!(
                "Failed to copy FFmpeg from {} to {}: {error}",
                source.display(),
                bundled_path.display()
            )
        });
    }

    if !verify_ffmpeg_binary(&bundled_path) {
        panic!(
            "The bundled FFmpeg sidecar failed verification: {}",
            bundled_path.display()
        );
    }

    println!(
        "cargo:warning=Bundled locally verified FFmpeg sidecar: {}",
        bundled_path.display()
    );
}

fn resolve_local_ffmpeg() -> Result<PathBuf, String> {
    if let Ok(configured) = std::env::var("MEETILY_FFMPEG_BINARY") {
        let path = PathBuf::from(configured.trim());
        if !path.is_file() {
            return Err(format!(
                "MEETILY_FFMPEG_BINARY does not point to a file: {}",
                path.display()
            ));
        }
        return Ok(path);
    }

    which::which("ffmpeg").map_err(|_| "No local FFmpeg executable was found".to_string())
}

fn verify_ffmpeg_binary(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }

    Command::new(path)
        .arg("-version")
        .output()
        .map(|output| {
            output.status.success()
                && String::from_utf8_lossy(&output.stdout)
                    .to_ascii_lowercase()
                    .contains("ffmpeg version")
        })
        .unwrap_or(false)
}
