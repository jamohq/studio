#!/usr/bin/env bash
set -euo pipefail

# Build Jamo Studio for distribution
# Usage: ./scripts/build.sh [--platform mac|linux|all]

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE_DIR="$REPO_ROOT/engine"
DESKTOP_DIR="$REPO_ROOT/apps/desktop"
BIN_DIR="$DESKTOP_DIR/bin"

PLATFORM="${1:-$(uname -s)}"

echo "==> Building Go engine..."
mkdir -p "$BIN_DIR"

build_engine() {
  local goos="$1" goarch="$2" suffix="${3:-}"
  echo "    $goos/$goarch"
  GOOS="$goos" GOARCH="$goarch" go build \
    -C "$ENGINE_DIR" \
    -ldflags="-s -w" \
    -o "$BIN_DIR/jamo-engine${suffix}" \
    ./cmd/jamo-engine
}

case "$PLATFORM" in
  mac|Darwin)
    build_engine darwin arm64
    ;;
  linux|Linux)
    build_engine linux amd64
    ;;
  all)
    build_engine darwin arm64 "-darwin-arm64"
    build_engine darwin amd64 "-darwin-x64"
    build_engine linux amd64 "-linux-x64"
    build_engine linux arm64 "-linux-arm64"
    ;;
  *)
    echo "Unknown platform: $PLATFORM (use mac, linux, or all)"
    exit 1
    ;;
esac

echo "==> Building Electron app..."
cd "$DESKTOP_DIR"
pnpm run build

echo "==> Packaging with electron-builder..."
case "$PLATFORM" in
  mac|Darwin)
    npx electron-builder --mac
    ;;
  linux|Linux)
    npx electron-builder --linux
    ;;
  all)
    npx electron-builder --mac --linux
    ;;
esac

echo "==> Done. Output in apps/desktop/out/"
