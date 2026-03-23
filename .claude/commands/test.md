# Run tests

Run the project test suite locally. Optionally filter by scope.

## Input
$ARGUMENTS is optional. Can be: `go`, `frontend`, `all`, or empty (defaults to `all`).

## Steps

1. **Determine scope.** If $ARGUMENTS is empty or `all`, run everything. If `go`, run only Go tests. If `frontend`, run only frontend tests.

2. **Run Go tests** (if in scope):
   - `cd engine && go test -race -count=1 ./...`
   - `cd engine && go vet ./...`
   - Report results clearly. If tests fail, show the failures and stop.

3. **Run frontend tests** (if in scope):
   - `cd apps/desktop && npx tsc --noEmit`
   - `cd apps/desktop && pnpm test`
   - Report results clearly. If any step fails, show the failure and stop.

4. **Summary.** Report pass/fail for each suite that ran. If everything passes, confirm the code is ready to commit.
