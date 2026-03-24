.PHONY: run test

run:
	pnpm dev

test:
	cd engine && go test -race -count=1 ./... && go vet ./... && cd ../apps/desktop && npx tsc --noEmit && pnpm test
