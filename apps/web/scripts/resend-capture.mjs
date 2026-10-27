/**
 * Local stand-in for the Resend API, used by the e2e invite tests.
 *
 * Resend honours RESEND_BASE_URL, so pointing the dev server at this process
 * captures outgoing mail instead of delivering it. Without it, the invite
 * test would send a real email, so the test skips itself when this server is
 * not running.
 *
 * Usage:
 *   node scripts/resend-capture.mjs
 *   RESEND_BASE_URL=http://127.0.0.1:3999 bun run dev
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const OUT = process.env.CAPTURE_FILE ?? "/tmp/mail-capture.jsonl";
const PORT = Number(process.env.CAPTURE_PORT ?? 3999);

writeFileSync(OUT, "");

const server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    try {
      const payload = JSON.parse(body);
      // Probe requests are only used to detect that the server is up.
      if (!payload.probe) {
        appendFileSync(OUT, `${JSON.stringify(payload)}\n`);
      }
    } catch {
      // Ignore non-JSON payloads.
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "captured-email-id" }));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Resend capture server listening on http://127.0.0.1:${PORT}`);
  console.log(`Captured mail is written to ${OUT}`);
});
