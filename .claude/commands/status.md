# Project status

Show a comprehensive overview of the current development state.

## Steps

1. **Current branch.** Run `git branch --show-current`.

2. **Working tree status.** Run `git status --short`. Summarize: number of modified, staged, untracked files.

3. **Branch relationship to base.** Determine the base branch (dev for feat/bugfix, main for hotfix/dev):
   - Commits ahead: `git log origin/<base>..HEAD --oneline`
   - Commits behind: `git log HEAD..origin/<base> --oneline`

4. **Recent commits on this branch.** `git log --oneline -10`

5. **Open PRs.** Run `gh pr list --state open` to show any open pull requests.

6. **CI status.** Run `gh run list --limit 5` to show recent workflow runs.

7. **Dev vs main delta.** Run `git log origin/main..origin/dev --oneline` to show commits pending release.

8. **Present** a clear, concise summary of everything above. Highlight anything that needs attention (e.g., branch is behind base, failing CI, uncommitted changes).
