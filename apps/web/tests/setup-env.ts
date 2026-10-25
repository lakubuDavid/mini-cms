// Load .env from the apps/web directory for test processes
// The dev server uses Bun's auto-load, but Playwright test processes don't.
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from apps/web first, then fall back to the root
config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../../.env") });

// Make sure ENABLE_TEST_UTILS is on
process.env.ENABLE_TEST_UTILS = "true";
process.env.APP_URL ??= "http://localhost:3000";
process.env.PUBLIC_APP_URL ??= "http://localhost:3000";
