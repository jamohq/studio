# Hotfix workflow

Complete guided workflow for emergency production fixes.

## Input
$ARGUMENTS is the hotfix name (without the `hotfix/` prefix), e.g., `fix-critical-crash`.

## Steps

1. **Validate input.** $ARGUMENTS must be provided and must be lowercase-kebab-case. If missing, ask the user for a name.

2. **Create the hotfix branch from main:**
   - `git fetch origin`
   - `git checkout main && git pull origin main`
   - `git checkout -b hotfix/$ARGUMENTS`

3. **Tell the user** they are now on the hotfix branch and should make their fix. Suggest:
   - Make the minimal change needed to fix the issue
   - When ready, run `/commit` to test and commit
   - Then run `/pr` to create a PR targeting main

4. **Remind about dual-merge.** After the hotfix PR merges to main, the fix must also get into dev. Options:
   - Run `/sync` from dev to merge main into dev
   - Or cherry-pick the specific commit(s) onto dev
   - This prevents the fix from being lost when dev next merges to main
