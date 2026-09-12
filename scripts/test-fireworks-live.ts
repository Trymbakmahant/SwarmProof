import dotenv from "dotenv";
dotenv.config();

import { FireworksProvider, createSpecialistAgents } from "../packages/agents/src/index.js";

async function main() {
  const apiKey = process.env.FIREWORKS_API_KEY?.trim();
  const model = process.env.FIREWORKS_MODEL || "accounts/fireworks/models/deepseek-v4p1-flash";

  console.log("🔥 [Fireworks AI Live Agent Test]");
  console.log(`   Model: ${model}`);
  console.log(`   API Key present: ${Boolean(apiKey)} (${apiKey?.slice(0, 7)}...)\n`);

  if (!apiKey) {
    console.error("❌ FIREWORKS_API_KEY is not set in environment!");
    process.exit(1);
  }

  // 1. Initialize Fireworks Provider
  const provider = new FireworksProvider({ apiKey, model });
  console.log(`✅ Initialized provider: ${provider.name}`);

  // 2. Initialize Specialist Agents with Fireworks AI provider
  const agents = createSpecialistAgents({ llmProvider: provider });
  const reentrancyAgent = agents["reentrancy-agent"];
  console.log(`🤖 Specialist Agent: ${reentrancyAgent.identity.name}`);
  console.log(`   Agent Capabilities: ${reentrancyAgent.identity.capabilities.join(", ")}\n`);

  // 3. Test contract with critical reentrancy vulnerability
  const vulnerableContract = {
    contractName: "EtherVault",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EtherVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // Vulnerable function: External call before zeroing balance (CEI violation)
    function withdraw() external {
        uint256 balance = balances[msg.sender];
        require(balance > 0, "Zero balance");

        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0;
    }
}`,
    network: "ethereum",
  };

  console.log(`🚀 Sending audit task to Fireworks AI for smart contract "${vulnerableContract.contractName}"...`);
  const startTime = Date.now();
  const findings = await reentrancyAgent.analyze(vulnerableContract);
  const elapsedMs = Date.now() - startTime;

  console.log(`\n🎉 Fireworks AI response received in ${elapsedMs}ms!`);
  console.log(`📊 Number of Findings: ${findings.length}\n`);

  for (const [idx, finding] of findings.entries()) {
    console.log(`Finding #${idx + 1}:`);
    console.log(`   ID: ${finding.id}`);
    console.log(`   Title: ${finding.title}`);
    console.log(`   Severity: ${finding.severity.toUpperCase()}`);
    console.log(`   Location: ${finding.location}`);
    console.log(`   Evidence: ${finding.evidence.join("; ")}`);
  }

  console.log("\n✅ Live agent call to Fireworks AI completed successfully!");
}

main().catch((err) => {
  console.error("❌ Live agent call error:", err);
  process.exit(1);
});
