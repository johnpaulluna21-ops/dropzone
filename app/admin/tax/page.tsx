/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  generateSAWTContent,
  parseExtractedData,
  writeFileToDir,
  fallbackDownload,
  fmtPeso,
  normalizeTin,
  type ExtractedForm,
} from "@/lib/sawt";
import * as XLSX from "xlsx";
import {
  fetchClient2307s,
  fetchPriorYearCredit,
  fetchTaxPayments,
  fetchSubmissions,
  recordSawtSubmission,
  fetchClients as fetchClientsFromDB,
} from "@/services/tax";
import {
  fetchManualIncomeByYear,
  saveManualIncome,
  deleteManualIncome as deleteManualIncomeFromDB,
} from "@/services/manualIncome";
import {
  computeQuarterlySummary,
  type ManualIncomeEntry,
} from "@/modules/tax/computeQuarterlySummary";
import {
  getCurrentQuarter,
  getQuarterDeadline,
  formatDeadlineDate,
  getUrgencyMessage,
} from "@/modules/tax/deadlines";
import { DATValidatorModal } from "@/components/tax/DATValidatorModal";
import { BatchSAWTModal } from "@/components/tax/BatchSAWTModal";
import { ResubmitModal } from "@/components/tax/ResubmitModal";
import { createClient as createClientService } from "@/services/client/createClient";
import { updateClient as updateClientService } from "@/services/client/updateClient";
import { fetchClientEditData } from "@/services/client/fetchClientEditData";
import { buildBatchSAWTQueue } from "@/services/tax/buildBatchSAWTQueue";
import { type ClientRecord } from "@/core/types/client";
import { type BatchEmailItem } from "@/core/types/tax";
import { fetchAnnualITR } from "@/services/tax/fetchAnnualITR"
import { Button, Card, EmptyState } from "@/components/ui";

const PAGE_SIZE = 10;

