import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config(); // fallback to current dir if any

const env = process.env;
const app = createApp({ env });

// Only bind a port when run directly (`node dist/index.js` / `tsx src/index.ts`);
// importing the package (tests, tools) must not start a server.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(env.PORT ?? 3001);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`@swarmproof/api listening on http://localhost:${info.port}`);
    console.log(`  payment provider : ${env.X402_FACILITATOR_URL ? "x402" : "mock (offline)"}${env.X402_FACILITATOR_URL ? ` @ ${env.X402_FACILITATOR_URL}` : " — set X402_FACILITATOR_URL to go live"}`);
    console.log(`  hedera HCS       : ${env.HEDERA_ACCOUNT_ID && env.HEDERA_PRIVATE_KEY && env.HEDERA_TOPIC_ID ? `hedera @ ${env.HEDERA_TOPIC_ID}` : "offline mock"}`);
    console.log(`  network          : ${env.PAYMENT_NETWORK ?? "hedera:testnet"}`);
    console.log(`  try: curl -i -X POST http://localhost:${info.port}/audit -H 'content-type: application/json' -d '{"contractName":"V","source":"contract V {}"}'`);
  });
} else {
  console.log("@swarmproof/api: imported as a library — not starting the HTTP server.");
}