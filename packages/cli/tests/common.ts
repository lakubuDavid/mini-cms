import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createTempDir(prefix = "mini-cli-test-") {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function cleanupTempDir(path: string) {
  await rm(path, { recursive: true, force: true });
}

export function createJsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    ...init,
  });
}
