import dotenv from "dotenv";
dotenv.config();

import { FireworksProvider, createSpecialistAgents } from "../packages/agents/src/index.js";

async function fetchCode4renaProblem(repo: string, filePath: string) {
  const url = `https://raw.githubusercontent.com/code-423n4/${repo}/main/${filePath}`;
  console.log(`📡 Fetching real contest problem from Code4rena: ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch from Code4rena (${res.status} ${res.statusText})`);
  }
  const source = await res.text();
  return {
    source,
    lines: source.split("\n").length,
    bytes: Buffer.byteLength(source, "utf-8"),
    url,
  };
}

async function main() {
  console.log("🏆 [SwarmProof - Code4rena Problem Puller & Swarm Audit]");

  // 1. Target Code4rena contest and contract
  const contest = "2024-10-loopfi";
  const contractPath = "src/Flashlender.sol";
  const contractName = "Flashlender";

  console.log(`Contest: code-423n4/${contest}`);
  console.log(`Contract: ${contractPath}`);

  const problem = await fetchCode4renaProblem(contest, contractPath);
  console.log(`✅ Successfully pulled from Code4rena! (${problem.lines} lines, ${problem.bytes} bytes)\n`);

  // Preview first 15 lines of pulled code
  console.log("--- Pulled Code Preview ---");
  console.log(problem.source.split("\n").slice(0, 15).join("\n"));
  console.log("---------------------------\n");

  // 2. Initialize Fireworks AI Provider
  const apiKey = process.env.FIREWORKS_API_KEY?.trim();
  const model = process.env.FIREWORKS_MODEL || "accounts/fireworks/models/deepseek-v4p1-flash";

  if (!apiKey) {
    console.warn("⚠️ No FIREWORKS_API_KEY set, aborting live LLM audit run.");
    return;
  }

  const provider = new FireworksProvider({ apiKey, model });
  const agents = createSpecialistAgents({ llmProvider: provider });

  console.log(`🤖 Dispatching dual-specialist swarm (Fireworks AI: ${model}) to audit Code4rena contract...`);
  const startTime = Date.now();

  // Run two specialist agents in parallel on the pulled Code4rena contract:
  // - Access Control Specialist
  // - Logic / Invariant Specialist
  const [accessFindings, logicFindings] = await Promise.all([
    agents["access-control-agent"].analyze({
      contractName,
      source: problem.source,
      network: "ethereum",
    }),
    agents["business-logic-agent"].analyze({
      contractName,
      source: problem.source,
      network: "ethereum",
    }),
  ]);

  const elapsedMs = Date.now() - startTime;
  console.log(`\n🎉 Swarm audit of Code4rena contract completed in ${elapsedMs}ms!`);
  console.log(`🔐 Access Control findings: ${accessFindings.length}`);
  for (const f of accessFindings) {
    console.log(`   - [${f.severity.toUpperCase()}] ${f.title} (${f.location})`);
  }

  console.log(`⚖️ Business Logic findings: ${logicFindings.length}`);
  for (const f of logicFindings) {
    console.log(`   - [${f.severity.toUpperCase()}] ${f.title} (${f.location})`);
  }
}

main().catch((err) => {
  console.error("❌ Error running Code4rena audit:", err);
  process.exit(1);
});
