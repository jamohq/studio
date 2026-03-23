# Create a pull request

Push the current branch and create a GitHub PR targeting the correct base branch.

## Input
$ARGUMENTS is an optional description to include in the PR body.

## Steps

1. **Verify branch.** Run `git branch --show-current`. Must NOT be `main` or `dev`. Must start with `feat/`, `bugfix/`, or `hotfix/`. If not, stop and tell the user.

2. **Determine target branch:**
   - If branch starts with `hotfix/`, target is `main`
   - Otherwise (`feat/` or `bugfix/`), target is `dev`

3. **Run the full test suite:**
   - `cd engine && go test -race -count=1 ./... && go vet ./...`
   - `cd apps/desktop && npx tsc --noEmit && pnpm test`
   - If tests fail, stop and do NOT create the PR. Tell the user to fix issues first.

4. **Check for uncommitted changes.** Run `git status --porcelain`. If there are uncommitted changes, warn the user and suggest they run `/commit` first.

5. **Push the branch.** Run `git push -u origin <current-branch>`.

6. **Gather PR information:**
   - Run `git log <target>..HEAD --oneline` to see all commits on this branch
   - Run `git diff <target>...HEAD --stat` for a summary of file changes
   - Generate a PR title from the branch name (e.g., `feat/add-workspace-panel` becomes `Add workspace panel`)
   - Generate a PR body with:
     - `## Summary` section with bullet points of changes
     - `## Test plan` section with testing notes
     - Include $ARGUMENTS in the description if provided

7. **Create the PR.** Run `gh pr create --base <target> --title "<title>" --body "<body>"` using a heredoc for the body.

8. **Report** the PR URL to the user.

9. **For hotfix branches only:** Remind the user that after the hotfix is merged to main, they should also merge main into dev (or cherry-pick) to keep dev in sync.
