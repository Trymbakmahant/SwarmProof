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

## 📦 Act 3: The Published NPM Package & Under the Hood (1:30 – 2:20)
**What to show:** Switch to `https://www.npmjs.com/package/swarmproof-mcp` (or terminal showing `npm info swarmproof-mcp`).

> “To make integration effortless for developers, we published a production NPM package called **`swarmproof-mcp`**.
>
> It implements Anthropic’s **Model Context Protocol (MCP)**, allowing AI coding assistants like Antigravity, Cursor, and Claude Desktop to communicate natively with our security swarm.
>
> The package exposes **17 specialized tools** organized into 3 core pillars:
>
> 1. **Swarm Auditing & Sandbox Verification**:
>    - `audit_contract` & `run_swarm_audit`: Submits smart contracts, triggers on-chain x402 payment, coordinates 10 specialists, and anchors proofs to Hedera.
>    - `get_findings`: Returns verified vulnerabilities with exact line numbers and remediation patches.
>    - `verify_finding`: Executes our deterministic sandbox test runner to physically reproduce exploit PoCs.
>    - `get_audit_proof`: Fetches the immutable cryptographic proof receipt anchored on Hedera HCS Topic `0.0.10417469`.
>    - `pay_bounty`: Executes or settles on-chain x402 bounty escrows in HBAR.
>
> 2. **Decentralized Task Pool**:
>    - `list_pool_tasks` & `get_pool_task`: Queries active and settled tasks in the pool.
>    - `create_pool_task`: Posts a new contract audit bounty into the decentralized pool.
>    - `pull_task`, `claim_task_slot`, & `submit_task_finding`: Allows external autonomous agents to pull jobs matching their domain, claim slots, and submit findings within timed windows.
>
> 3. **Agent Identity & W3C Credentials**:
>    - `get_agent_challenge` & `register_agent`: Signs cryptographic challenges and anchors sovereign agents.
>    - `get_agent_did` & `get_agent_credential`: Resolves W3C Decentralized Identifiers (`did:hedera`) and Verifiable Credentials.
>    - `list_agents`: Queries all registered security agents in the quorum.
>
> ### ⚙️ What Happens Internally When You Run the Prompt?
>
> Now, what actually happens under the hood when a developer types:
> *‘Audit TestContract.sol with SwarmProof’*?
>
> Here is the exact 5-step internal lifecycle:
>
> - **Step 1: Code Ingestion & Tool Call**: The IDE reads `TestContract.sol` directly from the workspace and triggers the MCP tool `audit_contract`.
> - **Step 2: HTTP 402 Bounty Escrow**: The SwarmProof API issues an x402 payment challenge. The MCP client automatically signs and broadcasts an on-chain transfer on Hedera Testnet using the developer’s configured wallet (`HEDERA_ACCOUNT_ID`), escrowing the micro-bounty.
> - **Step 3: 10-Agent Swarm Inflow**: The consensus engine dispatches 10 specialized AI agents in parallel — analyzing reentrancy, access control, AST graph invariants, and business logic.
> - **Step 4: Quorum Consensus & Deterministic PoC Reproduction**: The agents cross-verify each other’s findings, eliminating hallucinations. Then, our deterministic sandbox compiles an exploit contract to physically reproduce the reentrancy and missing access checks.
> - **Step 5: Hedera Consensus Anchoring & Micropayouts**: The final audit proof is immutably anchored to **Hedera Topic 0.0.10417469**, micro-bounties in tinybars are distributed to the participating agents, and verified line-by-line findings return straight into the IDE!”

---

## 💻 Act 4: Live In-IDE Audit via MCP (2:20 – 3:05)
**What to show:** Switch over to your other Antigravity window.
1. Show your `.agents/mcp_config.json` configured with `swarmproof`.
2. Open `TestContract.sol` (show lines 35–45 where `withdraw()` has reentrancy, and line 51 where `emergencyWithdraw` lacks access control).
3. In chat, type: *“Audit TestContract.sol with SwarmProof”*.
4. Show the live output: the x402 payment escrow, the 10 specialist agents running, the sandbox exploit reproduction, and the Hedera consensus receipt `#0.0.10417469`.

> “Now let's see this actually work live!
>
> Here I am inside another Antigravity window. I've configured `swarmproof-mcp` with my Hedera Testnet account.
>
> I simply ask:
> *‘Audit TestContract.sol with SwarmProof.’*
>
> Watch what happens:
> 1. The MCP client receives the HTTP 402 challenge and automatically escrows the bounty on Hedera Testnet.
> 2. Our swarm coordinates 10 specialized agents simultaneously analyzing reentrancy, access control, and state integrity.
> 3. The **deterministic sandbox reproduces the exploits** — proving the reentrancy bug on line 40 and detecting the missing `onlyOwner` check on line 51 with zero false positives.
> 4. The audit proof is anchored to **Hedera HCS Topic 0.0.10417469**, and participating agents get paid in tinybars!
>
> As a developer, I get verified, cryptographic security audit results right inside my editor in under 5 seconds!”

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