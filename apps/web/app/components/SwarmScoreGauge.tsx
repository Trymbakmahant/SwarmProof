"use client";

import React, { useMemo } from "react";
import { calculateContractSwarmScore, type SwarmScoreResult } from "./swarmScore";

interface SwarmScoreGaugeProps {
  findings?: Array<{ category: string; severity: string; id?: string; title?: string }>;
  verified?: boolean;
  contractName?: string;
  showFactors?: boolean;
  compact?: boolean;
}

export function SwarmScoreGauge({
  findings = [],
  verified = true,
  contractName = "Contract",
  showFactors = true,
  compact = false,
}: SwarmScoreGaugeProps) {
  const scoreResult: SwarmScoreResult = useMemo(
    () => calculateContractSwarmScore({ findings, verified }),
    [findings, verified]
  );

  // SVG Gauge calculations
  // Gauge is a 220-degree arc from 160 deg to 380 deg (-20 deg to 200 deg)
  const radius = compact ? 70 : 90;
  const strokeWidth = compact ? 12 : 16;
  const center = compact ? 85 : 110;
  const circumference = 2 * Math.PI * radius;
  // We use a semi-circle or 220 degree arc
  const arcLength = circumference * (220 / 360);
  // Normalized score 0..1 from 0..100
  const normalizedScore = Math.max(0, Math.min(1, scoreResult.score / 100));
  const strokeDashoffset = arcLength * (1 - normalizedScore);

  // Needle angle: from -110 deg (at 0) to +110 deg (at 100)
  const needleAngle = -110 + normalizedScore * 220;

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: `1px solid ${scoreResult.borderColor}`,
        borderRadius: 12,
        padding: compact ? 14 : 20,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif)",
      }}
    >
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                padding: "2px 8px",
                borderRadius: 4,
                backgroundColor: scoreResult.bgLight,
                color: scoreResult.color,
                border: `1px solid ${scoreResult.borderColor}`,
              }}
            >
              Swarm Security Score
            </span>
            <span style={{ fontSize: 11, color: "#71717a", fontFamily: "var(--font-mono, monospace)" }}>
              0 – 100 Reputation Index
            </span>
          </div>
          <h3 style={{ margin: "6px 0 2px 0", fontSize: compact ? 15 : 17, fontWeight: 700, color: "#09090b" }}>
            {contractName} Security Rating
          </h3>
        </div>

        <div
          style={{
            padding: "4px 12px",
            borderRadius: 8,
            backgroundColor: scoreResult.bgLight,
            border: `1.5px solid ${scoreResult.borderColor}`,
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: "#71717a", textTransform: "uppercase" }}>Grade</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: scoreResult.color, fontFamily: "var(--font-mono, monospace)" }}>
            {scoreResult.grade}
          </div>
        </div>
      </div>

      {/* Speedometer Gauge Visual */}
      <div style={{ display: "flex", flexDirection: compact ? "column" : "row", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", width: center * 2, height: center * 1.5, display: "flex", justifyContent: "center" }}>
          <svg width={center * 2} height={center * 1.6} viewBox={`0 0 ${center * 2} ${center * 1.6}`}>
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="40%" stopColor="#f59e0b" />
                <stop offset="70%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {/* Background Track Arc */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#e4e4e7"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(160 ${center} ${center})`}
            />

            {/* Active Score Arc */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(160 ${center} ${center})`}
              style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
            />

            {/* Tick Marks */}
            <text x={center - radius + 5} y={center + 25} fontSize="9" fill="#a1a1aa" fontFamily="var(--font-mono)">0</text>
            <text x={center} y={center - radius - 6} fontSize="9" fill="#a1a1aa" textAnchor="middle" fontFamily="var(--font-mono)">50</text>
            <text x={center + radius - 5} y={center + 25} fontSize="9" fill="#a1a1aa" textAnchor="end" fontFamily="var(--font-mono)">100</text>
          </svg>

          {/* Center Digital Display */}
          <div
            style={{
              position: "absolute",
              top: center * 0.45,
              left: 0,
              right: 0,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: compact ? 32 : 40,
                fontWeight: 800,
                color: scoreResult.color,
                lineHeight: 1,
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: -1,
              }}
            >
              {scoreResult.score}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#71717a", marginTop: 4 }}>
              / 100 Score
            </span>
            <span
              style={{
                marginTop: 6,
                fontSize: 11,
                fontWeight: 700,
                color: scoreResult.color,
                padding: "2px 8px",
                borderRadius: 999,
                backgroundColor: scoreResult.bgLight,
                border: `1px solid ${scoreResult.borderColor}`,
              }}
            >
              {scoreResult.label}
            </span>
          </div>
        </div>

        {/* Narrative & Percentile */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "#3f3f46",
              backgroundColor: "#fafafa",
              border: "1px solid #f4f4f5",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 12,
            }}
          >
            <strong style={{ color: "#18181b" }}>Auditor Verdict: </strong>
            {scoreResult.summary}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "#f4f4f5", border: "1px solid #e4e4e7" }}>
              <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 600 }}>Security Percentile</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#18181b", fontFamily: "var(--font-mono)" }}>
                Top {100 - scoreResult.percentile}%
              </div>
            </div>
            <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "#f4f4f5", border: "1px solid #e4e4e7" }}>
              <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 600 }}>Quorum Corroboration</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#18181b", fontFamily: "var(--font-mono)" }}>
                5/5 Agents Synced
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Factor Breakdown (Reputation Scoring Factors) */}
      {showFactors && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f4f4f5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#18181b", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Score Factor Impact Breakdown
            </h4>
            <span style={{ fontSize: 11, color: "#71717a" }}>How points are allocated</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scoreResult.factors.map((factor, idx) => {
              const isViolated = factor.status === "VIOLATED";
              const isWarned = factor.status === "WARNED";
              const badgeColor = isViolated ? "#dc2626" : isWarned ? "#d97706" : "#10b981";
              const badgeBg = isViolated ? "#fef2f2" : isWarned ? "#fffbeb" : "#ecfdf5";
              const pointsText = factor.points > 0 ? `+${factor.points}` : `${factor.points}`;

              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 8,
                    backgroundColor: isViolated ? "#fef2f2" : "#fafafa",
                    border: `1px solid ${isViolated ? "#fecaca" : "#f4f4f5"}`,
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: badgeColor,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#18181b" }}>{factor.name}</div>
                      <div style={{ fontSize: 11, color: "#71717a" }}>{factor.description}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        backgroundColor: badgeBg,
                        color: badgeColor,
                      }}
                    >
                      {factor.status}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: factor.points > 0 ? "#10b981" : "#dc2626",
                        minWidth: 42,
                      }}
                    >
                      {pointsText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
