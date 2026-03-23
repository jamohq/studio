# Start a new branch

Create a new feature, bugfix, or hotfix branch following the project branching strategy.

## Input
$ARGUMENTS should be a branch name like `feat/my-feature`, `bugfix/fix-crash`, or `hotfix/urgent-patch`.

## Steps

1. **Validate the branch name.** $ARGUMENTS must start with `feat/`, `bugfix/`, or `hotfix/`. If not, stop and tell the user the valid prefixes. The part after the prefix must be lowercase-kebab-case (letters, numbers, hyphens only).

2. **Determine the base branch:**
   - If the prefix is `hotfix/`, the base branch is `main`
   - Otherwise (`feat/` or `bugfix/`), the base branch is `dev`

3. **Check for clean working tree.** Run `git status --porcelain`. If there are uncommitted changes, warn the user and ask if they want to stash them first.

4. **Fetch latest from origin.** Run `git fetch origin`.

5. **Create the branch from the base.** Run:
   - `git checkout <base-branch>`
   - `git pull origin <base-branch>`
   - `git checkout -b $ARGUMENTS`

6. **Confirm** the branch was created and tell the user what to do next.

Do NOT push the branch yet — that happens on first commit or PR creation.
