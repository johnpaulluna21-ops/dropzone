/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PAGE_SIZE = 10;
const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

export default function TaxPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTin, setNewTin] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newMiddleName, setNewMiddleName] = useState("");
  const [newRdo, setNewRdo] = useState("");
  const [newCredit, setNewCredit] = useState("");
  const [newTaxType, setNewTaxType] = useState<"8%" | "graduated">("8%");
  const [creditYear, setCreditYear] = useState(new Date().getFullYear().toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editCredit, setEditCredit] = useState("");
  const [editCreditYear, setEditCreditYear] = useState("");
  const [editTaxType, setEditTaxType] = useState<"8%" | "graduated">("8%");
  const [editLastName, setEditLastName] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editMiddleName, setEditMiddleName] = useState("");
  const [editRdo, setEditRdo] = useState("");
  const [editPayments, setEditPayments] = useState<{ Q1: string; Q2: string; Q3: string }>({ Q1: "", Q2: "", Q3: "" });
  const [deletedPayments, setDeletedPayments] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [page8, setPage8] = useState(1);
  const [pageGrad, setPageGrad] = useState(1);
  const [activeQuarter, setActiveQuarter] = useState("Q1");
  const [activeFolderTab, setActiveFolderTab] = useState<"8%" | "graduated">("8%");

  useEffect(() => { fetchClients(); }, []);
  useEffect(() => { setPage8(1); setPageGrad(1); }, [search]);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    setClients(data || []);
  };

  const openEdit = async (client: any) => {
    setEditingClient(client);
    setEditTaxType(client.tax_type || "8%");
    setEditLastName(client.last_name || "");
    setEditFirstName(client.first_name || "");
    setEditMiddleName(client.middle_name || "");
    setEditRdo(client.rdo_code || "");
    setEditCreditYear((new Date().getFullYear() - 1).toString());
    setDeletedPayments([]);
    const { data: existingCredit } = await supabase
      .from("prior_year_credits").select("excess_credit")
      .eq("client_id", client.id)
      .eq("year", new Date().getFullYear() - 1)
      .single();
    setEditCredit(existingCredit?.excess_credit?.toString() || "");
    const { data: existingPayments } = await supabase
      .from("tax_payments").select("quarter, amount_paid")
      .eq("client_id", client.id)
      .eq("year", parseInt(year));
    const p = { Q1: "", Q2: "", Q3: "" };
    (existingPayments || []).forEach((pay: any) => {
      if (pay.quarter === 1) p.Q1 = pay.amount_paid?.toString() || "";
      if (pay.quarter === 2) p.Q2 = pay.amount_paid?.toString() || "";
      if (pay.quarter === 3) p.Q3 = pay.amount_paid?.toString() || "";
    });
    setEditPayments(p);
  };

  const clearPayment = useCallback((qNum: number) => {
    const qKey = `Q${qNum}` as "Q1" | "Q2" | "Q3";
    setEditPayments(prev => ({ ...prev, [qKey]: "" }));
    setDeletedPayments(prev => [...prev, qNum]);
  }, []);

  const addClient = async () => {
    if (!newName.trim()) return alert("Name is required");
    const { data, error } = await supabase.from("clients").insert({
      name: newName.trim(), tin: newTin.trim() || null, tax_type: newTaxType,
      last_name: newLastName.trim() || null, first_name: newFirstName.trim() || null,
      middle_name: newMiddleName.trim() || null, rdo_code: newRdo.trim() || null,
    }).select().single();
    if (error) return alert("Error adding client: " + error.message);
    if (newCredit && data) {
      await supabase.from("prior_year_credits").insert({ client_id: data.id, year: parseInt(creditYear), excess_credit: parseFloat(newCredit) || 0 });
    }
    setNewName(""); setNewTin(""); setNewCredit(""); setNewTaxType("8%");
    setNewLastName(""); setNewFirstName(""); setNewMiddleName(""); setNewRdo("");
    setShowAddClient(false);
    fetchClients();
  };

  const saveEditClient = useCallback(async () => {
    if (!editingClient) return;
    await supabase.from("clients").update({
      tax_type: editTaxType,
      last_name: editLastName.trim() || null,
      first_name: editFirstName.trim() || null,
      middle_name: editMiddleName.trim() || null,
      rdo_code: editRdo.trim() || null,
    }).eq("id", editingClient.id);
    if (editCredit) {
      const creditYearInt = parseInt(editCreditYear) || new Date().getFullYear() - 1;
      const { data: existing } = await supabase
        .from("prior_year_credits").select("id")
        .eq("client_id", editingClient.id).eq("year", creditYearInt).single();
      if (existing) {
        await supabase.from("prior_year_credits").update({ excess_credit: parseFloat(editCredit) || 0 }).eq("id", existing.id);
      } else {
        await supabase.from("prior_year_credits").insert({ client_id: editingClient.id, year: creditYearInt, excess_credit: parseFloat(editCredit) || 0 });
      }
    }
    for (const qNum of deletedPayments) {
      await supabase.from("tax_payments").delete()
        .eq("client_id", editingClient.id).eq("year", parseInt(year)).eq("quarter", qNum);
    }
    for (const [q, amount] of Object.entries(editPayments)) {
      if (amount === "") continue;
      const qNum = parseInt(q.replace("Q", ""));
      if (deletedPayments.includes(qNum)) continue;
      const amountPaid = parseFloat(amount) || 0;
      const { data: existing } = await supabase
        .from("tax_payments").select("id")
        .eq("client_id", editingClient.id).eq("year", parseInt(year)).eq("quarter", qNum).single();
      if (existing) {
        await supabase.from("tax_payments").update({ amount_paid: amountPaid }).eq("id", existing.id);
      } else {
        await supabase.from("tax_payments").insert({ client_id: editingClient.id, year: parseInt(year), quarter: qNum, amount_paid: amountPaid });
      }
    }
    const updatedClient = {
      ...editingClient,
      tax_type: editTaxType,
      last_name: editLastName.trim() || null,
      first_name: editFirstName.trim() || null,
      middle_name: editMiddleName.trim() || null,
      rdo_code: editRdo.trim() || null,
    };
    setEditingClient(null);
    setEditCredit("");
    setEditPayments({ Q1: "", Q2: "", Q3: "" });
    setDeletedPayments([]);
    fetchClients();
    if (selected?.id === editingClient.id) {
      setSelected(updatedClient);
      computeSummary(updatedClient);
    }
  }, [editingClient, editTaxType, editLastName, editFirstName, editMiddleName, editRdo, editCredit, editCreditYear, editPayments, deletedPayments, year, selected]);

  const generateSAWT = async (client: any, quarterNum: number, quarterForms: any[]) => {
    const tin = (client.tin || "").replace(/\D/g, "");
    const tinMain = tin.substring(0, 9).padEnd(9, "0");
    const tinBranch = tin.substring(9, 13).padEnd(4, "0");
    const lastName = client.last_name || "";
    const firstName = client.first_name || "";
    const middleName = client.middle_name || "";
    const rdo = client.rdo_code || "000";
    const lastMonth = quarterNum * 3;
    const lastMonthPadded = String(lastMonth).padStart(2, "0");
    const period = `${lastMonthPadded}/${year}`;
    const monthName = MONTHS[lastMonth - 1];
    const displayTin = `${tinMain.substring(0,3)}-${tinMain.substring(3,6)}-${tinMain.substring(6,9)}-${tinBranch}`;
    const fullName = `${lastName}, ${firstName} ${middleName}`.trim();
    const totalIncome = quarterForms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0), 0);
    const totalTax = quarterForms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0), 0);

    const lines: string[] = [];
    lines.push(`HSAWT,H1701Q,${tinMain},${tinBranch},"","${lastName}","${firstName}","${middleName}",${period},${rdo}`);
    quarterForms.forEach((f: any, i: number) => {
      const payorTin = (f?.atc_tin || f?.payor_tin || "").replace(/\D/g, "").substring(0, 9).padEnd(9, "0");
      const payorName = (f?.payor_name || f?.client_name || "").toUpperCase().replace(/"/g, "").replace(/\.$/, "").trim();
      const atc = f?.atc || "WI120";
const income = parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0;
const tax = parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0;
const rate = income > 0 ? parseFloat((tax / income * 100).toFixed(2)) : 2.00;
lines.push(`DSAWT,D1701Q,${i + 1},${payorTin},0000,"${payorName}",,,,${period},,${atc},${rate.toFixed(2)},${income.toFixed(2)},${tax.toFixed(2)}`);
    });
    lines.push(`CSAWT,C1701Q,${tinMain},${tinBranch},${period},${totalIncome.toFixed(2)},${totalTax.toFixed(2)}`);

    const datContent = lines.join("\r\n") + "\r\n";
    const datBlob = new Blob([datContent], { type: "text/plain" });
    const datUrl = URL.createObjectURL(datBlob);
    const datLink = document.createElement("a");
    datLink.href = datUrl;
    datLink.download = `${tinMain}${tinBranch}${lastMonthPadded}${year}1701Q.DAT`;
    datLink.click();
    URL.revokeObjectURL(datUrl);

    const fmtNum = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const tableRows = quarterForms.map((f: any, i: number) => {
      const payorTinRaw = (f?.atc_tin || f?.payor_tin || "").replace(/\D/g, "");
      const payorTinFmt = payorTinRaw.length >= 9
        ? `${payorTinRaw.substring(0,3)}-${payorTinRaw.substring(3,6)}-${payorTinRaw.substring(6,9)}-${payorTinRaw.substring(9,13) || "0000"}`
        : payorTinRaw;
      const payorName = (f?.payor_name || f?.client_name || "").toUpperCase().replace(/\.$/, "").trim();
      const atc = f?.atc || "WI120";
      const income = parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0;
      const tax = parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0;
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${payorTinFmt}</td>
        <td style="text-align:center">${atc}</td>
        <td style="text-align:center">${income > 0 ? (tax / income * 100).toFixed(2) : "2.00"}</td>
        <td>${payorName}</td>
        <td style="text-align:right">${fmtNum(income)}</td>
        <td style="text-align:right">${fmtNum(tax)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SAWT - ${fullName}</title>
    <style>
      @page { size: A4 landscape; margin: 15mm; }
      body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; }
      .header { text-align: center; margin-bottom: 6px; }
      .header h2 { font-size: 11pt; font-weight: bold; margin: 0; }
      .header h3 { font-size: 10pt; font-weight: bold; margin: 2px 0; }
      .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 9pt; }
      table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
      th { border: 1px solid #000; padding: 4px 6px; text-align: center; background: #f0f0f0; font-size: 8pt; }
      td { border: 1px solid #000; padding: 3px 6px; }
      .total-row td { font-weight: bold; border-top: 2px solid #000; }
      .grand-total { margin-top: 8px; text-align: right; font-weight: bold; font-size: 9pt; border-top: 2px solid #000; padding-top: 4px; }
      .footer { margin-top: 16px; font-size: 8pt; }
    </style></head><body>
    <div class="header"><h2>BIR FORM 1701Q</h2><h3>SUMMARY ALPHALIST OF WITHHOLDING TAXES (SAWT)</h3></div>
    <div class="meta">
      <div><strong>PAYEE'S NAME:</strong> ${fullName}<br><strong>TIN:</strong> ${displayTin}</div>
      <div style="text-align:right"><strong>FOR THE MONTH OF ${monthName}, ${year}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th style="width:40px">SEQ.<br>NO.</th>
        <th style="width:120px">TAXPAYER<br>IDENTIFICATION<br>NUMBER (TIN)</th>
        <th style="width:50px">ATC</th>
        <th style="width:40px">RATE</th>
        <th>CORPORATION / INDIVIDUAL<br>(Registered Name)</th>
        <th style="width:110px">INCOME<br>PAYMENT</th>
        <th style="width:110px">AMOUNT OF TAX<br>WITHHELD</th>
      </tr></thead>
      <tbody>
        ${tableRows}
        <tr class="total-row">
          <td colspan="5" style="text-align:right">PAGE TOTAL</td>
          <td style="text-align:right">${fmtNum(totalIncome)}</td>
          <td style="text-align:right">${fmtNum(totalTax)}</td>
        </tr>
      </tbody>
    </table>
    <div class="grand-total">GRAND TOTAL &nbsp;&nbsp;&nbsp; ${fmtNum(totalTax)}</div>
    <div class="footer">END OF REPORT</div>
    </body></html>`;

    const printWindow = window.open("", "_blank", "width=900,height=600");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 500);
    }
  };

  const computeSummary = async (client: any) => {
    setSelected(client);
    setListOpen(false);
    setActiveQuarter("Q1");
    setLoading(true);
    try {
      const { data: uploads } = await supabase.from("uploads").select("*").eq("status", "extracted");
      const forms2307 = (uploads || []).filter(u => {
        const data = parseData(u.extracted_data);
        return data?.payee_tin?.replace(/\D/g, "").includes(client.tin?.replace(/\D/g, "") || "NOMATCH") ||
               data?.payee_name?.toLowerCase().includes(client.name.toLowerCase());
      });
      const { data: credits } = await supabase.from("prior_year_credits").select("*")
        .eq("client_id", client.id).eq("year", parseInt(year) - 1);
      const priorCredit = credits?.reduce((sum: number, c: any) => sum + (c.excess_credit || 0), 0) || 0;
      const { data: payments } = await supabase.from("tax_payments").select("*")
        .eq("client_id", client.id).eq("year", parseInt(year));
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
        const item47 = forms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_income || "0").replace(/,/g, "")) || 0), 0);
        const item49 = item47;
        const item50 = cumulativeIncome;
        const item51 = item49 + item50;
        const item52 = EXEMPTION;
        const item53 = item51 - item52;
        const item54 = Math.max(0, item53 * 0.08);
        const item55 = priorCredit;
        const item56 = previousPaid;
        const item57 = cumulativeCWT;
        const item58 = forms.reduce((sum: number, f: any) => sum + (parseFloat(String(f?.total_tax_withheld || "0").replace(/,/g, "")) || 0), 0);
        const item62 = item55 + item56 + item57 + item58;
        const item63 = item54 - item62;
        const qPayment = payments?.find((p: any) => p.quarter === qNum)?.amount_paid || 0;
        qSummaries.push({
          quarter: q, forms: forms.length,
          item47, item49, item50, item51, item52, item53, item54,
          item55, item56, item57, item58, item62, item63,
          paid: qPayment,
          isOverpayment: item63 < 0,
          isNoTaxDue: item54 === 0 && item63 <= 0,
          rawForms: forms,
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

  const clients8 = clients.filter(c => (!c.tax_type || c.tax_type === "8%") &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || (c.tin || "").includes(search)));
  const clientsGrad = clients.filter(c => c.tax_type === "graduated" &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || (c.tin || "").includes(search)));
  const totalPages8 = Math.ceil(clients8.length / PAGE_SIZE);
  const totalPagesGrad = Math.ceil(clientsGrad.length / PAGE_SIZE);
  const pagedClients8 = clients8.slice((page8 - 1) * PAGE_SIZE, page8 * PAGE_SIZE);
  const pagedClientsGrad = clientsGrad.slice((pageGrad - 1) * PAGE_SIZE, pageGrad * PAGE_SIZE);
  const showList = listOpen || search.length > 0;
  const activeQ = summary?.quarters.find((q: any) => q.quarter === activeQuarter);
  const drawerOpen = !!editingClient;

  const renderClientList = (list: any[], page: number, totalPages: number, setPage: any) => (
    <div>
      {list.length === 0 ? (
        <p style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
          {search ? "No clients match your search." : "No clients yet."}
        </p>
      ) : list.map(client => (
        <div key={client.id} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
          <div onClick={() => { computeSummary(client); setSearch(""); }} style={{ padding: "11px 16px", cursor: "pointer", background: selected?.id === client.id ? "rgba(99,102,241,0.1)" : "transparent", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{client.tin || "No TIN"}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); openEdit(client); }} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, marginLeft: 8 }}>
              Edit
            </button>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: page === 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: page === 1 ? "default" : "pointer", fontFamily: "inherit" }}>‹ Prev</button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{page} / {totalPages}</span>
          <button onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: page === totalPages ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: page === totalPages ? "default" : "pointer", fontFamily: "inherit" }}>Next ›</button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #0f0f0f; overflow-x: auto; }
        input, select { outline: none; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", transition: "all 0.25s ease" }}>

        {/* Main Content — shrinks when drawer opens */}
        <div style={{ flex: 1, minWidth: drawerOpen ? "900px" : "0", transition: "margin-right 0.25s ease", marginRight: drawerOpen ? "320px" : "0" }}>
          <main style={{ minHeight: "100vh", background: "#0f0f0f", backgroundImage: "radial-gradient(circle at top left, rgba(99,102,241,0.08) 0%, transparent 40%)", padding: "2rem 1.5rem", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>

              {/* Nav */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
                <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="ti ti-calculator" style={{ color: "#fff", fontSize: 18 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>Tax Summary Engine</h1>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>BIR 1701Q — Income Tax Compliance</p>
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

                  {/* Folder Tabs */}
                  <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                    {(["8%", "graduated"] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveFolderTab(tab)} style={{ flex: 1, padding: "9px 8px", background: activeFolderTab === tab ? "rgba(99,102,241,0.12)" : "transparent", border: "none", borderBottom: activeFolderTab === tab ? "2px solid #6366f1" : "2px solid transparent", color: activeFolderTab === tab ? "#a5b4fc" : "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                        {tab === "8%" ? "8% Filers" : "Graduated"} ({tab === "8%" ? clients8.length : clientsGrad.length})
                      </button>
                    ))}
                  </div>

                  {/* Selected client chip */}
                  {selected && !showList && (
                    <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(99,102,241,0.08)" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#a5b4fc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</p>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{selected.tin || "No TIN"}</p>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                        <button onClick={() => openEdit(selected)} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                        <button onClick={() => setListOpen(true)} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Change</button>
                      </div>
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
                      <select value={newTaxType} onChange={e => setNewTaxType(e.target.value as "8%" | "graduated")} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8, cursor: "pointer" }}>
                        <option value="8%">8% Income Tax Rate</option>
                        <option value="graduated">Graduated IT Rate</option>
                      </select>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Name for SAWT</p>
                      <input placeholder="Last Name" value={newLastName} onChange={e => setNewLastName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6 }} />
                      <input placeholder="First Name" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6 }} />
                      <input placeholder="Middle Name" value={newMiddleName} onChange={e => setNewMiddleName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6 }} />
                      <input placeholder="RDO Code (e.g. 015)" value={newRdo} onChange={e => setNewRdo(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <input placeholder="Prior year excess credit (₱)" value={newCredit} onChange={e => setNewCredit(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <input placeholder="Credit from year (e.g. 2025)" value={creditYear} onChange={e => setCreditYear(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <button onClick={addClient} style={{ width: "100%", padding: "8px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Save Client
                      </button>
                    </div>
                  )}

                  {/* Client List */}
                  {showList && (
                    activeFolderTab === "8%"
                      ? renderClientList(pagedClients8, page8, totalPages8, setPage8)
                      : renderClientList(pagedClientsGrad, pageGrad, totalPagesGrad, setPageGrad)
                  )}
                </div>

                {/* Summary Panel */}
                <div style={{ background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "1.5rem", overflowY: "auto" }}>
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                      <i className="ti ti-loader-2" style={{ fontSize: 20, marginRight: 8 }} /> Computing summary...
                    </div>
                  ) : summary ? (
                    summary.client.tax_type === "graduated" ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
                        <div style={{ width: 52, height: 52, background: "rgba(251,191,36,0.08)", border: "0.5px solid rgba(251,191,36,0.2)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <i className="ti ti-clock" style={{ fontSize: 24, color: "rgba(251,191,36,0.5)" }} />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{summary.client.name}</p>
                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Graduated IT Rate computation coming soon.</p>
                      </div>
                    ) : (
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

                        <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem" }}>
                          {summary.quarters.map((q: any) => {
                            const isActive = activeQuarter === q.quarter;
                            const label = q.isNoTaxDue ? "No Tax Due" : q.isOverpayment ? "Overpaid" : fmt(q.item63);
                            const labelColor = q.isNoTaxDue
                              ? (isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)")
                              : q.isOverpayment ? "#6ee7b7"
                              : (isActive ? "#fcd34d" : "rgba(252,211,77,0.5)");
                            return (
                              <button key={q.quarter} onClick={() => setActiveQuarter(q.quarter)} style={{ flex: 1, padding: "10px 8px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: isActive ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.04)", border: isActive ? "none" : "0.5px solid rgba(255,255,255,0.08)", transition: "all 0.15s" }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#fff" : "rgba(255,255,255,0.4)", marginBottom: 4 }}>{q.quarter}</p>
                                <p style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)" }}>{q.forms} 2307{q.forms !== 1 ? "s" : ""}</p>
                                <p style={{ fontSize: 11, fontWeight: 600, color: labelColor, marginTop: 4 }}>{label}</p>
                              </button>
                            );
                          })}
                        </div>

                        {activeQ && (
                          <div style={{ padding: "20px", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{activeQ.quarter} {year} — Detail</p>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: activeQ.forms > 0 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", color: activeQ.forms > 0 ? "#6ee7b7" : "rgba(255,255,255,0.3)", border: `0.5px solid ${activeQ.forms > 0 ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}` }}>
                                  {activeQ.forms} 2307{activeQ.forms !== 1 ? "s" : ""}
                                </span>
                                {activeQ.forms > 0 && (
                                  <button
                                    onClick={() => generateSAWT(summary.client, parseInt(activeQ.quarter.replace("Q", "")), activeQ.rawForms)}
                                    style={{ padding: "4px 12px", background: "rgba(16,185,129,0.15)", border: "0.5px solid rgba(16,185,129,0.3)", borderRadius: 8, color: "#6ee7b7", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}
                                  >
                                    <i className="ti ti-file-download" style={{ fontSize: 12 }} /> Generate SAWT
                                  </button>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.5px", marginBottom: 10, textTransform: "uppercase" }}>Schedule II — Income</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {[
                                    { label: "47 · Quarterly Income", value: fmt(activeQ.item47), color: "#fff" },
                                    { label: "50 · Add: Prev Quarters", value: fmt(activeQ.item50), color: "#fff" },
                                    { label: "51 · Cumulative Income", value: fmt(activeQ.item51), color: "#fff", bold: true },
                                    { label: "52 · Less: ₱250,000", value: `(${fmt(activeQ.item52)})`, color: "#6ee7b7" },
                                    { label: "53 · Taxable Income", value: activeQ.item53 < 0 ? `(${fmt(activeQ.item53)})` : fmt(activeQ.item53), color: activeQ.item53 < 0 ? "#fca5a5" : "#fff", bold: true },
                                    { label: "54 · Tax Due (8%)", value: fmt(activeQ.item54), color: "#a5b4fc", bold: true },
                                  ].map(row => (
                                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{row.label}</span>
                                      <span style={{ fontSize: 12, color: row.color, fontWeight: row.bold ? 600 : 400 }}>{row.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.5px", marginBottom: 10, textTransform: "uppercase" }}>Schedule III — Credits</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {[
                                    { label: "55 · Prior Year Credits", value: `(${fmt(activeQ.item55)})`, color: "#6ee7b7" },
                                    { label: "56 · Prev Qtr Payments", value: `(${fmt(activeQ.item56)})`, color: "#6ee7b7" },
                                    { label: "57 · CWT Prev Quarters", value: `(${fmt(activeQ.item57)})`, color: "#6ee7b7" },
                                    { label: "58 · CWT This Quarter", value: `(${fmt(activeQ.item58)})`, color: "#6ee7b7" },
                                    { label: "62 · Total Credits", value: `(${fmt(activeQ.item62)})`, color: "#6ee7b7", bold: true },
                                  ].map(row => (
                                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{row.label}</span>
                                      <span style={{ fontSize: 12, color: row.color, fontWeight: (row as any).bold ? 600 : 400 }}>{row.value}</span>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ marginTop: 16, padding: "14px 16px", background: activeQ.isNoTaxDue ? "rgba(255,255,255,0.03)" : activeQ.isOverpayment ? "rgba(16,185,129,0.08)" : "rgba(252,211,77,0.06)", border: `0.5px solid ${activeQ.isNoTaxDue ? "rgba(255,255,255,0.08)" : activeQ.isOverpayment ? "rgba(16,185,129,0.25)" : "rgba(252,211,77,0.2)"}`, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: activeQ.isNoTaxDue ? "rgba(255,255,255,0.4)" : activeQ.isOverpayment ? "#6ee7b7" : "#fcd34d" }}>
                                    63 · {activeQ.isNoTaxDue ? "No Tax Due" : activeQ.isOverpayment ? "Overpayment" : "Tax Payable"}
                                  </span>
                                  <span style={{ fontSize: 16, fontWeight: 700, color: activeQ.isNoTaxDue ? "rgba(255,255,255,0.4)" : activeQ.isOverpayment ? "#6ee7b7" : "#fcd34d" }}>
                                    {activeQ.isNoTaxDue ? "₱0.00" : activeQ.isOverpayment ? `(${fmt(activeQ.item63)})` : fmt(activeQ.item63)}
                                  </span>
                                </div>
                                {activeQ.paid > 0 && (
                                  <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(99,102,241,0.06)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Payment Made This Quarter</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "#a5b4fc" }}>{fmt(activeQ.paid)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

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
                              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Total Credits/Payments</p>
                              <p style={{ fontSize: 15, fontWeight: 700, color: "#6ee7b7" }}>{fmt(summary.quarters[summary.quarters.length - 1]?.item62 || 0)}</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )
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
        </div>

        {/* Edit Drawer — fixed to right, pushes content */}
        <div style={{
          position: "fixed", top: 0, right: 0, height: "100vh", width: "320px",
          background: "#1a1a1a", borderLeft: "0.5px solid rgba(255,255,255,0.08)",
          zIndex: 100, display: "flex", flexDirection: "column",
          transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease", overflowY: "auto"
        }}>
          <div style={{ padding: "20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Edit Client</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{editingClient?.name}</p>
            </div>
            <button onClick={() => { setEditingClient(null); setDeletedPayments([]); }} style={{ width: 28, height: 28, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0, marginLeft: 8 }}>✕</button>
          </div>

          <div style={{ padding: "16px 20px", flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Tax Type</p>
            <select value={editTaxType} onChange={e => setEditTaxType(e.target.value as any)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 14, cursor: "pointer" }}>
              <option value="8%">8% Income Tax Rate</option>
              <option value="graduated">Graduated IT Rate</option>
            </select>

            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Name (for SAWT)</p>
            <input placeholder="Last Name" value={editLastName} onChange={e => setEditLastName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="First Name" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="Middle Name" value={editMiddleName} onChange={e => setEditMiddleName(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="RDO Code (e.g. 015)" value={editRdo} onChange={e => setEditRdo(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 14, outline: "none" }} />

            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Prior Year Excess Credit</p>
            <input placeholder="Amount (₱)" value={editCredit} onChange={e => setEditCredit(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="From year (e.g. 2025)" value={editCreditYear} onChange={e => setEditCreditYear(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 14, outline: "none" }} />

            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Tax Payments Made ({year})</p>
            {(["Q1", "Q2", "Q3"] as const).map(q => {
              const qNum = parseInt(q.replace("Q", ""));
              const isDeleted = deletedPayments.includes(qNum);
              return (
                <div key={q} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input
                    placeholder={`${q} payment (₱)`}
                    value={editPayments[q]}
                    onChange={e => setEditPayments(prev => ({ ...prev, [q]: e.target.value }))}
                    disabled={isDeleted}
                    style={{ flex: 1, padding: "8px 10px", background: isDeleted ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: isDeleted ? "rgba(255,255,255,0.2)" : "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                  />
                  {isDeleted ? (
                    <button onClick={() => setDeletedPayments(prev => prev.filter(n => n !== qNum))} style={{ padding: "8px 10px", background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#a5b4fc", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Undo</button>
                  ) : (
                    <button onClick={() => clearPayment(qNum)} style={{ padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#fca5a5", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>✕</button>
                  )}
                </div>
              );
            })}

            <button onClick={saveEditClient} style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 16 }}>
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </>
  );
}