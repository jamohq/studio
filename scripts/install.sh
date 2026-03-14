#!/usr/bin/env bash
set -euo pipefail

# Jamo Studio installer
# Usage: curl -fsSL https://jamohq.com/install.sh | sh

REPO="jamohq/studio"
INSTALL_DIR="/usr/local/bin"
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
    *)      error "Unsupported OS: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)             error "Unsupported architecture: $arch" ;;
  esac
}

get_latest_version() {
  VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"tag_name"' | head -1 | sed 's/.*"v\(.*\)".*/\1/')"
  [ -n "$VERSION" ] || error "Could not determine latest version. Check https://github.com/$REPO/releases"
}

install_mac() {
  local artifact="Jamo-Studio-${VERSION}-${ARCH}-mac.zip"
  local url="https://github.com/$REPO/releases/download/v${VERSION}/${artifact}"
  local tmp="$(mktemp -d)"

  info "Downloading $artifact..."
  curl -fSL "$url" -o "$tmp/$artifact" || error "Download failed. Check if v${VERSION} has a release for $ARCH."

  info "Installing to $APP_DIR..."
  unzip -qo "$tmp/$artifact" -d "$tmp"

  # Move .app to Applications
  local app="$(find "$tmp" -name '*.app' -maxdepth 2 | head -1)"
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
  local artifact="Jamo-Studio-${VERSION}-${ARCH}.AppImage"
  local url="https://github.com/$REPO/releases/download/v${VERSION}/${artifact}"

  info "Downloading $artifact..."
  sudo curl -fSL "$url" -o "$INSTALL_DIR/jamo-studio" || error "Download failed."
  sudo chmod +x "$INSTALL_DIR/jamo-studio"
  info "Installed to $INSTALL_DIR/jamo-studio"
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
