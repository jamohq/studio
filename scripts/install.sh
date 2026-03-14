#!/usr/bin/env bash
set -euo pipefail

# Jamo Studio installer
# Usage: curl -fsSL https://raw.githubusercontent.com/jamohq/studio/main/scripts/install.sh | sh

REPO="jamohq/studio"
APP_DIR="/Applications"

info() { echo "  $*"; }
error() { echo "Error: $*" >&2; exit 1; }

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) OS="darwin" ;;
    Linux)  OS="linux" ;;
    *)      error "Unsupported OS: $os. For Windows, download from https://github.com/$REPO/releases" ;;
  esac

  case "$arch" in
    x86_64|amd64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)             error "Unsupported architecture: $arch" ;;
  esac
}

get_latest_version() {
  if ! command -v curl >/dev/null 2>&1; then
    error "curl is required but not installed"
  fi

  local response
  response="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null)" \
    || error "No releases found. Check https://github.com/$REPO/releases"

  VERSION="$(echo "$response" | grep '"tag_name"' | head -1 | sed 's/.*"v\(.*\)".*/\1/')"
  [ -n "$VERSION" ] || error "Could not determine latest version"
}

download() {
  local url="$1" dest="$2"
  info "Downloading $(basename "$dest")..."
  curl -fSL --progress-bar "$url" -o "$dest" \
    || error "Download failed: $url"
}

install_mac() {
  local artifact url tmp

  # electron-builder names: "Jamo Studio-VERSION-arm64-mac.zip" or "Jamo Studio-VERSION-mac.zip" (x64)
  if [ "$ARCH" = "arm64" ]; then
    artifact="Jamo Studio-${VERSION}-arm64-mac.zip"
  else
    artifact="Jamo Studio-${VERSION}-mac.zip"
  fi

  url="https://github.com/$REPO/releases/download/v${VERSION}/$(echo "$artifact" | sed 's/ /%20/g')"
  tmp="$(mktemp -d)"

  download "$url" "$tmp/$artifact"

  info "Installing to $APP_DIR..."
  unzip -qo "$tmp/$artifact" -d "$tmp"

  local app
  app="$(find "$tmp" -name '*.app' -maxdepth 2 | head -1)"
  if [ -n "$app" ]; then
    [ -d "$APP_DIR/Jamo Studio.app" ] && rm -rf "$APP_DIR/Jamo Studio.app"
    mv "$app" "$APP_DIR/Jamo Studio.app"
    info "Installed Jamo Studio.app to $APP_DIR"
  else
    error "Could not find .app in archive"
  fi

  rm -rf "$tmp"
}

install_linux() {
  local artifact url install_dir

  # electron-builder names: "Jamo Studio-VERSION-arm64.AppImage" or "Jamo Studio-VERSION.AppImage" (x64)
  if [ "$ARCH" = "arm64" ]; then
    artifact="Jamo Studio-${VERSION}-arm64.AppImage"
  else
    artifact="Jamo Studio-${VERSION}.AppImage"
  fi

  url="https://github.com/$REPO/releases/download/v${VERSION}/$(echo "$artifact" | sed 's/ /%20/g')"

  install_dir="${HOME}/.local/bin"
  mkdir -p "$install_dir"

  download "$url" "$install_dir/jamo-studio"
  chmod +x "$install_dir/jamo-studio"
  info "Installed to $install_dir/jamo-studio"

  # Check if ~/.local/bin is in PATH
  case ":$PATH:" in
    *":$install_dir:"*) ;;
    *) info "Add $install_dir to your PATH if it's not already there" ;;
  esac
}

main() {
  echo ""
  echo "  Jamo Studio Installer"
  echo ""

  detect_platform
  info "Platform: $OS/$ARCH"

  get_latest_version
  info "Version:  v$VERSION"
  echo ""

  case "$OS" in
    darwin) install_mac ;;
    linux)  install_linux ;;
  esac

  echo ""
  info "Done! Launch Jamo Studio from your applications."
  echo ""
}

main
