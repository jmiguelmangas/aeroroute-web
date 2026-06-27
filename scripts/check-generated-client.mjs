import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const contract = resolve(
  process.env.AEROROUTE_OPENAPI_PATH ??
    "../aeroroute-contracts/openapi/aeroroute-v1.json"
);
const generated = resolve("src/api/generated/schema.ts");
const candidate = resolve("src/api/generated/schema.check.ts");

try {
  execFileSync(
    "pnpm",
    ["exec", "openapi-typescript", contract, "-o", candidate],
    { stdio: "inherit" }
  );
  execFileSync("pnpm", ["exec", "prettier", "--write", candidate], {
    stdio: "ignore",
  });
  if (readFileSync(candidate, "utf8") !== readFileSync(generated, "utf8")) {
    throw new Error(
      "Generated API client is stale. Run `pnpm generate:api` and commit the result."
    );
  }
  process.stdout.write("Generated API client matches the OpenAPI contract.\n");
} finally {
  rmSync(candidate, { force: true });
}
