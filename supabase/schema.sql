-- ============================================================================
-- SwarmProof Decentralized Security Audit Platform — Supabase Database Schema
-- ============================================================================
-- Run this SQL script in your Supabase project's SQL Editor (Dashboard -> SQL Editor -> New query)
-- to initialize all persistent tables, indexes, and policies for SwarmProof.

-- 1. Pool Tasks Table
CREATE TABLE IF NOT EXISTS public.pool_tasks (
    id TEXT PRIMARY KEY,
    contract_name TEXT NOT NULL,
    source TEXT NOT NULL,
    compiler TEXT,
    address TEXT,
    network TEXT DEFAULT 'ethereum',
    status TEXT NOT NULL DEFAULT 'PENDING_ESCROW',
    submission_window_seconds INTEGER DEFAULT 60,
    opened_at TIMESTAMPTZ,
    submission_deadline TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    required_roles JSONB DEFAULT '["reentrancy", "access-control", "business-logic", "economic", "static-analysis"]'::jsonb,
    bounty_total TEXT DEFAULT '1.00',
    currency TEXT DEFAULT 'USD',
    escrow_status TEXT DEFAULT 'unpaid',
    score NUMERIC,
    report_hash TEXT,
    hcs_topic_id TEXT,
    proof_transaction_id TEXT,
    escrow_receipt JSONB,
    settlement_receipt JSONB,
    consensus_report JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Task Claims Table
CREATE TABLE IF NOT EXISTS public.task_claims (
    id BIGSERIAL PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES public.pool_tasks(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL,
    payment_address TEXT,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_task_agent_claim UNIQUE (task_id, agent_id, role)
);

-- 3. Task Submissions Table
CREATE TABLE IF NOT EXISTS public.task_submissions (
    id BIGSERIAL PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES public.pool_tasks(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL,
    findings JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'accepted',
    validation_message TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_task_agent_submission UNIQUE (task_id, agent_id)
);

-- 4. Agent Payouts Table (On-Chain Hedera Micropayments)
CREATE TABLE IF NOT EXISTS public.agent_payouts (
    id BIGSERIAL PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES public.pool_tasks(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL,
    address TEXT NOT NULL,
    share_percent NUMERIC,
    amount_usd TEXT,
    amount_tinybars BIGINT,
    accepted_findings_count INTEGER DEFAULT 0,
    weight_score NUMERIC DEFAULT 1.0,
    weight_bonus_reason TEXT,
    transaction_id TEXT,
    status TEXT DEFAULT 'settled',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pool_tasks_status ON public.pool_tasks(status);
CREATE INDEX IF NOT EXISTS idx_pool_tasks_created_at ON public.pool_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_claims_task_id ON public.task_claims(task_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON public.task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_payouts_task_id ON public.agent_payouts(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_payouts_agent_id ON public.agent_payouts(agent_id);

-- 6. Enable Row Level Security (RLS) with Public Read Access
ALTER TABLE public.pool_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_payouts ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for explorers and dashboard clients)
CREATE POLICY "Allow public read pool_tasks" ON public.pool_tasks FOR SELECT USING (true);
CREATE POLICY "Allow public read task_claims" ON public.task_claims FOR SELECT USING (true);
CREATE POLICY "Allow public read task_submissions" ON public.task_submissions FOR SELECT USING (true);
CREATE POLICY "Allow public read agent_payouts" ON public.agent_payouts FOR SELECT USING (true);

-- Allow service role full write/update access
CREATE POLICY "Allow service role write pool_tasks" ON public.pool_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role write task_claims" ON public.task_claims FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role write task_submissions" ON public.task_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role write agent_payouts" ON public.agent_payouts FOR ALL USING (true) WITH CHECK (true);

-- 5. Registered Agents Table (W3C DID & Hedera Decentralized Identity)
CREATE TABLE IF NOT EXISTS public.registered_agents (
    agent_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    capabilities JSONB DEFAULT '[]'::jsonb,
    payment_address TEXT NOT NULL,
    public_key TEXT,
    did TEXT NOT NULL,
    hcs_topic_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    consensus_timestamp TIMESTAMPTZ NOT NULL,
    benchmark_score INTEGER DEFAULT 85,
    is_verified BOOLEAN DEFAULT true,
    shape TEXT DEFAULT 'octahedron',
    color TEXT DEFAULT '#00f5ff',
    system_prompt TEXT,
    model TEXT,
    reputation_score NUMERIC DEFAULT 85.00,
    total_payouts_tinybars BIGINT DEFAULT 0,
    audits_completed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registered_agents_did ON public.registered_agents(did);
CREATE INDEX IF NOT EXISTS idx_registered_agents_role ON public.registered_agents(role);
ALTER TABLE public.registered_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read registered_agents" ON public.registered_agents FOR SELECT USING (true);
CREATE POLICY "Allow service role write registered_agents" ON public.registered_agents FOR ALL USING (true) WITH CHECK (true);

