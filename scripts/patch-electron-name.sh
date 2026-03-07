#!/bin/bash
# Patches the Electron.app plist so the macOS menu bar shows "Jamo Studio" in dev mode.
PLIST=$(find "$(dirname "$0")/../node_modules" -path "*/electron/dist/Electron.app/Contents/Info.plist" 2>/dev/null | head -1)
if [ -n "$PLIST" ]; then
  /usr/libexec/PlistBuddy -c "Set CFBundleName 'Jamo Studio'" "$PLIST" 2>/dev/null
  /usr/libexec/PlistBuddy -c "Set CFBundleDisplayName 'Jamo Studio'" "$PLIST" 2>/dev/null
  echo "Patched Electron.app → Jamo Studio"
fi
