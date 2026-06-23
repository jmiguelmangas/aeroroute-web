.PHONY: bootstrap format lint typecheck test build check
bootstrap:
	pnpm install --frozen-lockfile
format:
	pnpm format
lint:
	pnpm lint
typecheck:
	pnpm typecheck
test:
	pnpm test
build:
	pnpm build
check:
	pnpm check
