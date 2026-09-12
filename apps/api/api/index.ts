import { handle } from "@hono/node-server/vercel";
import { createApp } from "../src/app.js";

const app = createApp({ env: process.env });

export default handle(app);
