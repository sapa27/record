#!/usr/bin/env python3
"""Generate strong local-service tokens for Meetily P0 hardening."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import secrets


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Meetily security environment file")
    parser.add_argument("--output", default=".env", help="Output dotenv path")
    parser.add_argument("--force", action="store_true", help="Replace an existing output file")
    args = parser.parse_args()

    output = Path(args.output).expanduser().resolve()
    if output.exists() and not args.force:
        raise SystemExit(f"Refusing to overwrite existing file: {output}. Use --force intentionally.")

    output.parent.mkdir(parents=True, exist_ok=True)
    backend_token = secrets.token_urlsafe(48)
    whisper_token = secrets.token_urlsafe(48)
    content = "\n".join(
        [
            "# Generated locally. Do not commit or share this file.",
            f"MEETILY_BACKEND_TOKEN={backend_token}",
            f"MEETILY_WHISPER_TOKEN={whisper_token}",
            "MEETILY_CONFIDENTIAL_MODE=1",
            "MEETILY_ALLOWED_ORIGINS=tauri://localhost,http://tauri.localhost,http://localhost:3118",
            "MEETILY_MAX_REQUEST_BYTES=8388608",
            "MEETILY_ALLOW_EXTERNAL_CUSTOM_LLM=0",
            "MEETILY_EXTERNAL_LLM_ALLOWLIST=",
            "MEETILY_ALLOW_REMOTE_OLLAMA=0",
            "MEETILY_REMOTE_OLLAMA_ALLOWLIST=",
            "MEETILY_OLLAMA_LOCAL_PORTS=11434",
            "MEETILY_CUSTOM_LLM_LOCAL_PORTS=",
            "MEETILY_POSTHOG_KEY=",
            "",
        ]
    )
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    if os.name != "nt":
        temporary.chmod(0o600)
    temporary.replace(output)
    if os.name != "nt":
        output.chmod(0o600)
    print(f"Created protected environment file: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
