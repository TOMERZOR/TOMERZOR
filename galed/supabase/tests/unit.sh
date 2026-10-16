#!/usr/bin/env bash
# Unit tests that need only Node. Usage: supabase/tests/unit.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$(mktemp -d)"
"$here/../../node_modules/.bin/esbuild" "$here/message.test.ts" --bundle --platform=node --format=esm --log-level=warning --outfile="$out/message.test.mjs"
node "$out/message.test.mjs"
