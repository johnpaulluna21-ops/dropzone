/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TaxPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTin, setNewTin] = useState("");
  const [newCredit, setNewCredit] = useState("");
  const [creditYear, setCreditYear] = useState(new Date().getFullYear().toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients(data || []);
  };

  const addClient = async () => {
    if (!newName.trim()) return alert("Name is required");
    const { data, error } = await supabase.from("clients").insert({ name: newName.trim(), tin: newTin.trim() || null }).select().single();
    if (error) return alert("Error adding client: " + error.message);
    if (newCredit && data) {
      await supabase.from("prior_year_credits").insert({ client_id: data.id, year: parseInt(creditYear), excess_credit: parseFloat(newCredit) || 0 });
    }
    setNewName(""); setNewTin(""); setNewCredit(""); setShowAddClient(false);
    fetchClients();
  };

  const computeSummary = async (client: any) => {
    setSelected(client);
    setLoading(true);
    try {
      // Fetch all 2307s for this client by TIN match
      const { data: uploads } = await supabase
        .from("uploads")
        .select("*")
        .eq("status", "extracted");

      const forms2307 = (uploads || []).filter(u => {
        const data = parseData(u.extracted_data);
        return data?.payee_tin?.replace(/\D/g, "").includes(client.tin?.replace(/\D/g, "") || "NOMATCH") ||
               data?.payee_name?.toLowerCase().includes(client.name.toLowerCase());
      });

      // Fetch prior year credits
      const { data: credits } = await supabase
        .from("prior_year_credits")
        .select("*")
        .eq("client_id", client.id)
        .eq("year", parseInt(year) - 1);
      const priorCredit = credits?.reduce((sum: number, c: any) => sum + (c.excess_credit || 0), 0) || 0;

      // Fetch tax payments
      const { data: payments } = await supabase
        .from("tax_payments")
        .select("*")
        .eq("client_id", client.id)
        .eq("year", parseInt(year));

      // Group 2307s by quarter
      const quarters: any = { Q1: [], Q2: [], Q3: [], Q4: [] };
      forms2307.forEach(u => {
        const data = parseData(u.extracted_data);
        const period = data?.period_to || data?.period_from || "";
        const month = parseInt(period.split("/")[0]) || 0;
        if (month >= 1 && month <= 3) quarters.Q1.push(data);
        else if (month >= 4 && month <= 6) quarters.Q2.push(data);
        else if (month >= 7 && month <= 9) quarters.Q3.push(data);
        else if (month >= 10 && month <= 12) quarters.Q4.push(data);
      });

      // Compute per quarter
      let cumulativeIncome = 0;
      let cumulativeCWT = 0;
      let previousPaid = 0;
      const qSummaries = [];

      for (const [q, forms] of Object.entries(quarters) as any) {
        const qIncome = forms.reduce((sum: number, f: any) => sum + (parseFloat(f?.total_income) || 0), 0);
        const qCWT = forms.reduce((sum: number, f: any) => sum + (parseFloat(f?.total_tax_withheld) || 0), 0);
        cumulativeIncome += qIncome;
        cumulativeCWT += qCWT;
        const taxDue = cumulativeIncome * 0.08;
        const qPayment = payments?.find((p: any) => p.quarter === parseInt(q.replace("Q", "")))?.amount_paid || 0;
        const balanceDue = taxDue - cumulativeCWT - previousPaid - (q === "Q1" ? priorCredit : 0);
        qSummaries.push({
          quarter: q,
          forms: forms.length,
          quarterlyIncome: qIncome,
          cumulativeIncome,
          cumulativeCWT,
          taxDue,
          previousPaid,
          priorCredit: q === "Q1" ? priorCredit : 0,
          balanceDue: Math.max(0, balanceDue),
          overpayment: balanceDue < 0 ? Math.abs(balanceDue) : 0,
          paid: qPayment,
        });
        previousPaid += qPayment;
      }

      setSummary({ client, quarters: qSummaries, totalForms: forms2307.length, priorCredit });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const parseData = (data: any) => {
    try {
      let parsed = data;
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed;
    } catch { return data; }
  };

  const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #0f0f0f; }
        input, select { outline: none; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <main style={{ minHeight: "100vh", background: "#0f0f0f", backgroundImage: "radial-gradient(circle at top left, rgba(99,102,241,0.08) 0%, transparent 40%)", padding: "2rem 1.5rem", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>

          {/* Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
            <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <i className="ti ti-calculator" style={{ color: "#fff", fontSize: 18 }} />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>Tax Summary Engine</h1>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>8% Income Tax — BIR Compliance</p>
            </div>
            <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none" }}>
              <i className="ti ti-arrow-left" style={{ fontSize: 14 }} /> Back to Dashboard
            </Link>
          </div>

          {/* Year selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
            <label style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Tax Year:</label>
            <select value={year} onChange={e => setYear(e.target.value)} style={{ padding: "8px 12px", background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>

            {/* Clients Panel */}
            <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Clients ({clients.length})</p>
                <button onClick={() => setShowAddClient(!showAddClient)} style={{ padding: "5px 10px", background: "rgba(99,102,241,0.2)", border: "0.5px solid rgba(99,102,241,0.35)", borderRadius: 8, color: "#a5b4fc", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  + Add
                </button>
              </div>

              {showAddClient && (
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", background: "rgba(99,102,241,0.04)" }}>
                  <input placeholder="Full name *" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                  <input placeholder="TIN (e.g. 123-456-789)" value={newTin} onChange={e => setNewTin(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                  <input placeholder="Prior year excess credit (₱)" value={newCredit} onChange={e => setNewCredit(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                  <input placeholder="Credit from year (e.g. 2024)" value={creditYear} onChange={e => setCreditYear(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                  <button onClick={addClient} style={{ width: "100%", padding: "8px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Save Client
                  </button>
                </div>
              )}

              <div style={{ flex: 1, overflowY: "auto" }}>
                {clients.length === 0 ? (
                  <p style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>No clients yet. Add one above.</p>
                ) : clients.map(client => (
                  <div key={client.id} onClick={() => computeSummary(client)} style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.05)", cursor: "pointer", background: selected?.id === client.id ? "rgba(99,102,241,0.1)" : "transparent", transition: "background 0.15s" }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{client.name}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{client.tin || "No TIN"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Panel */}
            <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "1.5rem" }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                  <i className="ti ti-loader-2" style={{ fontSize: 20, marginRight: 8 }} /> Computing summary...
                </div>
              ) : summary ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>{summary.client.name}</h2>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>TIN: {summary.client.tin || "N/A"} · {summary.totalForms} 2307s found · Tax Year {year}</p>
                    </div>
                    {summary.priorCredit > 0 && (
                      <div style={{ padding: "6px 12px", background: "rgba(16,185,129,0.1)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 10 }}>
                        <p style={{ fontSize: 11, color: "#6ee7b7" }}>Prior Year Credit: {fmt(summary.priorCredit)}</p>
                      </div>
                    )}
                  </div>

                  {/* Quarter Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: "1.5rem" }}>
                    {summary.quarters.map((q: any) => (
                      <div key={q.quarter} style={{ padding: "16px", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{q.quarter} {year}</p>
                          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: q.forms > 0 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", color: q.forms > 0 ? "#6ee7b7" : "rgba(255,255,255,0.3)", border: `0.5px solid ${q.forms > 0 ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}` }}>
                            {q.forms} 2307{q.forms !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Quarterly Income</span>
                            <span style={{ fontSize: 12, color: "#fff" }}>{fmt(q.quarterlyIncome)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Cumulative Income</span>
                            <span style={{ fontSize: 12, color: "#fff" }}>{fmt(q.cumulativeIncome)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Tax Due (8%)</span>
                            <span style={{ fontSize: 12, color: "#fff" }}>{fmt(q.taxDue)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Less: CWT (2307s)</span>
                            <span style={{ fontSize: 12, color: "#6ee7b7" }}>({fmt(q.cumulativeCWT)})</span>
                          </div>
                          {q.priorCredit > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Less: Prior Year Credit</span>
                              <span style={{ fontSize: 12, color: "#6ee7b7" }}>({fmt(q.priorCredit)})</span>
                            </div>
                          )}
                          {q.previousPaid > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Less: Prev Qtrs Paid</span>
                              <span style={{ fontSize: 12, color: "#6ee7b7" }}>({fmt(q.previousPaid)})</span>
                            </div>
                          )}
                          <div style={{ height: "0.5px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: q.balanceDue > 0 ? "#fcd34d" : "#6ee7b7" }}>
                              {q.balanceDue > 0 ? "Balance Due" : "Overpayment"}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: q.balanceDue > 0 ? "#fcd34d" : "#6ee7b7" }}>
                              {q.balanceDue > 0 ? fmt(q.balanceDue) : fmt(q.overpayment)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Annual Summary */}
                  <div style={{ padding: "16px", background: "rgba(99,102,241,0.06)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 14 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Annual Summary {year}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Total Income</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{fmt(summary.quarters[summary.quarters.length - 1]?.cumulativeIncome || 0)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Total CWT</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "#6ee7b7" }}>{fmt(summary.quarters[summary.quarters.length - 1]?.cumulativeCWT || 0)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Annual Tax Due (8%)</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: "#a5b4fc" }}>{fmt((summary.quarters[summary.quarters.length - 1]?.cumulativeIncome || 0) * 0.08)}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
                  <div style={{ width: 52, height: 52, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className="ti ti-calculator" style={{ fontSize: 24, color: "rgba(255,255,255,0.2)" }} />
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Select a client to compute tax summary</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}