/**
 * components/tax/DATValidatorModal.tsx
 *
 * Extracted from app/admin/tax/page.tsx — Step 1 structural cleanup.
 * Zero logic changes. UI only.
 */

import { useEffect, useRef, useState } from "react";
import {
  validateDAT,
  fallbackDownload,
  type DATValidationResult,
} from "@/lib/sawt";

interface DATValidatorModalProps {
  onClose: () => void;
}

export function DATValidatorModal({ onClose }: DATValidatorModalProps) {
  const [results, setResults] = useState<DATValidationResult[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const processFiles = (files: File[]) => {
    const datFiles = files.filter((f) => /\.(dat|txt)$/i.test(f.name));
    if (!datFiles.length) return;
    let loaded = 0;
    const newResults: { filename: string; content: string }[] = [];
    datFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newResults.push({
          filename: file.name,
          content: ev.target?.result as string,
        });
        loaded++;
        if (loaded === datFiles.length) {
          newResults.sort((a, b) => a.filename.localeCompare(b.filename));
          setResults((prev) => [
            ...prev,
            ...newResults.map((r) => validateDAT(r.filename, r.content)),
          ]);
        }
      };
      reader.readAsText(file);
    });
  };

  const downloadTxt = (r: DATValidationResult) => {
    fallbackDownload(
      r.filename.replace(/\.(dat|txt)$/i, "") + ".TXT",
      r.txtReport,
      "text/plain"
    );
  };

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  const btnStyle: React.CSSProperties = {
    padding: "3px 10px",
    background: "rgba(255,255,255,0.06)",
    border: "0.5px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 11,
    fontFamily: "inherit",
    cursor: "pointer",
    outline: "none",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "2rem 1rem",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "#1a1a1a",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "0.5px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                background: "rgba(16,185,129,0.15)",
                border: "0.5px solid rgba(16,185,129,0.25)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i
                className="ti ti-shield-check"
                style={{ fontSize: 16, color: "#6ee7b7" }}
              />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                DAT File Validator
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  marginTop: 1,
                }}
              >
                BIR SAWT 1701Q — single or batch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              background: "rgba(255,255,255,0.06)",
              border: "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.5)",
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
            }}
          >
            X
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>
          {/* Drop zone */}
          <div
            onDrop={(e) => {
              e.preventDefault();
              processFiles(Array.from(e.dataTransfer.files));
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "1.5px dashed rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: "1.5rem",
              textAlign: "center",
              cursor: "pointer",
              background: "rgba(255,255,255,0.02)",
              marginBottom: 16,
            }}
          >
            <i
              className="ti ti-files"
              style={{ fontSize: 28, color: "rgba(255,255,255,0.2)" }}
            />
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.4)",
                marginTop: 8,
              }}
            >
              Drop .DAT files here or click to browse
            </p>
            <p
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.2)",
                marginTop: 4,
              }}
            >
              Single or multiple files accepted
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".dat,.DAT,.txt,.TXT"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              processFiles(Array.from(e.target.files || []));
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />

          {/* Summary bar */}
          {total > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 10,
                marginBottom: 14,
                background:
                  passed === total
                    ? "rgba(16,185,129,0.08)"
                    : "rgba(239,68,68,0.08)",
                border: `0.5px solid ${
                  passed === total
                    ? "rgba(16,185,129,0.2)"
                    : "rgba(239,68,68,0.2)"
                }`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i
                  className={`ti ti-${
                    passed === total ? "circle-check" : "alert-circle"
                  }`}
                  style={{
                    fontSize: 16,
                    color: passed === total ? "#6ee7b7" : "#fca5a5",
                  }}
                />
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: passed === total ? "#6ee7b7" : "#fca5a5",
                  }}
                >
                  {passed} of {total} file{total !== 1 ? "s" : ""} passed
                  validation
                </p>
              </div>
              <button
                onClick={() => setResults([])}
                style={{
                  ...btnStyle,
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                }}
              >
                <i className="ti ti-trash" style={{ fontSize: 12 }} /> Clear all
              </button>
            </div>
          )}

          {/* Results list */}
          {results.map((r, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "0.5px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                marginBottom: 10,
                overflow: "hidden",
              }}
            >
              <div
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: r.passed
                      ? "rgba(16,185,129,0.15)"
                      : "rgba(239,68,68,0.1)",
                    flexShrink: 0,
                  }}
                >
                  <i
                    className={`ti ti-${r.passed ? "check" : "x"}`}
                    style={{
                      fontSize: 13,
                      color: r.passed ? "#6ee7b7" : "#fca5a5",
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#fff",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.filename}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.3)",
                      marginTop: 1,
                    }}
                  >
                    {r.hInfo
                      ? `${r.hInfo.tin} · ${r.hInfo.name || "—"} · ${r.hInfo.period} · ${r.hInfo.dCount} 2307s`
                      : "Could not parse header"}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontWeight: 500,
                    flexShrink: 0,
                    background: !r.passed
                      ? "rgba(239,68,68,0.12)"
                      : r.warnCount > 0
                      ? "rgba(251,191,36,0.12)"
                      : "rgba(16,185,129,0.12)",
                    color: !r.passed
                      ? "#fca5a5"
                      : r.warnCount > 0
                      ? "#fcd34d"
                      : "#6ee7b7",
                  }}
                >
                  {!r.passed
                    ? `${r.errorCount} error${r.errorCount !== 1 ? "s" : ""}`
                    : r.warnCount > 0
                    ? `Passed · ${r.warnCount} warning${r.warnCount !== 1 ? "s" : ""}`
                    : "Passed"}
                </span>
                <i
                  className={`ti ti-chevron-${expanded[i] ? "up" : "down"}`}
                  style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}
                />
              </div>

              {expanded[i] && (
                <div
                  style={{
                    borderTop: "0.5px solid rgba(255,255,255,0.06)",
                    padding: "14px",
                  }}
                >
                  {r.hInfo && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {[
                        ["TIN", r.hInfo.tin],
                        ["Name", r.hInfo.name || "—"],
                        ["Period", r.hInfo.period],
                        ["RDO", r.hInfo.rdo || "—"],
                        ["2307s", r.hInfo.dCount],
                      ].map(([label, val]) => (
                        <div
                          key={String(label)}
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 8,
                            padding: "7px 10px",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 10,
                              color: "rgba(255,255,255,0.3)",
                              marginBottom: 3,
                            }}
                          >
                            {label}
                          </p>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: "#fff",
                              wordBreak: "break-all",
                            }}
                          >
                            {val}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.structErrors.length > 0 && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "rgba(239,68,68,0.08)",
                        border: "0.5px solid rgba(239,68,68,0.2)",
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#fca5a5",
                          marginBottom: 4,
                        }}
                      >
                        <i
                          className="ti ti-alert-triangle"
                          style={{ fontSize: 12 }}
                        />{" "}
                        Structure errors
                      </p>
                      {r.structErrors.map((e, j) => (
                        <p
                          key={j}
                          style={{ fontSize: 11, color: "#fca5a5", marginTop: 3 }}
                        >
                          · {e}
                        </p>
                      ))}
                    </div>
                  )}

                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 11,
                      marginBottom: 12,
                    }}
                  >
                    <thead>
                      <tr>
                        {["Line", "Type", "Status"].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: "left",
                              padding: "5px 8px",
                              borderBottom:
                                "0.5px solid rgba(255,255,255,0.06)",
                              fontSize: 10,
                              color: "rgba(255,255,255,0.3)",
                              fontWeight: 500,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.lineResults.map((l, j) => (
                        <tr key={j}>
                          <td
                            style={{
                              padding: "5px 8px",
                              borderBottom:
                                "0.5px solid rgba(255,255,255,0.04)",
                              fontFamily: "monospace",
                              color: "rgba(255,255,255,0.3)",
                              fontSize: 11,
                            }}
                          >
                            {l.lineNum}
                          </td>
                          <td
                            style={{
                              padding: "5px 8px",
                              borderBottom:
                                "0.5px solid rgba(255,255,255,0.04)",
                              fontWeight: 500,
                              color: "#fff",
                              fontSize: 11,
                            }}
                          >
                            {l.type}
                          </td>
                          <td
                            style={{
                              padding: "5px 8px",
                              borderBottom:
                                "0.5px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            {l.errors.length === 0 &&
                              l.warnings.length === 0 && (
                                <span style={{ fontSize: 10, color: "#6ee7b7" }}>
                                  OK
                                </span>
                              )}
                            {l.errors.length > 0 && (
                              <>
                                <span
                                  style={{ fontSize: 10, color: "#fca5a5" }}
                                >
                                  Error
                                </span>
                                {l.errors.map((e, k) => (
                                  <div
                                    key={k}
                                    style={{
                                      fontSize: 10,
                                      color: "#fca5a5",
                                      marginTop: 2,
                                    }}
                                  >
                                    · {e}
                                  </div>
                                ))}
                              </>
                            )}
                            {l.warnings.length > 0 && (
                              <>
                                {l.errors.length === 0 && (
                                  <span
                                    style={{ fontSize: 10, color: "#fcd34d" }}
                                  >
                                    Warning
                                  </span>
                                )}
                                {l.warnings.map((w, k) => (
                                  <div
                                    key={k}
                                    style={{
                                      fontSize: 10,
                                      color: "#fcd34d",
                                      marginTop: 2,
                                    }}
                                  >
                                    {w}
                                  </div>
                                ))}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                      BIR-style validation report
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(r.txtReport).catch(() => {})
                        }
                        style={btnStyle}
                      >
                        <i className="ti ti-copy" style={{ fontSize: 11 }} />{" "}
                        Copy
                      </button>
                      <button onClick={() => downloadTxt(r)} style={btnStyle}>
                        <i
                          className="ti ti-download"
                          style={{ fontSize: 11 }}
                        />{" "}
                        Download .TXT
                      </button>
                    </div>
                  </div>
                  <pre
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.6)",
                      background: "rgba(255,255,255,0.03)",
                      padding: "10px 12px",
                      borderRadius: 8,
                      overflowX: "auto",
                      lineHeight: 1.6,
                      whiteSpace: "pre",
                    }}
                  >
                    {r.txtReport}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
