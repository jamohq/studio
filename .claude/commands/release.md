# Release a new version

Merge dev into main and cut a release with a version bump.

## Input
$ARGUMENTS must be `patch`, `minor`, `major`, or a specific semver like `1.2.3`.

## Steps

1. **Validate input.** $ARGUMENTS must be provided and must be one of: `patch`, `minor`, `major`, or a valid semver string (X.Y.Z). If missing or invalid, stop and show usage.

2. **Verify clean state.** Run `git status --porcelain`. Must show no changes.

3. **Fetch latest.** Run `git fetch origin`.

4. **Check for unreleased changes.** Run `git log origin/main..origin/dev --oneline`. If empty, warn that there are no new changes to release and ask if they want to proceed anyway.

5. **Run the full test suite on dev:**
   - `git checkout dev && git pull origin dev`
   - `cd engine && go test -race -count=1 ./... && go vet ./...`
   - `cd apps/desktop && npx tsc --noEmit && pnpm test`
   - If tests fail, stop immediately. Do not release.

6. **Create a release PR from dev to main.** Ask the user which approach:
   - **Option A (recommended):** Create a PR from dev -> main via `gh pr create --base main --head dev --title "Release vX.Y.Z"`. Tell the user to merge it on GitHub, then come back and run `/release` again.
   - **Option B (solo dev):** Merge locally: `git checkout main && git pull origin main && git merge dev && git push origin main`

7. **After main has dev merged:** Run `bash scripts/release.sh $ARGUMENTS` from the repo root. This bumps the version in package.json, creates the git tag, and pushes to trigger the release workflow.

8. **Report** the release tag and link: https://github.com/jamohq/studio/actions
