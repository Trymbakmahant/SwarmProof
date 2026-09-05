import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwarmProof",
  description:
    "Decentralized smart-contract auditing powered by an AI agent swarm, anchored on Hedera.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}