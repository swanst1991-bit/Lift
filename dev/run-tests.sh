#!/bin/bash
# Lift — run the test suite.
# There is no node on this machine; tests run under the JavaScriptCore shell
# that ships with macOS. Exits non-zero if any assertion fails.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$DIR/../index.html"
JSC="/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"

if [[ ! -x "$JSC" ]]; then
  echo "jsc not found at $JSC" >&2
  exit 2
fi
if [[ ! -f "$APP" ]]; then
  echo "index.html not found at $APP" >&2
  exit 2
fi

echo "Lift — $(basename "$APP") ($(wc -l < "$APP" | tr -d ' ') lines)"

# __APP_PATH is read by tests.js; jsc has no argv, so it goes in via a prelude.
PRELUDE="$(mktemp -t lift-prelude)"
trap 'rm -f "$PRELUDE"' EXIT
printf 'globalThis.__APP_PATH = "%s";\n' "$APP" > "$PRELUDE"

"$JSC" "$PRELUDE" "$DIR/harness.js" "$DIR/tests.js"
