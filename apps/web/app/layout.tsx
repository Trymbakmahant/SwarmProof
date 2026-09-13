import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwarmProof | Autonomous Consensus & Verification in the Multi-Agent Era",
  description:
    "Decentralized smart-contract auditing powered by a sovereign AI agent swarm, mathematically validated through concurrent AST graph reasoning and immutably anchored on Hedera Consensus Service.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

import { PrivyClientProvider } from "./providers/PrivyClientProvider";
import { WalletProvider } from "./context/WalletContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com"></script>
        <script
          id="tailwind-config"
          dangerouslySetInnerHTML={{
            __html: `tailwind.config = { darkMode: "class", theme: { extend: { colors: { "on-error": "#ffffff", "on-secondary-container": "#00732a", "surface-container-highest": "#e4e2e4", "surface-container-lowest": "#ffffff", "error-container": "#ffdad6", "surface-tint": "#005cbb", "surface-dim": "#dcd9dc", "on-primary": "#ffffff", "on-secondary-fixed-variant": "#00531c", "tertiary-container": "#737378", "background": "#fcf8fb", "secondary-fixed-dim": "#53e16f", "on-primary-fixed-variant": "#00458f", "secondary-fixed": "#72fe88", "secondary-container": "#6ffb85", "secondary": "#006e28", "surface-variant": "#e4e2e4", "on-tertiary-container": "#fcfaff", "tertiary-fixed": "#e3e2e7", "on-tertiary-fixed": "#1a1b1f", "tertiary": "#5a5b5f", "tertiary-fixed-dim": "#c7c6cb", "on-secondary-fixed": "#002107", "on-surface-variant": "#414753", "error": "#ba1a1a", "surface-container": "#f0edef", "primary-container": "#0071e3", "on-secondary": "#ffffff", "primary": "#0059b5", "outline-variant": "#c1c6d6", "on-primary-container": "#fcfbff", "on-primary-fixed": "#001b3f", "primary-fixed": "#d7e2ff", "on-surface": "#1b1b1d", "primary-fixed-dim": "#abc7ff", "surface-container-low": "#f6f3f5", "inverse-primary": "#abc7ff", "on-error-container": "#93000a", "on-tertiary-fixed-variant": "#46464b", "outline": "#717785", "inverse-on-surface": "#f3f0f2", "inverse-surface": "#303032", "on-tertiary": "#ffffff", "surface-container-high": "#eae7ea", "surface": "#fcf8fb", "surface-bright": "#fcf8fb", "on-background": "#1b1b1d" }, borderRadius: { "DEFAULT": "1rem", "lg": "2rem", "xl": "3rem", "full": "9999px" }, spacing: { "margin-mobile": "1.25rem", "space-sm": "0.5rem", "space-md": "1rem", "space-lg": "1.5rem", "gutter": "1.5rem", "margin": "3rem", "gutter-mobile": "1rem", "space-xl": "2.5rem", "space-xs": "0.25rem" }, fontFamily: { "label-sm": ["Manrope"], "body-sm": ["Manrope"], "headline-md": ["Manrope"], "body-lg": ["Manrope"], "label-md": ["Manrope"], "headline-lg-mobile": ["Manrope"], "headline-sm": ["Manrope"], "body-md": ["Manrope"], "title-md": ["Manrope"], "display": ["Manrope"], "display-mobile": ["Manrope"], "title-lg": ["Manrope"], "headline-lg": ["Manrope"] }, fontSize: { "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "600" }], "body-sm": ["13px", { lineHeight: "18px", letterSpacing: "0.005em", fontWeight: "400" }], "headline-md": ["28px", { lineHeight: "36px", letterSpacing: "-0.015em", fontWeight: "600" }], "body-lg": ["17px", { lineHeight: "26px", letterSpacing: "-0.005em", fontWeight: "400" }], "label-md": ["13px", { lineHeight: "18px", letterSpacing: "0.01em", fontWeight: "500" }], "headline-lg-mobile": ["32px", { lineHeight: "40px", letterSpacing: "-0.015em", fontWeight: "600" }], "headline-sm": ["22px", { lineHeight: "30px", letterSpacing: "-0.01em", fontWeight: "600" }], "body-md": ["15px", { lineHeight: "22px", letterSpacing: "0em", fontWeight: "400" }], "title-md": ["17px", { lineHeight: "24px", letterSpacing: "0em", fontWeight: "600" }], "display": ["56px", { lineHeight: "64px", letterSpacing: "-0.03em", fontWeight: "700" }], "display-mobile": ["40px", { lineHeight: "48px", letterSpacing: "-0.025em", fontWeight: "700" }], "title-lg": ["19px", { lineHeight: "26px", letterSpacing: "-0.005em", fontWeight: "600" }], "headline-lg": ["40px", { lineHeight: "48px", letterSpacing: "-0.02em", fontWeight: "600" }] } } } };`,
          }}
        />
      </head>
      <body className="bg-surface text-on-surface selection:bg-secondary-container selection:text-on-secondary-container">
        <PrivyClientProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </PrivyClientProvider>
      </body>
    </html>
  );
}