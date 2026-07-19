#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_PATH="${1:-$SCRIPT_DIR/.env}"

if [[ -e "$OUTPUT_PATH" ]]; then
  echo "Refusing to overwrite existing credentials: $OUTPUT_PATH" >&2
  echo "Delete it intentionally or run generate_security_env.py --force." >&2
  exit 1
fi

python3 "$SCRIPT_DIR/generate_security_env.py" --output "$OUTPUT_PATH"
echo "Generated local-only service tokens. Cloud API keys must be stored through the desktop OS credential store."
