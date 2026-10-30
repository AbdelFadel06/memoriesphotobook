// Copies ../shared/layouts (single source of truth) into the app before dev/build/test.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.SHARED_LAYOUTS_DIR ?? join(root, "..", "shared", "layouts");
const target = join(root, "generated", "layouts");

if (!existsSync(source)) {
  console.error(`shared layouts not found at ${source}`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
