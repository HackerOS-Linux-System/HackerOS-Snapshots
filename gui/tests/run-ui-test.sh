#!/bin/sh
# Runs the front-end in Silver's QuickJS layer against mocked back-end responses.
#   ./run-ui-test.sh /path/to/silver      (Silver checkout whose native/build/libsilverjs.a exists)
# Build the lib first:  (cd /path/to/silver/native && ./build.sh)  — or only the JS part, see README.
set -e
SILVER=${1:-${SILVER_DIR:-../../vendor/silver}}
HERE=$(cd "$(dirname "$0")" && pwd)
LIB="$SILVER/native/build/libsilverjs.a"
[ -f "$LIB" ] || { echo "missing $LIB — build Silver's native layer first"; exit 1; }
(cd "$HERE/../frontend" && node build.mjs >/dev/null)
cc -O1 -Wall "$HERE/hs_runner.c" -o "$HERE/hs_runner" "$LIB" -lm -lpthread
"$HERE/hs_runner" "$HERE/../frontend/dist/app.js" "$HERE/ui-check.js" "$HERE/mocks.tsv" "${2:-4000}"
