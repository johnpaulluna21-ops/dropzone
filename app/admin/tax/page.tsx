/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAGE_SIZE = 10;

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
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editCredit, setEditCredit] = useState("");
  const [editCreditYear, setEditCreditYear] = useState("");
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { fetchClients(); }, []);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

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

  const saveEditClient = async () => {
    if (!editingClient) return;
    if (editCredit) {
      const creditYearInt = parseInt(editCreditYear) || new Date().getFullYear() - 1;
      const { data: existing } = await supabase
        .from("prior_year_credits")
        .select("id")
        .eq("client_id", editingClient.id)
        .eq("year", creditYearInt)
        .single();
      if (existing) {
        await supabase.from("prior_year_credits").update({ excess_credit: parseFloat(editCredit) || 0 }).eq("id", existing.id);
      } else {
        await supabase.from("prior_year_credits").insert({ client_id: editingClient.id, year: creditYearInt, excess_credit: parseFloat(editCredit) || 0 });
      }
    }
    setEditingClient(null);
    setEditCredit("");
    if (selected?.id === editingClient.id) computeSummary(editingClient);
  };

  const computeSummary = async (client: any) => {
    setSelected(client);
    setListOpen(false);
    setLoading(true);
    try {
      const { data: uploads } = await supabase
        .from("uploads")
        .select("*")
        .eq("status", "extracted");

      const forms2307 = (uploads || []).filter(u => {
        const data = parseData(u.extracted_data);
        return data?.payee_tin?.replace(/\D/g, "").includes(client.tin?.replace(/\D/g, "") || "NOMATCH") ||
               data?.payee_name?.toLowerCase().includes(client.name.toLowerCase());
      });

      const { data: credits } = await supabase
        .from("prior_year_credits")
        .select("*")
        .eq("client_id", client.id)
        .eq("year", parseInt(year) - 1);
      const priorCredit = credits?.reduce((sum: number, c: any) => sum + (c.excess_credit || 0), 0) || 0;

      const { data: payments } = await supabase
        .from("tax_payments")
        .select("*")
        .eq("client_id", client.id)
        .eq("year", parseInt(year));

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

      let cumulativeIncome = 0;
      let cumulativeCWT = 0;
      let previousPaid = 0;
      const EXEMPTION = 250000;
      const qSummaries = [];

      for (const [q, forms] of Object.entries(quarters) as any) {
        const qNum = parseInt(q.replace("Q", ""));
        const item47 = forms.reduce((sum: number, f: any) => {
          const val = String(f?.total_income || "0").replace(/,/g, "");
          return sum + (parseFloat(val) || 0);
        }, 0);
        const item49 = item47;
        const item50 = cumulativeIncome;
        const item51 = item49 + item50;
        const item52 = EXEMPTION;
        const item53 = item51 - item52;
        const item54 = Math.max(0, item53 * 0.08);
        const item55 = qNum === 1 ? priorCredit : 0;
        const item56 = previousPaid;
        const item57 = cumulativeCWT;
        const item58 = forms.reduce((sum: number, f: any) => {
          const val = String(f?.total_tax_withheld || "0").replace(/,/g, "");
          return sum + (parseFloat(val) || 0);
        }, 0);
        const item62 = item55 + item56 + item57 + item58;
        const item63 = item54 - item62;
        const qPayment = payments?.find((p: any) => p.quarter === qNum)?.amount_paid || 0;

        qSummaries.push({
          quarter: q, forms: forms.length,
          item47, item49, item50, item51, item52, item53, item54,
          item55, item56, item57, item58, item62, item63,
          paid: qPayment, isOverpayment: item63 < 0,
        });

        cumulativeIncome = item51;
        cumulativeCWT += item58;
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

  const fmt = (n: number) => `₱${Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.tin || "").includes(search)
  );
  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  const pagedClients = filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showList = listOpen || search.length > 0;

  return (
    <>
      <style suppressHydrationWarning>{`
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

          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>

            {/* Clients Panel */}
            <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", alignSelf: "start" }}>

              {/* Header */}
              <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Clients ({clients.length})</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setListOpen(!listOpen); setSearch(""); }} style={{ padding: "5px 10px", background: listOpen ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", border: `0.5px solid ${listOpen ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: listOpen ? "#a5b4fc" : "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    <i className="ti ti-list" style={{ fontSize: 13 }} />
                  </button>
                  <button onClick={() => setShowAddClient(!showAddClient)} style={{ padding: "5px 10px", background: "rgba(99,102,241,0.2)", border: "0.5px solid rgba(99,102,241,0.35)", borderRadius: 8, color: "#a5b4fc", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    + Add
                  </button>
                </div>
              </div>

              {/* Selected client chip */}
              {selected && !showList && (
                <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(99,102,241,0.08)" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#a5b4fc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{selected.tin || "No TIN"}</p>
                  </div>
                  <button onClick={() => setListOpen(true)} style={{ flexShrink: 0, marginLeft: 8, padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                    Change
                  </button>
                </div>
              )}

              {/* Search */}
              <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                <input
                  placeholder="Search name or TIN..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setListOpen(true); }}
                  style={{ width: "100%", padding: "7px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit" }}
                />
              </div>

              {/* Add Client Form */}
              {showAddClient && (
                <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", background: "rgba(99,102,241,0.04)" }}>
                  <input placeholder="Full name *" value={newName} onChange={e => setNewName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                  <input placeholder="TIN (e.g. 123-456-789-0000)" value={newTin} onChange={e => setNewTin(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                  <input placeholder="Prior year excess credit (₱)" value={newCredit} onChange={e => setNewCredit(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                  <input placeholder="Credit from year (e.g. 2025)" value={creditYear} onChange={e => setCreditYear(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                  <button onClick={addClient} style={{ width: "100%", padding: "8px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Save Client
                  </button>
                </div>
              )}

              {/* Client List — only shown when open */}
              {showList && (
                <div>
                  {pagedClients.length === 0 ? (
                    <p style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                      {search ? "No clients match your search." : "No clients yet."}
                    </p>
                  ) : pagedClients.map(client => (
                    <div key={client.id} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                      <div onClick={() => { computeSummary(client); setSearch(""); }} style={{ padding: "11px 16px", cursor: "pointer", background: selected?.id === client.id ? "rgba(99,102,241,0.1)" : "transparent", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</p>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{client.tin || "No TIN"}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setEditingClient(client); setEditCredit(""); setEditCreditYear((new Date().getFullYear() - 1).toString()); }} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginLeft: 8 }}>
                          Edit
                        </button>
                      </div>
                      {editingClient?.id === client.id && (
                        <div style={{ padding: "12px 16px", background: "rgba(99,102,241,0.04)", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Prior Year Excess Credit</p>
                          <input placeholder="Amount (₱)" value={editCredit} onChange={e => setEditCredit(e.target.value)} style={{ width: "100%", padding: "7px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8, outline: "none" }} />
                          <input placeholder="From year (e.g. 2025)" value={editCreditYear} onChange={e => setEditCreditYear(e.target.value)} style={{ width: "100%", padding: "7px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8, outline: "none" }} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={saveEditClient} style={{ flex: 1, padding: "7px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                            <button onClick={() => setEditingClient(null)} style={{ padding: "7px 12px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: page === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: page === 1 ? "default" : "pointer", fontFamily: "inherit" }}>
                        ‹ Prev
                      </button>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{page} / {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: page === totalPages ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: page === totalPages ? "default" : "pointer", fontFamily: "inherit" }}>
                        Next ›
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Summary Panel */}
            <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "1.5rem", overflowY: "auto" }}>
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
                        <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.5px", marginBottom: 6, textTransform: "uppercase" }}>Schedule II — Income</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>47 · Quarterly Income</span>
                            <span style={{ fontSize: 11, color: "#fff" }}>{fmt(q.item47)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>50 · Add: Prev Quarters</span>
                            <span style={{ fontSize: 11, color: "#fff" }}>{fmt(q.item50)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>51 · Cumulative Income</span>
                            <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{fmt(q.item51)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>52 · Less: ₱250,000</span>
                            <span style={{ fontSize: 11, color: "#6ee7b7" }}>({fmt(q.item52)})</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>53 · Taxable Income</span>
                            <span style={{ fontSize: 11, color: q.item53 < 0 ? "#fca5a5" : "#fff" }}>{q.item53 < 0 ? `(${fmt(q.item53)})` : fmt(q.item53)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>54 · Tax Due (8%)</span>
                            <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{fmt(q.item54)}</span>
                          </div>
                        </div>
                        <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.5px", marginBottom: 6, textTransform: "uppercase" }}>Schedule III — Credits</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                          {q.item55 > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>55 · Prior Year Credits</span>
                              <span style={{ fontSize: 11, color: "#6ee7b7" }}>({fmt(q.item55)})</span>
                            </div>
                          )}
                          {q.item56 > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>56 · Prev Qtr Payments</span>
                              <span style={{ fontSize: 11, color: "#6ee7b7" }}>({fmt(q.item56)})</span>
                            </div>
                          )}
                          {q.item57 > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>57 · CWT Prev Quarters</span>
                              <span style={{ fontSize: 11, color: "#6ee7b7" }}>({fmt(q.item57)})</span>
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>58 · CWT This Quarter</span>
                            <span style={{ fontSize: 11, color: "#6ee7b7" }}>({fmt(q.item58)})</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>62 · Total Credits</span>
                            <span style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 600 }}>({fmt(q.item62)})</span>
                          </div>
                        </div>
                        <div style={{ height: "0.5px", background: "rgba(255,255,255,0.08)", margin: "8px 0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: q.isOverpayment ? "#6ee7b7" : "#fcd34d" }}>
                            63 · {q.isOverpayment ? "Overpayment" : "Tax Payable"}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: q.isOverpayment ? "#6ee7b7" : "#fcd34d" }}>
                            {q.isOverpayment ? `(${fmt(q.item63)})` : fmt(q.item63)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Annual Summary */}
                  <div style={{ padding: "16px", background: "rgba(99,102,241,0.06)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 14 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Annual Summary {year}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Total Income</p>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{fmt(summary.quarters[summary.quarters.length - 1]?.item51 || 0)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Taxable Income</p>
                        <p style={{ fontSize: 15, fontWeight: 700, color: summary.quarters[summary.quarters.length - 1]?.item53 < 0 ? "#fca5a5" : "#fff" }}>
                          {fmt(summary.quarters[summary.quarters.length - 1]?.item53 || 0)}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Annual Tax Due</p>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#a5b4fc" }}>{fmt(summary.quarters[summary.quarters.length - 1]?.item54 || 0)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Total CWT</p>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#6ee7b7" }}>{fmt(summary.quarters[summary.quarters.length - 1]?.item62 || 0)}</p>
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