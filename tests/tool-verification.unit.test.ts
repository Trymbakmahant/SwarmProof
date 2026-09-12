import { describe, it, expect } from "vitest";
import {
  createVerifier,
  generatePocContract,
  MockVerifier,
  ToolVerifier,
  resolveBinary,
  verifyFindings,
} from "@swarmproof/verification";

describe("ToolVerifier and PoC Generation Suite", () => {
  it("resolves binaries on host or gracefully returns null", () => {
    const forge = resolveBinary("forge");
    const solc = resolveBinary("solc");
    const fake = resolveBinary("non_existent_binary_xyz");

    expect(fake).toBeNull();
    // Host has forge and solc installed
    if (forge) {
      expect(typeof forge).toBe("string");
      expect(forge).toContain("forge");
    }
    if (solc) {
      expect(typeof solc).toBe("string");
      expect(solc).toContain("solc");
    }
  });

  it("generates reentrancy PoC contract with attack harness", () => {
    const poc = generatePocContract({
      contractName: "EtherStore",
      contractSource: "contract EtherStore { function withdraw() public {} }",
      category: "reentrancy",
      title: "Cross-function reentrancy vulnerability",
    });

    expect(poc).toContain("contract ReentrancyExploit");
    expect(poc).toContain("function test_exploit() public");
    expect(poc).toContain("EtherStore public target;");
    expect(poc).toContain("attacker.attack{value: 1 ether}();");
  });

  it("generates access control PoC contract with unauthorized caller assertions", () => {
    const poc = generatePocContract({
      contractName: "VaultManager",
      contractSource: "contract VaultManager { function setOwner(address) public {} }",
      category: "access-control",
      title: "Missing onlyOwner modifier on sensitive state changer",
    });

    expect(poc).toContain("contract ExploitTest");
    expect(poc).toContain("address public attacker = address(0xDEADBEEF);");
    expect(poc).toContain("function test_exploit() public");
  });

  it("executes MockVerifier synchronously and correctly identifies vulnerability keywords", async () => {
    const mock = new MockVerifier();
    const res = await mock.verify({
      findingId: "f-1",
      tool: "mock",
      contractPath: "src/Vault.sol",
      findingTitle: "Reentrancy balance drain in withdraw()",
      findingCategory: "reentrancy",
    });

    expect(res.reproduced).toBe(true);
    expect(res.tool).toBe("mock");
    expect(res.outputExcerpt).toContain("VULNERABILITY REPRODUCED");
  });

  it("ToolVerifier verifies real findings using live forge/solc or falls back gracefully", async () => {
    const toolVerifier = new ToolVerifier();
    expect(toolVerifier.name).toBe("tool");

    const isAvailable = toolVerifier.isAvailable();
    expect(typeof isAvailable).toBe("boolean");

    const result = await toolVerifier.verify({
      findingId: "f-reentrancy",
      tool: "auto",
      contractPath: "src/ReentrancyVault.sol",
      contractName: "ReentrancyVault",
      contractSource: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ReentrancyVault {
    mapping(address => uint256) public balances;
    function deposit() public payable { balances[msg.sender] += msg.value; }
    function withdraw() public {
        uint256 bal = balances[msg.sender];
        require(bal > 0);
        (bool s, ) = msg.sender.call{value: bal}("");
        require(s);
        balances[msg.sender] = 0;
    }
}
`,
      findingTitle: "Reentrancy state drain before balance reset",
      findingCategory: "reentrancy",
      severity: "critical",
      timeoutMs: 15000,
    });

    expect(result.findingId).toBe("f-reentrancy");
    expect(result.reproduced).toBe(true);
    expect(result.outputExcerpt).toBeDefined();
    expect(["foundry-poc", "solc-ast", "simulation"]).toContain(result.method);
  }, 20000);

  it("verifyFindings runs batch verification against task findings", async () => {
    const verifier = createVerifier("auto");
    const results = await verifyFindings({
      findings: [
        {
          id: "find-1",
          title: "Reentrancy in withdraw()",
          category: "reentrancy",
          severity: "high",
          location: "contracts/Vault.sol:L25",
        },
      ],
      task: {
        contractName: "Vault",
        source: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract Vault {}`,
      },
      engine: verifier,
      tool: "auto",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.findingId).toBe("find-1");
    expect(results[0]?.reproduced).toBe(true);
  }, 20000);
});
