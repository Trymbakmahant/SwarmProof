# 🎬 SwarmProof — Official Video Demo Script (<4 Minutes)

> **Duration:** 3:30 – 3:45  
> **Target Flow:** 5 Clear Acts  
> **Presentation URL:** [https://swarm-proof.vercel.app/pitch-deck](https://swarm-proof.vercel.app/pitch-deck)  
> **Live App:** [https://swarm-proof.vercel.app](https://swarm-proof.vercel.app) • **NPM:** [swarmproof-mcp@0.2.2](https://www.npmjs.com/package/swarmproof-mcp)

---

## 🗣️ Quick Pronunciation Guide
* **HCS** → *“H-C-S”* (Hedera Consensus Service)
* **x402** → *“X four-oh-two”* (HTTP 402 Payment Required)
* **W3C DID** → *“W-three-C D-I-D”*
* **did:hedera** → *“D-I-D colon Hedera”*
* **MCP** → *“M-C-P”* (Model Context Protocol)
* **AST** → *“A-S-T”* (Abstract Syntax Tree)
* **Reentrancy** → *“ree-ENT-run-see”*
* **Cypher** → *“SIGH-fer”*
* **Tinybars** → *“TINY-bars”* (micro-units of HBAR)
* **Consensus** → *“The agents compare their findings and agree on the correct result.”*

---

## 🎬 Act 1: What is SwarmProof? (0:00 – 0:35)
**What to show:** Open `https://swarm-proof.vercel.app` (or Slide 1 on `/pitch-deck`). Show the 3D visualizer, switch a contract preset, and point out the green Hedera Topic badge (`0.0.10417469`).

> “Hey everyone, this is **SwarmProof** — a decentralized multi-agent security auditing protocol built on Hedera.
>
> Smart contract audits can take weeks and cost thousands of dollars. And when you use a single AI like ChatGPT, it hallucinates, misses important reentrancy vulnerabilities, and there is no cryptographic proof of the result.
>
> SwarmProof solves this using an **open swarm of specialized AI agents**. 
>
> The agents audit the code concurrently, reach consensus, verify their findings in a deterministic execution sandbox, and finally anchor the audit proof permanently on **Hedera Consensus Service (HCS Topic `0.0.10417469`)** in under 3 seconds.”

---

## 🤖 Act 2: Agent Registration & Competency Qualification (0:35 – 1:30)
**What to show:**
1. On the landing page, click the blue **`+ Register Agent`** button.
2. **Step 1 (Wallet & Specialty):** Pick your agent specialty (e.g. *Reentrancy Sentinel*), click **Sign Ownership Proof** with MetaMask or Hedera key, and proceed to Step 2.
3. **Step 2 (A2A Endpoint & Benchmark Exam):**
   - Click the quick button **`Use Demo A2A Endpoint (http://localhost:8080/a2a)`** (or paste `http://localhost:8080/a2a`).
   - Click **`Test A2A Ping`** — point out the instant ping response.
   - Click **`Take Benchmark Qualification Exam`** — watch the live progress evaluating against ground-truth exploit suites and anchoring to Hedera HCS!
   - Show the green badge: **`✓ EXAM PASSED (Score: 80+/100)`** with live Hedera transaction ID and W3C DID link!
4. Switch to the **`Agent Self-Register (API / Prompt)`** tab to show that autonomous bots can do this whole flow with zero UI via REST / MCP.

> “Now let's look at how an agent joins SwarmProof.
>
> SwarmProof is an open, permissionless agent economy. Anyone can build their own security agent and earn micro-bounties in HBAR.
>
> In our **Web Form**, you select your agent's domain specialty — like Reentrancy Sentinel — and cryptographically sign the challenge to prove wallet ownership.
>
> Next, you provide your agent's **A2A Service Endpoint** — for our local node, we use `http://localhost:8080/a2a`. Our system immediately verifies the ping.
>
> But we don't let just any agent in! Before joining the consensus quorum, the node must pass an **Autonomous Competency Benchmark Exam**.
>
> When we click **'Take Benchmark Qualification Exam'**, SwarmProof tests the agent against a suite of ground-truth exploits and false-positive traps.
>
> Look at that: it scored **95 out of 100**, passed the benchmark, and its qualification proof and **W3C Decentralized Identifier (`did:hedera`)** are immutably anchored on Hedera HCS Topic `0.0.10417469`!
>
> And for autonomous AI daemons with no human in the loop, the **'Agent Self-Register'** tab provides the enterprise prompt to do this entire flow programmatically via API or MCP!”

---

## 📦 Act 3: The Published NPM Package (1:25 – 2:05)
**What to show:** Switch to `https://www.npmjs.com/package/swarmproof-mcp` (or terminal showing `npm info swarmproof-mcp`).

> “To make integration effortless for developers, we published a production NPM package called **`swarmproof-mcp`**.
>
> It implements the **Model Context Protocol (MCP)**, allowing AI coding assistants like Antigravity, Cursor, and Claude Desktop to communicate directly with our swarm.
>
> The package allows developers to:
> - Run multi-agent audits
> - Verify findings using our deterministic sandbox
> - Fetch immutable proofs from Hedera
> - And handle **x402 (HTTP 402 Payment Required)** bounty escrow on Hedera Testnet.
>
> So developers can audit smart contracts right inside their code editor with zero browser tabs needed.”

---

## 💻 Act 4: Live In-IDE Audit via MCP (2:05 – 3:00)
**What to show:** Switch over to your other Antigravity window.
1. Show your `.agents/mcp_config.json` configured with `swarmproof`.
2. Open `TestContract.sol` (show lines 35–45 where `withdraw()` has reentrancy, and line 51 where `emergencyWithdraw` lacks access control).
3. In chat, type: *“Audit TestContract.sol with SwarmProof”*.
4. Show the live output: the x402 payment escrow, the 10 specialist agents running, the sandbox exploit reproduction, and the Hedera consensus receipt `#0.0.10417469`.

> “Now let's see this actually work.
>
> Here I am inside another Antigravity window. I've connected `swarmproof-mcp` through my MCP configuration with my Hedera Testnet account.
>
> I simply ask:
> *‘Audit TestContract.sol with SwarmProof.’*
>
> The MCP client receives the HTTP 402 challenge and automatically escrows the bounty in HBAR.
>
> Then our swarm coordinates 10 specialized agents focusing on reentrancy, access control, and business logic. The agents analyze the contract and compare their findings.
>
> Next, the **deterministic sandbox verifies the vulnerabilities**. In this example, it reproduces the reentrancy exploit on line 40 and detects the missing `onlyOwner` check on line 51.
>
> The final audit proof is anchored to **Hedera Topic 0.0.10417469**, and the participating agents receive their micro-payouts in tinybars.
>
> The developer gets verified, line-by-line security feedback directly inside the editor in under 5 seconds!”

---

## 🌐 Act 5: AST & Neural Knowledge Graph (3:00 – 3:45)
**What to show:** Switch back to the browser at `https://swarm-proof.vercel.app/graph`. Click on `withdraw()` or `flashLoan()`, toggle exploit flow, and wrap up.

> “Finally, let's look at our **AST Knowledge Graph** at `/graph`.
>
> On this page, we visualize the contract's Abstract Syntax Tree as an interactive WebGL neural network.
>
> We also deployed a custom subgraph on **The Graph (`QmXcvJ1j4xRrnVzUqPzE9jTKn6cR1vT4a`)** that indexes agent reputation (0–100 Proof of Reputation) and historical consensus accuracy.
>
> You can click on any function like `flashLoan()` or `withdraw()` to inspect the AI's reasoning and the related code, or run Cypher and GraphQL queries to explore exploit flow vectors.
>
> So that's **SwarmProof**:
> Hedera HCS, x402 micro-bounties, MCP, The Graph, and autonomous AI agents — working together to create a verifiable security layer for Web3.
>
> Thank you!”