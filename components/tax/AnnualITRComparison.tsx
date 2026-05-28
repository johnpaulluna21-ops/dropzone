// components/tax/AnnualITRComparison.tsx
// Layer: UI Layer
// Problem: replaces "No prior year ITR on file" placeholder with real year-over-year comparison

"use client"

import { useEffect, useState } from "react"
import { fetchAnnualITR } from "@/services/tax/fetchAnnualITR"
import type { AnnualITRRecord } from "@/core/schemas/annual-itr"

interface Props {
  client_id: string
  current_year: number
}

function formatPeso(value: number): string {
  const formatted = Math.abs(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return value < 0 ? `(P${formatted})` : `P${formatted}`
}

function DeltaBadge({ current, prior }: { current: number; prior: number }) {
  if (prior === 0) return null
  const delta = ((current - prior) / Math.abs(prior)) * 100
  const isUp = delta > 0
  const color = isUp ? "#ef4444" : "#22c55e"
  const arrow = isUp ? "▲" : "▼"
  return (
    <span style={{ fontSize: "11px", color, marginLeft: "8px" }}>
      {arrow} {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

interface ComparisonRowProps {
  label: string
  current: number
  prior: number | null
  highlight?: boolean
}

function ComparisonRow({ label, current, prior, highlight }: ComparisonRowProps) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "2fr 1fr 1fr",
      padding: "10px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: highlight ? "rgba(255,255,255,0.03)" : "transparent",
      alignItems: "center",
    }}>
      <span style={{ fontSize: "13px", color: "#9ca3af" }}>{label}</span>
      <span style={{
        fontSize: "13px",
        color: current < 0 ? "#f87171" : "#e5e7eb",
        textAlign: "right",
      }}>
        {formatPeso(current)}
        {prior !== null && (
          <DeltaBadge current={current} prior={prior} />
        )}
      </span>
      <span style={{
        fontSize: "13px",
        color: prior === null ? "#4b5563" : prior < 0 ? "#f87171" : "#9ca3af",
        textAlign: "right",
      }}>
        {prior === null ? "—" : formatPeso(prior)}
      </span>
    </div>
  )
}

export default function AnnualITRComparison({ client_id, current_year }: Props) {
  const [current, setCurrent] = useState<AnnualITRRecord | null>(null)
  const [prior, setPrior] = useState<AnnualITRRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [currentData, priorData] = await Promise.all([
        fetchAnnualITR(client_id, current_year),
        fetchAnnualITR(client_id, current_year - 1),
      ])
      setCurrent(currentData)
      setPrior(priorData)
      setLoading(false)
    }
    load()
  }, [client_id, current_year])

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "#6b7280", fontSize: "13px" }}>
        Loading ITR comparison...
      </div>
    )
  }

  if (!current) {
    return (
      <div style={{ padding: "16px", color: "#6b7280", fontSize: "13px" }}>
        No {current_year} 1701A on file. Upload the annual ITR to enable year-over-year comparison.
      </div>
    )
  }

  return (
    <div style={{
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.08)",
      marginTop: "12px",
    }}>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr",
        padding: "10px 16px",
        background: "rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <span style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>
          FILED 1701A
        </span>
        <span style={{ fontSize: "12px", color: "#6b7280", textAlign: "right", fontWeight: 600 }}>
          {current_year}
        </span>
        <span style={{ fontSize: "12px", color: "#6b7280", textAlign: "right", fontWeight: 600 }}>
          {current_year - 1}
        </span>
      </div>

      <ComparisonRow
        label="Gross Sales/Receipts"
        current={current.gross_sales}
        prior={prior?.gross_sales ?? null}
      />
      <ComparisonRow
        label="Total Taxable Income"
        current={current.total_taxable_income}
        prior={prior?.total_taxable_income ?? null}
        highlight
      />
      <ComparisonRow
        label="Taxable Income/(Loss)"
        current={current.taxable_income_loss}
        prior={prior?.taxable_income_loss ?? null}
      />
      <ComparisonRow
        label="Tax Due"
        current={current.tax_due}
        prior={prior?.tax_due ?? null}
        highlight
      />
      <ComparisonRow
        label="Total Credits/Payments"
        current={current.total_credits}
        prior={prior?.total_credits ?? null}
      />
      <ComparisonRow
        label="Tax Payable/(Overpayment)"
        current={current.tax_payable_overpayment}
        prior={prior?.tax_payable_overpayment ?? null}
        highlight
      />

      {!prior && (
        <div style={{ padding: "10px 16px", fontSize: "12px", color: "#4b5563" }}>
          No {current_year - 1} 1701A on file. Upload prior year AITR to enable comparison.
        </div>
      )}
    </div>
  )
}