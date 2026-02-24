#!/usr/bin/env bash
set -euo pipefail

PROTO_DIR="$(cd "$(dirname "$0")/.." && pwd)/proto"
ENGINE_DIR="$(cd "$(dirname "$0")/.." && pwd)/engine"

# Generate Go code from proto files
protoc \
  --proto_path="$PROTO_DIR" \
  --go_out="$ENGINE_DIR" \
  --go_opt=module=github.com/jamojamo/studio/engine \
  --go-grpc_out="$ENGINE_DIR" \
  --go-grpc_opt=module=github.com/jamojamo/studio/engine \
  "$PROTO_DIR"/jamo/v1/*.proto

echo "Proto generation complete."
