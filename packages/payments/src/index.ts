import type { Severity } from "@swarmproof/agents";
import type { HederaClient, TokenTransfer } from "@swarmproof/hedera";

export interface Bounty {
  id: string;
  contractName: string;
  tokenId: string;
  payer: string;
  createdAt: string;
  status: "escrowed" | "paid" | "refunded";
}

export interface PayoutSchedule {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export const DEFAULT_SCHEDULE: PayoutSchedule = {
  critical: 5000,
  high: 2000,
  medium: 500,
  low: 100,
  info: 0,
};

export interface PaymentLedger {
  createBounty(b: Omit<Bounty, "status" | "createdAt">): Promise<Bounty>;
  escrow(bountyId: string, amount: number): Promise<TokenTransfer>;
  payout(bountyId: string, to: string, severity: Severity): Promise<TokenTransfer>;
  getBounty(bountyId: string): Promise<Bounty | undefined>;
}

/** In-memory ledger with a Hedera-backed adapter (M5). */
export class MemoryLedger implements PaymentLedger {
  private readonly bounties = new Map<string, Bounty>();

  constructor(
    private readonly hedera: HederaClient,
    private readonly schedule: PayoutSchedule = DEFAULT_SCHEDULE,
  ) {}

  async createBounty(b: Omit<Bounty, "status" | "createdAt">): Promise<Bounty> {
    const bounty: Bounty = { ...b, status: "escrowed", createdAt: new Date().toISOString() };
    this.bounties.set(b.id, bounty);
    return bounty;
  }

  async escrow(bountyId: string, amount: number): Promise<TokenTransfer> {
    const b = this.require(bountyId);
    return this.hedera.escrow(b.tokenId, `escrow-${b.id}`, amount);
  }

  async payout(bountyId: string, to: string, severity: Severity): Promise<TokenTransfer> {
    const b = this.require(bountyId);
    const amount = this.schedule[severity] ?? 0;
    const transfer = await this.hedera.payout(b.tokenId, `escrow-${b.id}`, to, amount);
    this.bounties.set(bountyId, { ...b, status: "paid" });
    return transfer;
  }

  async getBounty(bountyId: string): Promise<Bounty | undefined> {
    return this.bounties.get(bountyId);
  }

  private require(bountyId: string): Bounty {
    const b = this.bounties.get(bountyId);
    if (!b) throw new Error(`bounty not found: ${bountyId}`);
    return b;
  }
}