export default function TaxPage() {
  const [sendStatus, setSendStatus] = useState("");
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
  const [editAddress, setEditAddress] = useState("");
  const [editPayments, setEditPayments] = useState<{ Q1: string; Q2: string; Q3: string }>({ Q1: "", Q2: "", Q3: "" });
  const [deletedPayments, setDeletedPayments] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [page8, setPage8] = useState(1);
  const [pageGrad, setPageGrad] = useState(1);
  const [activeQuarter, setActiveQuarter] = useState("Q1");
  const [activeFolderTab, setActiveFolderTab] = useState<"8%" | "graduated">("8%");
  const [showValidator, setShowValidator] = useState(false);
  const [batchModal, setBatchModal] = useState<{ quarter: string; clientsWithForms: { client: ClientRecord; forms: ExtractedForm[] }[] } | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchStatus, setBatchStatus] = useState("");
  const [batchEmailClients, setBatchEmailClients] = useState<BatchEmailItem[]>([]);
  const [batchEmailSending, setBatchEmailSending] = useState(false);
  const [batchEmailStatus, setBatchEmailStatus] = useState("");
  const [batchEmailProgress, setBatchEmailProgress] = useState(0);
  const [submissions, setSubmissions] = useState<Record<string, string>>({});
  const [priorYearAITR, setPriorYearAITR] = useState<any | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // ── Resubmit Warning Modal State ─────────────────────────────
  const [resubmitModal, setResubmitModal] = useState<{
    clientName: string;
    quarterNum: number;
    submittedAt: string;
    newClients?: any[];
    duplicateClients?: any[];
    onConfirmSkip?: () => void;
    onConfirm: () => void;
  } | null>(null);
  // ────────────────────────────────────────────────────────────

  // ── Manual Income State ──────────────────────────────────────
  const [manualIncomes, setManualIncomes] = useState<ManualIncomeEntry[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualPayorName, setManualPayorName] = useState("");
  const [manualGrossIncome, setManualGrossIncome] = useState("");
  const [manualTaxWithheld, setManualTaxWithheld] = useState("");
  const [manualSourceType, setManualSourceType] = useState("manual_entry");
  const [manualNotes, setManualNotes] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  // ────────────────────────────────────────────────────────────

  // ── Deadline Banner (computed once, no state needed) ─────────
  const today = new Date();
  const { quarter: currentQ, year: currentYear } = getCurrentQuarter(today);
  const deadlineInfo = getQuarterDeadline(currentYear, currentQ, today);
  const deadlineDisplay = formatDeadlineDate(deadlineInfo.deadline);
  const urgencyMessage = getUrgencyMessage(deadlineInfo);
  const bannerBg = deadlineInfo.isOverdue
    ? "rgba(239,68,68,0.08)"
    : deadlineInfo.isDueSoon
    ? "rgba(251,191,36,0.08)"
    : "rgba(59,130,246,0.08)";
  const bannerBorder = deadlineInfo.isOverdue
    ? "rgba(239,68,68,0.25)"
    : deadlineInfo.isDueSoon
    ? "rgba(251,191,36,0.25)"
    : "rgba(59,130,246,0.25)";
  const bannerTextColor = deadlineInfo.isOverdue
    ? "#fca5a5"
    : deadlineInfo.isDueSoon
    ? "#fcd34d"
    : "#93c5fd";
  const badgeBg = deadlineInfo.isOverdue
    ? "rgba(239,68,68,0.15)"
    : deadlineInfo.isDueSoon
    ? "rgba(251,191,36,0.15)"
    : "rgba(59,130,246,0.15)";
  // ────────────────────────────────────────────────────────────

  useEffect(() => { loadClients(); }, []);
  useEffect(() => { setPage8(1); setPageGrad(1); }, [search]);

  // ── UI: load clients via service ─────────────────────────────
  const loadClients = async () => {
    const data = await fetchClientsFromDB();
    setClients(data);
  };

  // ── UI: load submissions via service ─────────────────────────
  const loadSubmissions = async (clientId: string) => {
    const map = await fetchSubmissions(clientId, parseInt(year));
    setSubmissions(map);
  };

  // ── UI: compute summary — orchestrates services + pure function
  const computeSummary = useCallback(async (client: any) => {
    setSelected(client);
    setListOpen(false);
    setActiveQuarter("Q1");
    setLoading(true);
    setShowManualForm(false);
    setPriorYearAITR(null);
    setShowComparison(false);

    try {
      // 1. Load submissions (UI state)
      const submissionsMap = await fetchSubmissions(client.id, parseInt(year));
      setSubmissions(submissionsMap);

      // 2. Fetch all data via services
      const raw2307s = await fetchClient2307s(client.tin || "", client.name);
      const priorCredit = await fetchPriorYearCredit(client.id, parseInt(year));
      const paymentsByQuarter = await fetchTaxPayments(client.id, parseInt(year));
      const manualByQuarter = await fetchManualIncomeByYear(client.id, parseInt(year));

      // 3. Store manual incomes for UI display
      const allManual = Object.values(manualByQuarter).flat() as ManualIncomeEntry[];
      setManualIncomes(allManual);

      // 4. Bucket 2307s by quarter
      const forms2307ByQuarter: Record<string, any[]> = { Q1: [], Q2: [], Q3: [], Q4: [] };
      let totalForms = 0;
      raw2307s.forEach((u: any) => {
        const data = parseExtractedData(u.extracted_data);
        const period = data?.period_to || data?.period_from || "";
        const month = parseInt(period.split("/")[0]) || 0;
        if (month >= 1 && month <= 3) { forms2307ByQuarter.Q1.push(data); totalForms++; }
        else if (month >= 4 && month <= 6) { forms2307ByQuarter.Q2.push(data); totalForms++; }
        else if (month >= 7 && month <= 9) { forms2307ByQuarter.Q3.push(data); totalForms++; }
        else if (month >= 10 && month <= 12) { forms2307ByQuarter.Q4.push(data); totalForms++; }
      });

      // 5. Call pure function — no math in the page
      const result = computeQuarterlySummary({
        forms2307ByQuarter,
        manualByQuarter,
        priorCredit,
        paymentsByQuarter,
        totalForms,
      });

      setSummary({ client, ...result });if (editingClient) {
  openEdit(client);
}
      

      // Load prior year AITR from annual_itr_records table
const priorYear = parseInt(year) - 1;
const priorAITR = await fetchAnnualITR(client.id, priorYear);
setPriorYearAITR(priorAITR);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [year, editingClient]);

  // ── Manual income: save via service ─────────────────────────
  const handleSaveManualIncome = async () => {
    if (!selected || !manualPayorName.trim() || !manualGrossIncome.trim()) return;
    setManualSaving(true);
    try {
      await saveManualIncome({
        client_id: selected.id,
        quarter: parseInt(activeQuarter.replace("Q", "")),
        year: parseInt(year),
        payor_name: manualPayorName.trim(),
        gross_income: parseFloat(manualGrossIncome) || 0,
        tax_withheld: parseFloat(manualTaxWithheld) || 0,
        source_type: manualSourceType,
        notes: manualNotes.trim() || null,
      });
      setManualPayorName("");
      setManualGrossIncome("");
      setManualTaxWithheld("");
      setManualNotes("");
      setManualSourceType("manual_entry");
      setShowManualForm(false);
      computeSummary(selected);
    } catch {
      alert("Failed to save. Please try again.");
    } finally {
      setManualSaving(false);
    }
  };

  // ── Manual income: delete via service ────────────────────────
  const handleDeleteManualIncome = async (id: string) => {
    if (!confirm("Remove this income entry?")) return;
    await deleteManualIncomeFromDB(id);
    computeSummary(selected);
  };

  // AFTER
const openEdit = useCallback(async (client: any) => {
  setEditingClient(client);
  setEditTaxType(client.tax_type || "8%");
  setEditLastName(client.last_name || "");
  setEditFirstName(client.first_name || "");
  setEditMiddleName(client.middle_name || "");
  setEditRdo(client.rdo_code || "");
  setEditAddress(client.address || "");
  setEditCreditYear((new Date().getFullYear() - 1).toString());
  setDeletedPayments([]);
  const data = await fetchClientEditData(client.id, parseInt(year));
  setEditCredit(data.priorYearCredit);
  setEditPayments(data.payments);
}, [year]); // setters are stable, only year needs to be tracked

  const clearPayment = useCallback((qNum: number) => {
    const qKey = `Q${qNum}` as "Q1" | "Q2" | "Q3";
    setEditPayments(prev => ({ ...prev, [qKey]: "" }));
    setDeletedPayments(prev => [...prev, qNum]);
  }, []);

  const addClient = async () => {
    if (!newName.trim()) return alert("Name is required");
    try {
      await createClientService({
        name: newName.trim(),
        tin: newTin.trim() || null,
        tax_type: newTaxType,
        last_name: newLastName.trim() || null,
        first_name: newFirstName.trim() || null,
        middle_name: newMiddleName.trim() || null,
        rdo_code: newRdo.trim() || null,
        prior_year_credit: newCredit ? parseFloat(newCredit) : null,
        credit_year: newCredit ? parseInt(creditYear) : null,
      });
      setNewName(""); setNewTin(""); setNewCredit(""); setNewTaxType("8%");
      setNewLastName(""); setNewFirstName(""); setNewMiddleName(""); setNewRdo("");
      setShowAddClient(false);
      loadClients();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const saveEditClient = useCallback(async () => {
    if (!editingClient) return;
    await updateClientService({
      clientId: editingClient.id,
      tax_type: editTaxType,
      last_name: editLastName.trim() || null,
      first_name: editFirstName.trim() || null,
      middle_name: editMiddleName.trim() || null,
      rdo_code: editRdo.trim() || null,
      address: editAddress.trim() || null,
      credit: editCredit || undefined,
      creditYear: parseInt(editCreditYear) || new Date().getFullYear() - 1,
      payments: editPayments,
      deletedPayments,
      year: parseInt(year),
    });
    const updatedClient = {
      ...editingClient,
      tax_type: editTaxType,
      last_name: editLastName.trim() || null,
      first_name: editFirstName.trim() || null,
      middle_name: editMiddleName.trim() || null,
      rdo_code: editRdo.trim() || null,
      address: editAddress.trim() || null,
    };
    setEditingClient(null);
    setEditCredit("");
    setEditPayments({ Q1: "", Q2: "", Q3: "" });
    setDeletedPayments([]);
    loadClients();
    if (selected?.id === editingClient.id) {
      setSelected(updatedClient);
      computeSummary(updatedClient);
    }
  }, [editingClient, editTaxType, editLastName, editFirstName, editMiddleName, editRdo, editAddress, editCredit, editCreditYear, editPayments, deletedPayments, selected, year, computeSummary]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateSAWT = (client: any, quarterNum: number, quarterForms: ExtractedForm[]) => {
    const result = generateSAWTContent(
      { tin: client.tin || "", lastName: client.last_name || "", firstName: client.first_name || "", middleName: client.middle_name || "", rdoCode: client.rdo_code || "" },
      quarterNum, quarterForms, year
    );
    fallbackDownload(result.datFilename, result.datContent, "text/plain");
    const printWindow = window.open("", "_blank", "width=900,height=600");
    if (printWindow) {
      printWindow.document.write(result.html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 500);
    }
  };

  const handleSendToBIR = async (client: any, quarterNum: number, quarterForms: ExtractedForm[]) => {
    const fullName = `${client.first_name || ""} ${client.middle_name ? client.middle_name + " " : ""}${client.last_name || ""}`.trim().toUpperCase();

    // Check if already submitted
    const existingSubmission = submissions[`Q${quarterNum}`];
    if (existingSubmission) {
      const submittedDate = new Date(existingSubmission).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
      setResubmitModal({
        clientName: fullName,
        quarterNum,
        submittedAt: submittedDate,
        onConfirm: () => proceedSendToBIR(client, quarterNum, quarterForms, fullName),
      });
      return;
    }
    proceedSendToBIR(client, quarterNum, quarterForms, fullName);
  };

  const proceedSendToBIR = async (client: any, quarterNum: number, quarterForms: ExtractedForm[], fullName: string) => {
    setResubmitModal(null);
    try {
      const result = generateSAWTContent(
        { tin: client.tin || "", lastName: client.last_name || "", firstName: client.first_name || "", middleName: client.middle_name || "", rdoCode: client.rdo_code || "" },
        quarterNum, quarterForms, year
      );
      const nameParts = (client.name || "").split("/");
      const registeredName = (nameParts.length > 1 ? nameParts[1] : nameParts[0]).trim().toUpperCase();
      const resp = await fetch("/api/sawt/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datContent: result.datContent, datFilename: result.datFilename, clientName: fullName, registeredName, tin: result.displayTin, quarterNum, year, address: client.address || "" }),
      });
      if (resp.ok) {
        await recordSawtSubmission(client.id, quarterNum, parseInt(year), result.datFilename);
        setSubmissions(prev => ({ ...prev, [`Q${quarterNum}`]: new Date().toISOString() }));
        setSendStatus(`Sent: ${fullName}`);
        setTimeout(() => setSendStatus(""), 4000);
      } else {
        setSendStatus("Failed to send. Try again.");
        setTimeout(() => setSendStatus(""), 4000);
      }
    } catch {
      setSendStatus("Failed to send. Try again.");
      setTimeout(() => setSendStatus(""), 4000);
    }
  };

  const handleBatchSendEmail = async () => {
    if (batchEmailClients.length === 0) return;

    // Fetch actual submission status from DB for each client in queue
    const submissionChecks = await Promise.all(
      batchEmailClients.map(async item => {
        const map = await fetchSubmissions(item.client.id, parseInt(year));
        return {
          item,
          alreadySubmitted: !!map[`Q${item.quarterNum}`],
        };
      })
    );

    const alreadySubmitted = submissionChecks.filter(s => s.alreadySubmitted).map(s => s.item);
    const notYetSubmitted = submissionChecks.filter(s => !s.alreadySubmitted).map(s => s.item);

    if (alreadySubmitted.length > 0) {
      const duplicateNames = alreadySubmitted.map(item =>
        `${item.client.last_name || ""}, ${item.client.first_name || ""}`.trim()
      ).join("\n");
      setResubmitModal({
        clientName: duplicateNames,
        quarterNum: alreadySubmitted[0].quarterNum,
        submittedAt: "previously",
        newClients: notYetSubmitted,
        duplicateClients: alreadySubmitted,
        onConfirmSkip: notYetSubmitted.length > 0
          ? () => proceedBatchSend(notYetSubmitted)
          : undefined,
        onConfirm: () => proceedBatchSend(batchEmailClients),
      });
      return;
    }
    proceedBatchSend(batchEmailClients);
  };

  const proceedBatchSend = async (clientsToSend: typeof batchEmailClients) => {
    setResubmitModal(null);
    if (clientsToSend.length === 0) return;
    setBatchEmailSending(true);
    setBatchEmailStatus("");
    setBatchEmailProgress(0);
    let sent = 0;
    for (const item of clientsToSend) {
      const { client, datContent, datFilename, quarterNum } = item;
      const fullName = `${client.first_name || ""} ${client.middle_name ? client.middle_name + " " : ""}${client.last_name || ""}`.trim().toUpperCase();
      const nameParts = (client.name || "").split("/");
      const registeredName = (nameParts.length > 1 ? nameParts[1] : nameParts[0]).trim().toUpperCase();
      const { display: displayTin } = normalizeTin(client.tin || "");
      setBatchEmailStatus(`Sending ${sent + 1} / ${clientsToSend.length}: ${fullName}...`);
      try {
        await fetch("/api/sawt/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datContent, datFilename, clientName: fullName, registeredName, tin: displayTin, quarterNum, year, address: client.address || "" }) });
        await recordSawtSubmission(client.id, quarterNum, parseInt(year), datFilename);
      } catch { /* continue even if one fails */ }
      sent++;
      setBatchEmailProgress(Math.round((sent / clientsToSend.length) * 100));
      await new Promise(r => setTimeout(r, 800));
    }
    setBatchEmailSending(false);
    setBatchEmailStatus(`Done - ${sent} email${sent !== 1 ? "s" : ""} sent.`);
    if (selected) loadSubmissions(selected.id);
    setTimeout(() => { setBatchEmailClients([]); setBatchEmailStatus(""); setBatchEmailProgress(0); }, 4000);
  };

  const openBatchModal = async (quarterStr: string) => {
    const result = await buildBatchSAWTQueue(clients, quarterStr, year);
    setBatchModal({ quarter: quarterStr, clientsWithForms: result.queue });
  };

  const runBatchGenerate = async (selectedClients: { client: any; forms: ExtractedForm[] }[], quarterStr: string, folderName: string) => {
    setBatchModal(null);
    setBatchGenerating(true);
    setBatchStatus("Preparing files...");
    const qNum = parseInt(quarterStr.replace("Q", ""));
    const lastMonth = qNum * 3;
    const lastMonthPadded = String(lastMonth).padStart(2, "0");
    const now = new Date().toLocaleString("en-PH");
    let summaryTxt = `BATCH SAWT GENERATION SUMMARY\nQuarter: ${quarterStr} ${year}\nFolder: ${folderName}\nGenerated: ${now}\nTotal clients: ${selectedClients.length}\n\n`;
    summaryTxt += `${"TIN".padEnd(20)} ${"CLIENT NAME".padEnd(35)} FILENAME\n${"-".repeat(80)}\n`;
    selectedClients.forEach(({ client }) => {
      const { display: displayTin, main: tinMain, branch: tinBranch } = normalizeTin(client.tin || "");
      const datFilename = `${tinMain}${tinBranch}${lastMonthPadded}${year}1701Q.DAT`;
      const fullName = `${client.last_name || ""}, ${client.first_name || ""}`.trim() || client.name;
      summaryTxt += `${displayTin.padEnd(20)} ${fullName.substring(0, 34).padEnd(35)} ${datFilename}\n`;
    });
    summaryTxt += `${"-".repeat(80)}\n`;
    const summaryFilename = `BATCH_SAWT_${quarterStr}_${year}_SUMMARY.TXT`;
    const fsSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;
    let dirHandle: FileSystemDirectoryHandle | null = null;
    if (fsSupported) {
      try {
        setBatchStatus("Waiting for folder selection...");
        dirHandle = await (window as any).showDirectoryPicker({ startIn: "downloads", mode: "readwrite", suggestedName: folderName });
      } catch { setBatchGenerating(false); setBatchStatus(""); return; }
    }
    setBatchStatus("Writing summary...");
    if (dirHandle) { await writeFileToDir(dirHandle, summaryFilename, summaryTxt, "text/plain"); }
    else { fallbackDownload(summaryFilename, summaryTxt, "text/plain"); await new Promise(r => setTimeout(r, 500)); }
    const emailQueue: { client: any; datContent: string; datFilename: string; quarterNum: number; }[] = [];
    for (let i = 0; i < selectedClients.length; i++) {
      const { client, forms } = selectedClients[i];
      const clientLabel = (client.last_name || client.name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 12);
      setBatchStatus(`Writing ${i + 1} / ${selectedClients.length}: ${clientLabel}...`);
      const result = generateSAWTContent(
        { tin: client.tin || "", lastName: client.last_name || "", firstName: client.first_name || "", middleName: client.middle_name || "", rdoCode: client.rdo_code || "" },
        qNum, forms, year
      );
      emailQueue.push({ client, datContent: result.datContent, datFilename: result.datFilename, quarterNum: qNum });
      const htmlFilename = `SAWT-${result.datFilename.replace(".DAT", "")}-${clientLabel}.html`;
      const htmlWithPrint = result.html.replace("</body>", `<script>window.onload=function(){window.print();}<\/script></body>`);
      if (dirHandle) {
        await writeFileToDir(dirHandle, result.datFilename, result.datContent, "text/plain");
        await writeFileToDir(dirHandle, htmlFilename, htmlWithPrint, "text/html");
      } else {
        fallbackDownload(`${folderName}_${result.datFilename}`, result.datContent, "text/plain");
        await new Promise(r => setTimeout(r, 400));
        fallbackDownload(`${folderName}_${htmlFilename}`, htmlWithPrint, "text/html");
        await new Promise(r => setTimeout(r, 800));
      }
    }
    setBatchEmailClients(emailQueue);
    setBatchGenerating(false);
    setBatchStatus("");
  };

  const handleExportExcel = () => {
    if (!summary) return;
    const rows: any[] = [];
    rows.push(["TAX SUMMARY REPORT"]);
    rows.push(["Client", summary.client.name]);
    rows.push(["TIN", summary.client.tin || "N/A"]);
    rows.push(["Tax Year", year]);
    rows.push(["Tax Type", summary.client.tax_type || "8%"]);
    rows.push([]);
    rows.push(["Quarter", "2307s", "Manual Entries", "Quarterly Income", "Cumulative Income", "Taxable Income", "Tax Due (8%)", "CWT This Quarter", "Total Tax Credits/Payments", "Tax Payable / (Overpayment)", "Payment Made"]);
    summary.quarters.forEach((q: any) => {
      rows.push([q.quarter, q.forms, q.manualCount || 0, q.item47, q.item51, q.item53, q.item54, q.item58, q.item62, q.item63, q.paid || 0]);
    });
    rows.push([]);
    const lastQ = summary.quarters[summary.quarters.length - 1];
    rows.push(["ANNUAL SUMMARY"]);
    rows.push(["Total Income", lastQ?.item51 || 0]);
    rows.push(["Taxable Income", lastQ?.item53 || 0]);
    rows.push(["Annual Tax Due", lastQ?.item54 || 0]);
    rows.push(["Total Tax Credits/Payments", lastQ?.item62 || 0]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tax Summary");
    const filename = `TaxSummary_${(summary.client.name || "client").replace(/[^a-zA-Z0-9]/g, "_")}_${year}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const fmt = (n: number) => `P${fmtPeso(Math.abs(n))}`;
  const clients8 = clients.filter(c => (!c.tax_type || c.tax_type === "8%") && (c.name.toLowerCase().includes(search.toLowerCase()) || (c.tin || "").includes(search)));
  const clientsGrad = clients.filter(c => c.tax_type === "graduated" && (c.name.toLowerCase().includes(search.toLowerCase()) || (c.tin || "").includes(search)));
  const totalPages8 = Math.ceil(clients8.length / PAGE_SIZE), totalPagesGrad = Math.ceil(clientsGrad.length / PAGE_SIZE);
  const pagedClients8 = clients8.slice((page8 - 1) * PAGE_SIZE, page8 * PAGE_SIZE);
  const pagedClientsGrad = clientsGrad.slice((pageGrad - 1) * PAGE_SIZE, pageGrad * PAGE_SIZE);
  const showList = listOpen || search.length > 0;
  const activeQ = summary?.quarters.find((q: any) => q.quarter === activeQuarter);
  const drawerOpen = !!editingClient;
  const selectedIndex = clients.findIndex(c => c.id === selected?.id);
  const activeQManual = manualIncomes.filter(m => m.quarter === parseInt(activeQuarter.replace("Q", "")) && m.year === parseInt(year));
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "#111111", border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#ffffff", fontSize: 12, fontFamily: "inherit", outline: "none" };

  const renderClientList = (list: any[], page: number, totalPages: number, setPage: (fn: (p: number) => number) => void) => (
    <div>
      {list.length === 0
        ? <p style={{ padding: "2rem", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{search ? "No clients match your search." : "No clients yet."}</p>
        : list.map(client => (
          <div key={client.id} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
            <div onClick={() => { computeSummary(client); setSearch(""); }} style={{ padding: "11px 16px", cursor: "pointer", background: selected?.id === client.id ? "rgba(99,102,241,0.1)" : "transparent", transition: "background 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{client.tin || "No TIN"}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openEdit(client); }} style={{ flexShrink: 0, marginLeft: 8 }}>Edit</Button>
            </div>
          </div>
        ))}
      {totalPages > 1 && (
        <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{page} / {totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
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

      {showValidator && <DATValidatorModal onClose={() => setShowValidator(false)} />}
      {batchModal && <BatchSAWTModal quarter={batchModal.quarter} yearStr={year} clientsWithForms={batchModal.clientsWithForms} onClose={() => setBatchModal(null)} onConfirm={runBatchGenerate} />}

      {/* Resubmit Warning Modal */}
      {resubmitModal && (
  <ResubmitModal
    clientName={resubmitModal.clientName}
    quarterNum={resubmitModal.quarterNum}
    submittedAt={resubmitModal.submittedAt}
    newClients={resubmitModal.newClients}
    duplicateClients={resubmitModal.duplicateClients}
    onConfirmSkip={resubmitModal.onConfirmSkip}
    onConfirm={resubmitModal.onConfirm}
    onClose={() => setResubmitModal(null)}
  />
)}

      {batchGenerating && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998, padding: "12px 18px", background: "#1a1a1a", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          <i className="ti ti-loader-2" style={{ fontSize: 16, color: "#a5b4fc" }} />
          <p style={{ fontSize: 13, color: "#fff" }}>{batchStatus || "Generating batch SAWT files..."}</p>
        </div>
      )}

      {batchEmailClients.length > 0 && !batchEmailSending && !batchEmailStatus && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998, padding: "14px 18px", background: "#1a1a1a", border: "0.5px solid rgba(59,130,246,0.35)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: 400 }}>
          <i className="ti ti-mail" style={{ fontSize: 18, color: "#93c5fd", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{batchEmailClients.length} DAT file{batchEmailClients.length !== 1 ? "s" : ""} ready</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Send all to BIR eSubmission?</p>
          </div>
          <button onClick={handleBatchSendEmail} style={{ padding: "7px 14px", background: "rgba(59,130,246,0.2)", border: "0.5px solid rgba(59,130,246,0.4)", borderRadius: 8, color: "#93c5fd", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
            <i className="ti ti-send" style={{ fontSize: 12 }} /> Batch Send to BIR
          </button>
          <button onClick={() => setBatchEmailClients([])} style={{ width: 26, height: 26, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0 }}>X</button>
        </div>
      )}

      {(batchEmailSending || batchEmailStatus) && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998, padding: "16px 18px", background: "#1a1a1a", border: `0.5px solid ${batchEmailSending ? "rgba(59,130,246,0.3)" : "rgba(16,185,129,0.3)"}`, borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxWidth: 360, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: batchEmailSending ? 10 : 0 }}>
            <i className={`ti ti-${batchEmailSending ? "loader-2" : "circle-check"}`} style={{ fontSize: 16, color: batchEmailSending ? "#93c5fd" : "#6ee7b7", flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: "#fff", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{batchEmailStatus || "Sending emails..."}</p>
          </div>
          {batchEmailSending && (
            <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg, #3b82f6, #6366f1)", width: `${batchEmailProgress}%`, transition: "width 0.4s ease" }} />
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", minHeight: "100vh", transition: "all 0.25s ease" }}>
        <div style={{ flex: 1, minWidth: drawerOpen ? "900px" : "0", transition: "margin-right 0.25s ease", marginRight: drawerOpen ? "320px" : "0" }}>
          <main style={{ minHeight: "100vh", background: "#0f0f0f", backgroundImage: "radial-gradient(circle at top left, rgba(99,102,241,0.08) 0%, transparent 40%)", padding: "2rem 1.5rem", fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>

              {/* ── BIR Deadline Banner ────────────────────────────────── */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", marginBottom: "1.25rem", background: bannerBg, border: `0.5px solid ${bannerBorder}`, borderRadius: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: bannerTextColor }}>
                      BIR 1701Q {deadlineInfo.label} — Filing Deadline
                    </p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                      Due: <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>{deadlineDisplay}</span>
                    </p>
                  </div>
                </div>
                <div style={{ padding: "5px 14px", background: badgeBg, border: `0.5px solid ${bannerBorder}`, borderRadius: 20 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: bannerTextColor }}>{urgencyMessage}</span>
                </div>
              </div>
              {/* ──────────────────────────────────────────────────────── */}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem" }}>
                <div style={{ width: 38, height: 38, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="ti ti-calculator" style={{ color: "#fff", fontSize: 18 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>Tax Summary Engine</h1>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>BIR 1701Q — Income Tax Compliance</p>
                </div>
                <Button
  loading={batchEmailSending}
  disabled={batchEmailClients.length === 0 || batchEmailSending}
  onClick={handleBatchSendEmail}
  style={{
    background: batchEmailClients.length > 0 ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
    border: `0.5px solid ${batchEmailClients.length > 0 ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
    color: batchEmailClients.length > 0 ? "#93c5fd" : "rgba(255,255,255,0.2)",
    fontWeight: 600,
  }}
>
  {!batchEmailSending && <i className="ti ti-send" style={{ fontSize: 14 }} />}
  {batchEmailClients.length > 0 ? `Batch Send to BIR (${batchEmailClients.length})` : "Batch Send to BIR"}
</Button>
<Button variant="primary" onClick={() => openBatchModal(activeQuarter)}>
  <i className="ti ti-folders" style={{ fontSize: 14 }} /> Batch Generate
</Button>
<Button variant="success" disabled={!summary} onClick={handleExportExcel}>
  <i className="ti ti-table-export" style={{ fontSize: 14 }} /> Export Excel
</Button>
<Button variant="success" onClick={() => setShowValidator(true)}>
  <i className="ti ti-shield-check" style={{ fontSize: 14 }} /> Validate DAT
</Button>
<Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.5)", fontSize: 13, textDecoration: "none" }}>
  <i className="ti ti-arrow-left" style={{ fontSize: 14 }} /> Back to Dashboard
</Link>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
                <label style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Tax Year:</label>
                <select value={year} onChange={e => setYear(e.target.value)} style={{ padding: "8px 12px", background: "#1a1a1a", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>

                {/* Client Panel */}
                <Card style={{ overflow: "hidden", padding: 0, alignSelf: "start" }}>
                  <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Clients ({clients.length})</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setListOpen(!listOpen); setSearch(""); }} style={{ padding: "5px 10px", background: listOpen ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", border: `0.5px solid ${listOpen ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: listOpen ? "#a5b4fc" : "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                        <i className="ti ti-list" style={{ fontSize: 13 }} />
                      </button>
                      <button onClick={() => setShowAddClient(!showAddClient)} style={{ padding: "5px 10px", background: "rgba(99,102,241,0.2)", border: "0.5px solid rgba(99,102,241,0.35)", borderRadius: 8, color: "#a5b4fc", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                    {(["8%", "graduated"] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveFolderTab(tab)} style={{ flex: 1, padding: "9px 8px", background: activeFolderTab === tab ? "rgba(99,102,241,0.12)" : "transparent", border: "none", borderBottom: activeFolderTab === tab ? "2px solid #6366f1" : "2px solid transparent", color: activeFolderTab === tab ? "#a5b4fc" : "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                        {tab === "8%" ? "8% Filers" : "Graduated"} ({tab === "8%" ? clients8.length : clientsGrad.length})
                      </button>
                    ))}
                  </div>
                  {selected && !showList && (
                    <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(99,102,241,0.08)" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: "#a5b4fc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</p>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{selected.tin || "No TIN"}</p>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                        <button onClick={() => openEdit(selected)} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                        <button onClick={() => setListOpen(true)} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Change</button>
                        <button onClick={() => { const prev = clients[selectedIndex - 1]; if (prev) computeSummary(prev); }} disabled={selectedIndex <= 0} style={{ padding: "3px 7px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: selectedIndex <= 0 ? "default" : "pointer", fontFamily: "inherit", opacity: selectedIndex <= 0 ? 0.3 : 1 }}>{"<"}</button>
                        <button onClick={() => { const next = clients[selectedIndex + 1]; if (next) computeSummary(next); }} disabled={selectedIndex >= clients.length - 1} style={{ padding: "3px 7px", background: "rgba(99,102,241,0.2)", border: "0.5px solid rgba(99,102,241,0.35)", borderRadius: 6, color: "#a5b4fc", fontSize: 11, cursor: selectedIndex >= clients.length - 1 ? "default" : "pointer", fontFamily: "inherit", opacity: selectedIndex >= clients.length - 1 ? 0.3 : 1 }}>{">"}</button>
                      </div>
                    </div>
                  )}
                  <div style={{ padding: "10px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                    <input placeholder="Search name or TIN..." value={search} onChange={e => { setSearch(e.target.value); setListOpen(true); }} style={{ width: "100%", padding: "7px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit" }} />
                  </div>
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
                      <input placeholder="Prior year excess credit" value={newCredit} onChange={e => setNewCredit(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <input placeholder="Credit from year (e.g. 2025)" value={creditYear} onChange={e => setCreditYear(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 8 }} />
                      <button onClick={addClient} style={{ width: "100%", padding: "8px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save Client</button>
                    </div>
                  )}
                  {showList && (activeFolderTab === "8%" ? renderClientList(pagedClients8, page8, totalPages8, setPage8) : renderClientList(pagedClientsGrad, pageGrad, totalPagesGrad, setPageGrad))}
                </Card>

                {/* Summary Panel */}
                <Card style={{ overflowY: "auto" }}>
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                      <i className="ti ti-loader-2" style={{ fontSize: 20, marginRight: 8 }} /> Computing summary...
                    </div>
                  ) : summary ? (
                    summary.client.tax_type === "graduated" ? (
                      <EmptyState
                          icon="ti-calculator"
                          title="Select a client to compute tax summary"
                          description="Choose a client from the left panel to view their quarterly breakdown"
                          style={{ height: 300 }}
/>
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

                        {/* Quarter tabs */}
                        <div style={{ display: "flex", gap: 6, marginBottom: "1.25rem" }}>
                          {summary.quarters.map((q: any) => {
                            const isActive = activeQuarter === q.quarter;
                            const label = q.isNoTaxDue ? "No Tax Due" : q.isOverpayment ? "Overpaid" : fmt(q.item63);
                            const labelColor = q.isNoTaxDue ? (isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)") : q.isOverpayment ? "#6ee7b7" : (isActive ? "#fcd34d" : "rgba(252,211,77,0.5)");
                            return (
                              <button key={q.quarter} onClick={() => setActiveQuarter(q.quarter)} style={{ flex: 1, padding: "10px 8px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: isActive ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.04)", border: isActive ? "none" : "0.5px solid rgba(255,255,255,0.08)", transition: "all 0.15s", position: "relative" }}>
                                {submissions[q.quarter] && (
                                  <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: "#6ee7b7", boxShadow: "0 0 6px #6ee7b7" }} />
                                )}
                                <p style={{ fontSize: 13, fontWeight: 600, color: isActive ? "#fff" : "rgba(255,255,255,0.4)", marginBottom: 4 }}>{q.quarter}</p>
                                <p style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)" }}>
                                  {q.forms} 2307{q.forms !== 1 ? "s" : ""}
                                  {q.manualCount > 0 && <span style={{ color: isActive ? "rgba(251,191,36,0.9)" : "rgba(251,191,36,0.4)" }}> · {q.manualCount} manual</span>}
                                </p>
                                <p style={{ fontSize: 11, fontWeight: 600, color: labelColor, marginTop: 4 }}>{label}</p>
                                {submissions[q.quarter] && (
                                  <p style={{ fontSize: 10, color: isActive ? "rgba(255,255,255,0.6)" : "#6ee7b7", marginTop: 3 }}>Sent</p>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {activeQ && (
                          <div style={{ padding: "20px", background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", flexShrink: 0 }}>{activeQ.quarter} {year} — Detail</p>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: activeQ.forms > 0 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", color: activeQ.forms > 0 ? "#6ee7b7" : "rgba(255,255,255,0.3)", border: `0.5px solid ${activeQ.forms > 0 ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}` }}>
                                    {activeQ.forms} 2307{activeQ.forms !== 1 ? "s" : ""}
                                  </span>
                                  <button onClick={() => setShowManualForm(!showManualForm)} style={{ padding: "4px 12px", background: showManualForm ? "rgba(251,191,36,0.2)" : "rgba(251,191,36,0.1)", border: `0.5px solid ${showManualForm ? "rgba(251,191,36,0.5)" : "rgba(251,191,36,0.25)"}`, borderRadius: 8, color: "#fcd34d", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                                    <i className="ti ti-plus" style={{ fontSize: 12 }} /> Add Income
                                  </button>
                                  {activeQ.forms > 0 && (
                                    <>
                                      <button onClick={() => handleGenerateSAWT(summary.client, parseInt(activeQ.quarter.replace("Q", "")), activeQ.rawForms)} style={{ padding: "4px 12px", background: "rgba(16,185,129,0.15)", border: "0.5px solid rgba(16,185,129,0.3)", borderRadius: 8, color: "#6ee7b7", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                                        <i className="ti ti-file-download" style={{ fontSize: 12 }} /> Generate SAWT
                                      </button>
                                      <button onClick={() => handleSendToBIR(summary.client, parseInt(activeQ.quarter.replace("Q", "")), activeQ.rawForms)} style={{ padding: "4px 12px", background: "rgba(59,130,246,0.15)", border: "0.5px solid rgba(59,130,246,0.3)", borderRadius: 8, color: "#93c5fd", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                                        <i className="ti ti-send" style={{ fontSize: 12 }} /> Send to BIR
                                      </button>
                                    </>
                                  )}
                                </div>
                                {sendStatus && <div style={{ fontSize: 11, color: "#6ee7b7" }}>{sendStatus}</div>}
                              </div>
                            </div>

                            {/* Manual Income Form */}
                            {showManualForm && (
                              <div style={{ marginBottom: 16, padding: "14px 16px", background: "rgba(251,191,36,0.05)", border: "0.5px solid rgba(251,191,36,0.2)", borderRadius: 12 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: "#fcd34d", marginBottom: 10 }}>
                                  <i className="ti ti-pencil" style={{ fontSize: 12, marginRight: 4 }} />
                                  Add Manual Income — {activeQ.quarter} {year}
                                </p>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                                  <div style={{ gridColumn: "1 / -1" }}>
                                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Payor / Source Name *</p>
                                    <input placeholder="e.g. ABC Company, Freelance Client" value={manualPayorName} onChange={e => setManualPayorName(e.target.value)} style={inputStyle} />
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Gross Income *</p>
                                    <input type="number" placeholder="0.00" value={manualGrossIncome} onChange={e => setManualGrossIncome(e.target.value)} style={inputStyle} />
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Tax Withheld (0 if none)</p>
                                    <input type="number" placeholder="0.00" value={manualTaxWithheld} onChange={e => setManualTaxWithheld(e.target.value)} style={inputStyle} />
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Source Type</p>
                                    <select value={manualSourceType} onChange={e => setManualSourceType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                                      <option value="manual_entry">Manual Entry</option>
                                      <option value="official_receipt">Official Receipt</option>
                                      <option value="sales_invoice">Sales Invoice</option>
                                      <option value="bank_statement">Bank Statement</option>
                                    </select>
                                  </div>
                                  <div>
                                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Notes (optional)</p>
                                    <input placeholder="e.g. Q2 service fee" value={manualNotes} onChange={e => setManualNotes(e.target.value)} style={inputStyle} />
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                  <button onClick={() => setShowManualForm(false)} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                                  <button onClick={handleSaveManualIncome} disabled={manualSaving || !manualPayorName.trim() || !manualGrossIncome.trim()} style={{ padding: "7px 16px", background: manualSaving || !manualPayorName.trim() || !manualGrossIncome.trim() ? "rgba(255,255,255,0.06)" : "rgba(251,191,36,0.2)", border: `0.5px solid ${manualSaving ? "rgba(255,255,255,0.1)" : "rgba(251,191,36,0.4)"}`, borderRadius: 8, color: manualSaving || !manualPayorName.trim() || !manualGrossIncome.trim() ? "rgba(255,255,255,0.3)" : "#fcd34d", fontSize: 12, fontWeight: 600, cursor: manualSaving ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                                    {manualSaving ? <><i className="ti ti-loader-2" style={{ fontSize: 12 }} /> Saving...</> : <><i className="ti ti-check" style={{ fontSize: 12 }} /> Save Entry</>}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Manual Income List */}
                            {activeQManual.length > 0 && (
                              <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(251,191,36,0.6)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Manual Income Entries</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {activeQManual.map((m: any) => (
                                    <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(251,191,36,0.05)", border: "0.5px solid rgba(251,191,36,0.15)", borderRadius: 8 }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.payor_name}</p>
                                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{m.source_type?.replace(/_/g, " ")}{m.notes && ` · ${m.notes}`}</p>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: 12 }}>
                                        <div style={{ textAlign: "right" }}>
                                          <p style={{ fontSize: 12, fontWeight: 600, color: "#fcd34d" }}>P{fmtPeso(m.gross_income)}</p>
                                          {m.tax_withheld > 0 && <p style={{ fontSize: 10, color: "#6ee7b7" }}>CWT: P{fmtPeso(m.tax_withheld)}</p>}
                                        </div>
                                        <button onClick={() => handleDeleteManualIncome(m.id)} style={{ width: 24, height: 24, background: "rgba(239,68,68,0.15)", border: "0.5px solid rgba(239,68,68,0.35)", borderRadius: 6, color: "#fca5a5", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", lineHeight: 1 }}>
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.5px", marginBottom: 10, textTransform: "uppercase" }}>Schedule II — Income</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {[
                                    { label: "47 · Quarterly Income", value: fmt(activeQ.item47), color: "#fff" },
                                    { label: "50 · Add: Prev Quarters", value: fmt(activeQ.item50), color: "#fff" },
                                    { label: "51 · Cumulative Income", value: fmt(activeQ.item51), color: "#fff", bold: true },
                                    { label: "52 · Less: P250,000", value: `(${fmt(activeQ.item52)})`, color: "#6ee7b7" },
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
                                    { label: "62 · Total Tax Credits/Payments", value: `(${fmt(activeQ.item62)})`, color: "#6ee7b7", bold: true },
                                  ].map(row => (
                                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{row.label}</span>
                                      <span style={{ fontSize: 12, color: row.color, fontWeight: (row as any).bold ? 600 : 400 }}>{row.value}</span>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ marginTop: 16, padding: "14px 16px", background: activeQ.isNoTaxDue ? "rgba(255,255,255,0.03)" : activeQ.isOverpayment ? "rgba(16,185,129,0.08)" : "rgba(252,211,77,0.06)", border: `0.5px solid ${activeQ.isNoTaxDue ? "rgba(255,255,255,0.08)" : activeQ.isOverpayment ? "rgba(16,185,129,0.25)" : "rgba(252,211,77,0.2)"}`, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: activeQ.isNoTaxDue ? "rgba(255,255,255,0.4)" : activeQ.isOverpayment ? "#6ee7b7" : "#fcd34d" }}>63 · {activeQ.isNoTaxDue ? "No Tax Due" : activeQ.isOverpayment ? "Overpayment" : "Tax Payable"}</span>
                                  <span style={{ fontSize: 16, fontWeight: 700, color: activeQ.isNoTaxDue ? "rgba(255,255,255,0.4)" : activeQ.isOverpayment ? "#6ee7b7" : "#fcd34d" }}>{activeQ.isNoTaxDue ? "P0.00" : activeQ.isOverpayment ? `(${fmt(activeQ.item63)})` : fmt(activeQ.item63)}</span>
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

                        {/* Annual Summary */}
                        <div style={{ padding: "16px", background: "rgba(99,102,241,0.06)", border: "0.5px solid rgba(99,102,241,0.2)", borderRadius: 14 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 12 }}>Annual Summary {year}</p>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                            {[
                              { label: "Total Income", value: fmt(summary.quarters[summary.quarters.length - 1]?.item51 || 0), color: "#fff" },
                              { label: "Taxable Income", value: fmt(summary.quarters[summary.quarters.length - 1]?.item53 || 0), color: summary.quarters[summary.quarters.length - 1]?.item53 < 0 ? "#fca5a5" : "#fff" },
                              { label: "Annual Tax Due", value: fmt(summary.quarters[summary.quarters.length - 1]?.item54 || 0), color: "#a5b4fc" },
                              { label: "Less: Total Tax Credits/Payments", value: fmt(summary.quarters[summary.quarters.length - 1]?.item62 || 0), color: "#6ee7b7" },
                            ].map(item => (
                              <div key={item.label}>
                                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{item.label}</p>
                                <p style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Prior Year Comparison */}
                        {priorYearAITR ? (
                          <div style={{ border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
                            <div onClick={() => setShowComparison(!showComparison)} style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <i className="ti ti-chart-bar" style={{ fontSize: 14, color: "#a5b4fc" }} />
                                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Year-over-Year Comparison</p>
                                <span style={{ fontSize: 10, padding: "2px 8px", background: "rgba(99,102,241,0.2)", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 20, color: "#a5b4fc" }}>{parseInt(year) - 1} Filed vs {year} Running</span>
                              </div>
                              <i className={`ti ti-chevron-${showComparison ? "up" : "down"}`} style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }} />
                            </div>
                            {showComparison && (
                              <div style={{ padding: "16px" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr>
                                      {["Field", `${parseInt(year) - 1} (Filed)`, `${year} (Running)`, "Change"].map(h => (
                                        <th key={h} style={{ textAlign: h === "Field" ? "left" : "right", padding: "8px 10px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500, borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[
                                      { label: "Gross Income", prior: priorYearAITR.gross_sales, current: summary.quarters[summary.quarters.length-1]?.item51 || 0 },
                                      { label: "Less: P250,000", prior: priorYearAITR.allowable_deduction, current: 250000 },
                                      { label: "Net Taxable Income", prior: priorYearAITR.taxable_income_loss, current: summary.quarters[summary.quarters.length-1]?.item53 || 0 },
                                      { label: "Tax Due (8%)", prior: priorYearAITR.tax_due, current: summary.quarters[summary.quarters.length-1]?.item54 || 0 },
                                      { label: "Less: Total Tax Credits/Payments", prior: priorYearAITR.total_credits, current: summary.quarters[summary.quarters.length-1]?.item62 || 0 },
                                      { label: "Net Tax Payable/(Overpayment", prior: priorYearAITR.tax_payable_overpayment, current: summary.quarters[summary.quarters.length-1]?.item63 || 0, isResult: true },
                                    ].map((row: any) => {
                                      const change = row.current - row.prior;
                                      const changeColor = change === 0 ? "rgba(255,255,255,0.3)" : row.isResult ? (change < 0 ? "#6ee7b7" : "#fca5a5") : (change > 0 ? "#fcd34d" : "#6ee7b7");
                                      return (
                                        <tr key={row.label}>
                                          <td style={{ padding: "8px 10px", fontSize: 12, color: "rgba(255,255,255,0.6)", borderBottom: "0.5px solid rgba(255,255,255,0.04)", fontWeight: row.isResult ? 600 : 400 }}>{row.label}</td>
                                          <td style={{ padding: "8px 10px", fontSize: 12, color: "#fff", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.04)", fontWeight: row.isResult ? 600 : 400 }}>{row.prior < 0 ? `(${fmt(row.prior)})` : fmt(row.prior)}</td>
                                          <td style={{ padding: "8px 10px", fontSize: 12, color: "#a5b4fc", textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.04)", fontWeight: row.isResult ? 600 : 400 }}>{row.current < 0 ? `(${fmt(row.current)})` : fmt(row.current)}</td>
                                          <td style={{ padding: "8px 10px", fontSize: 12, color: changeColor, textAlign: "right", borderBottom: "0.5px solid rgba(255,255,255,0.04)", fontWeight: 600 }}>{change === 0 ? "—" : `${change > 0 ? "+" : ""}${fmt(change)}`}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                {priorYearAITR.confidence !== "high" && <p style={{ fontSize: 10, color: "#fcd34d", marginTop: 10 }}>⚠️ Extraction confidence: {priorYearAITR.confidence} — verify against original document.</p>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                            <i className="ti ti-chart-bar" style={{ fontSize: 14, color: "rgba(255,255,255,0.2)" }} />
                            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>No {parseInt(year) - 1} 1701A on file. Upload the prior year AITR to enable year-over-year comparison.</p>
                          </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 16 }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{selectedIndex + 1} of {clients.length}</span>
                          <button onClick={() => { const prev = clients[selectedIndex - 1]; if (prev) computeSummary(prev); }} disabled={selectedIndex <= 0} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: selectedIndex <= 0 ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, opacity: selectedIndex <= 0 ? 0.3 : 1 }}>
                            <i className="ti ti-chevron-left" style={{ fontSize: 13 }} /> Prev
                          </button>
                          <button onClick={() => { const next = clients[selectedIndex + 1]; if (next) computeSummary(next); }} disabled={selectedIndex >= clients.length - 1} style={{ padding: "7px 14px", background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#a5b4fc", fontSize: 12, fontWeight: 600, cursor: selectedIndex >= clients.length - 1 ? "default" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, opacity: selectedIndex >= clients.length - 1 ? 0.3 : 1 }}>
                            Next <i className="ti ti-chevron-right" style={{ fontSize: 13 }} />
                          </button>
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
                </Card>
              </div>
            </div>
          </main>

        {/* Edit Drawer */}
        <div style={{ position: "fixed", top: 0, right: 0, height: "100vh", width: "320px", background: "#1a1a1a", borderLeft: "0.5px solid rgba(255,255,255,0.08)", zIndex: 100, display: "flex", flexDirection: "column", transform: drawerOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s ease", overflowY: "auto" }}>
          <div style={{ padding: "20px", borderBottom: "0.5px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Edit Client</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{editingClient?.name}</p>
            </div>
            <button onClick={() => { setEditingClient(null); setDeletedPayments([]); }} style={{ width: 28, height: 28, background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "rgba(255,255,255,0.5)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", flexShrink: 0, marginLeft: 8 }}>X</button>
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
            <input placeholder="RDO Code (e.g. 015)" value={editRdo} onChange={e => setEditRdo(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="Address (e.g. Rizal, City of Santiago, Isabela)" value={editAddress} onChange={e => setEditAddress(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 14, outline: "none" }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Prior Year Excess Credit</p>
            <input placeholder="Amount" value={editCredit} onChange={e => setEditCredit(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 6, outline: "none" }} />
            <input placeholder="From year (e.g. 2025)" value={editCreditYear} onChange={e => setEditCreditYear(e.target.value)} style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 12, fontFamily: "inherit", marginBottom: 14, outline: "none" }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Tax Payments Made ({year})</p>
            {(["Q1", "Q2", "Q3"] as const).map(q => {
              const qNum = parseInt(q.replace("Q", ""));
              const isDeleted = deletedPayments.includes(qNum);
              return (
                <div key={q} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input placeholder={`${q} payment`} value={editPayments[q]} onChange={e => setEditPayments(prev => ({ ...prev, [q]: e.target.value }))} disabled={isDeleted} style={{ flex: 1, padding: "8px 10px", background: isDeleted ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 8, color: isDeleted ? "rgba(255,255,255,0.2)" : "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                  {isDeleted
                    ? <button onClick={() => setDeletedPayments(prev => prev.filter(n => n !== qNum))} style={{ padding: "8px 10px", background: "rgba(99,102,241,0.15)", border: "0.5px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#a5b4fc", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Undo</button>
                    : <button onClick={() => clearPayment(qNum)} style={{ padding: "8px 10px", background: "rgba(239,68,68,0.1)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#fca5a5", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>X</button>
                  }
                </div>
              );
            })}
            <button onClick={saveEditClient} style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 16 }}>Save Changes</button>
          </div>
        </div>
      </div>
    </>
  );
}
