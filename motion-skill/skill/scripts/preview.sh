#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
exec "$PACKAGE_DIR/node_modules/.bin/vite-node" "$PACKAGE_DIR/src/cli/motion-scene.ts" serve "$@"
