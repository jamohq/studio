# Sync current branch

Rebase the current branch onto its upstream base to stay up to date.

## Steps

1. **Identify current branch and base.** Run `git branch --show-current`.
   - If `hotfix/*`, base is `main`
   - If `feat/*` or `bugfix/*`, base is `dev`
   - If on `dev`, base is `main` (sync dev with latest main)
   - If on `main`, just pull latest: `git pull origin main` and stop

2. **Check for uncommitted changes.** Run `git status --porcelain`. If dirty, warn the user and ask them to commit or stash first. Do not proceed with uncommitted changes.

3. **Fetch latest.** Run `git fetch origin`.

4. **Rebase onto base.** Run `git rebase origin/<base>`.

5. **Handle conflicts.** If the rebase produces conflicts:
   - Show the conflicting files with `git diff --name-only --diff-filter=U`
   - Tell the user to resolve conflicts manually
   - Provide the commands: `git rebase --continue` (after resolving) or `git rebase --abort` (to cancel)
   - Do NOT attempt to auto-resolve conflicts

6. **Confirm** the branch is now up to date with the base.
