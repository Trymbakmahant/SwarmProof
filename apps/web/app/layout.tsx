import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwarmProof | Autonomous Consensus & Verification in the Multi-Agent Era",
  description:
    "Decentralized smart-contract auditing powered by a sovereign AI agent swarm, mathematically validated through concurrent AST graph reasoning and immutably anchored on Hedera Consensus Service.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700&family=Noto+Serif:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com"></script>
        <script
          id="tailwind-config"
          dangerouslySetInnerHTML={{
            __html: `tailwind.config={darkMode:"class",theme:{extend:{colors:{"surface-container-highest":"#e3e1ec","primary-fixed-dim":"#c8c6c8","tertiary-fixed":"#63f7ff","surface-tint":"#5f5e60","surface-container-lowest":"#ffffff","inverse-primary":"#c8c6c8","surface":"#fbf8ff","surface-bright":"#fbf8ff","outline":"#78767b","on-error":"#ffffff","on-secondary-container":"#00714d","primary-fixed":"#e5e1e4","on-primary-fixed":"#1c1b1d","secondary-fixed":"#6ffbbe","surface-container":"#eeedf7","surface-container-high":"#e8e7f1","inverse-on-surface":"#f1effa","on-surface-variant":"#47464a","tertiary-container":"#002021","on-tertiary-fixed":"#002021","primary-container":"#1c1b1d","on-secondary-fixed":"#002113","on-surface":"#1a1b22","secondary-fixed-dim":"#4edea3","primary":"#000000","outline-variant":"#c8c5ca","surface-dim":"#dad9e3","on-tertiary-container":"#009299","secondary":"#006c49","on-error-container":"#93000a","on-primary-fixed-variant":"#474649","surface-variant":"#e3e1ec","background":"#fbf8ff","on-secondary":"#ffffff","tertiary":"#000000","secondary-container":"#6cf8bb","on-tertiary":"#ffffff","on-secondary-fixed-variant":"#005236","inverse-surface":"#2f3038","error":"#ba1a1a","surface-container-low":"#f4f2fd","on-primary-container":"#858386","on-tertiary-fixed-variant":"#004f53","error-container":"#ffdad6","on-background":"#1a1b22","on-primary":"#ffffff","tertiary-fixed-dim":"#00dce5"},borderRadius:{"DEFAULT":"0.125rem","lg":"0.25rem","xl":"0.5rem","full":"0.75rem"},spacing:{"space-md":"1rem","gutter":"1.5rem","space-sm":"0.5rem","gutter-mobile":"1rem","space-xl":"3rem","margin-mobile":"1.25rem","space-xs":"0.25rem","margin":"3rem","space-lg":"1.75rem"},fontFamily:{"code-md":["JetBrains Mono","monospace"],"body-sm":["Manrope","sans-serif"],"display-xl-mobile":["Noto Serif","serif"],"display-lg-mobile":["Noto Serif","serif"],"headline-md":["Noto Serif","serif"],"body-md":["Manrope","sans-serif"],"body-lg":["Manrope","sans-serif"],"code-sm":["JetBrains Mono","monospace"],"label-caps":["JetBrains Mono","monospace"],"headline-sm":["Noto Serif","serif"],"display-xl":["Noto Serif","serif"],"display-lg":["Noto Serif","serif"]},fontSize:{"code-md":["13px",{lineHeight:"20px",fontWeight:"400"}],"body-sm":["13px",{lineHeight:"20px",fontWeight:"400"}],"display-xl-mobile":["36px",{lineHeight:"44px",letterSpacing:"-0.02em",fontWeight:"400"}],"display-lg-mobile":["28px",{lineHeight:"36px",letterSpacing:"-0.015em",fontWeight:"400"}],"headline-md":["26px",{lineHeight:"34px",letterSpacing:"-0.015em",fontWeight:"500"}],"body-md":["15px",{lineHeight:"24px",fontWeight:"400"}],"body-lg":["17px",{lineHeight:"28px",fontWeight:"400"}],"code-sm":["11px",{lineHeight:"16px",fontWeight:"500"}],"label-caps":["11px",{lineHeight:"16px",letterSpacing:"0.08em",fontWeight:"600"}],"headline-sm":["20px",{lineHeight:"28px",fontWeight:"500"}],"display-xl":["56px",{lineHeight:"64px",letterSpacing:"-0.03em",fontWeight:"400"}],"display-lg":["40px",{lineHeight:"48px",letterSpacing:"-0.025em",fontWeight:"400"}]}}}};`,
          }}
        />
      </head>
      <body className="bg-surface text-on-surface selection:bg-secondary-container selection:text-on-secondary-container">
        {children}
      </body>
    </html>
  );
}