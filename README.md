# aeroroute-web

React user experience for synthetic trajectory comparisons. It renders generated
API client data and must never reproduce backend scoring or access databases.

> AeroRoute MLX is an educational trajectory-efficiency simulator. Results are
> approximate, may use incomplete public data, and are not suitable for
> operational flight planning or safety-critical decisions.

## Component library

The AeroRoute component library lives in `src/components`. It shares the same
design tokens and CSS as the product, so Storybook examples represent the real
application rather than a parallel theme.

```sh
pnpm storybook
```

Storybook runs at `http://localhost:6006`. Use `pnpm build-storybook` for a
static build and `pnpm check` to verify the application and component catalog.
