"use client";

import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";

export const hederaTestnetChain = {
  id: 296,
  name: "Hedera Testnet",
  network: "hedera-testnet",
  nativeCurrency: {
    name: "HBAR",
    symbol: "HBAR",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://testnet.hashio.io/api"],
    },
    public: {
      http: ["https://testnet.hashio.io/api"],
    },
  },
  blockExplorers: {
    default: {
      name: "HashScan",
      url: "https://hashscan.io/testnet",
    },
  },
  testnet: true,
};

interface PrivyClientProviderProps {
  children: React.ReactNode;
}

export function PrivyClientProvider({ children }: PrivyClientProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmtylfyow02uy0ckt6u8i12qt";

  // Fallback if no appId provided (safe build-time rendering)
  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#10b981", // Emerald-500 matching SwarmProof brand
          showWalletLoginFirst: false,
          walletList: [
            "metamask",
            "detected_wallets",
            "coinbase_wallet",
            "rainbow",
            "rabby_wallet",
          ],
        },
        loginMethods: ["email", "wallet", "google", "github"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: hederaTestnetChain,
        supportedChains: [hederaTestnetChain],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
