#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/release.sh [patch|minor|major|<version>]
# Examples:
#   ./scripts/release.sh patch    # 0.1.1 → 0.1.2
#   ./scripts/release.sh minor    # 0.1.2 → 0.2.0
#   ./scripts/release.sh major    # 0.2.0 → 1.0.0
#   ./scripts/release.sh 1.2.3    # → 1.2.3

BUMP="${1:-}"
if [ -z "$BUMP" ]; then
  echo "Usage: ./scripts/release.sh [patch|minor|major|<version>]"
  exit 1
fi

# Ensure we're on main and up to date
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "Error: must be on main branch (currently on $BRANCH)"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree is dirty — commit or stash changes first"
  exit 1
fi

git pull origin main

# Read current version
PKG="apps/desktop/package.json"
CURRENT=$(node -p "require('./$PKG').version")
echo "Current version: $CURRENT"

# Calculate new version
if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW="$BUMP"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
  case "$BUMP" in
    patch) PATCH=$((PATCH + 1)) ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    *) echo "Error: invalid bump type '$BUMP' (use patch, minor, major, or x.y.z)"; exit 1 ;;
  esac
  NEW="$MAJOR.$MINOR.$PATCH"
fi

TAG="v$NEW"
echo "New version: $NEW ($TAG)"

# Check tag doesn't already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag $TAG already exists"
  exit 1
fi

# Update version in package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
pkg.version = '$NEW';
fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
"

echo "Updated $PKG to $NEW"

# Commit, tag, push
git add "$PKG"
git commit -m "Release $TAG"
git tag "$TAG"

echo ""
echo "Pushing commit and tag..."
git push origin main
git push origin "$TAG"

echo ""
echo "Released $TAG"
echo "Release workflow: https://github.com/jamohq/studio/actions"
