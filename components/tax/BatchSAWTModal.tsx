/**
 * components/tax/BatchSAWTModal.tsx
 *
 * Extracted from app/admin/tax/page.tsx — Step 1 structural cleanup.
 * Zero logic changes. UI only.
 */

"use client";
import { useState } from "react";
import { type ExtractedForm } from "@/lib/sawt";
import { type ClientRecord } from "@/core/types/client";

interface BatchSAWTModalProps {
  quarter: string;
  yearStr: string;
  clientsWithForms: { client: ClientRecord; forms: ExtractedForm[] }[];
  onClose: () => void;
  onConfirm: (
    selected: { client: ClientRecord; forms: ExtractedForm[] }[],
    quarter: string,
    folderName: string
  ) => void;
}

export function BatchSAWTModal({
  quarter,
  yearStr,
  clientsWithForms,
  onClose,
  onConfirm,
}: BatchSAWTModalProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    clientsWithForms.forEach((c) => {
      init[c.client.id] = true;
    });
    return init;
  });
  const [folderName, setFolderName] = useState(`SAWT-${quarter}-${yearStr}`);

  const selectedCount = Object.values(checked).filter(Boolean).length;
  const selectedClients = clientsWithForms.filter((c) => checked[c.client.id]);
  const fsSupportedHint =
    typeof window !== "undefined" && "showDirectoryPicker" in window;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    background: "rgba(255,255,255,0.06)",
    border: "0.5px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 12,
    fontFamily: "inherit",
    outline: "none",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
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
                background: "rgba(99,102,241,0.15)",
                border: "0.5px solid rgba(99,102,241,0.25)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i
                className="ti ti-files"
                style={{ fontSize: 16, color: "#a5b4fc" }}
              />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                Batch Generate SAWT
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.3)",
                  marginTop: 1,
                }}
              >
                {quarter} {yearStr} — select clients to include
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

        {/* Select all / none */}
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            {selectedCount} of {clientsWithForms.length} clients selected
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                const all: Record<string, boolean> = {};
                clientsWithForms.forEach((c) => {
                  all[c.client.id] = true;
                });
                setChecked(all);
              }}
              style={{
                padding: "3px 10px",
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "rgba(255,255,255,0.4)",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Select All
            </button>
            <button
              onClick={() => {
                const none: Record<string, boolean> = {};
                clientsWithForms.forEach((c) => {
                  none[c.client.id] = false;
                });
                setChecked(none);
              }}
              style={{
                padding: "3px 10px",
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "rgba(255,255,255,0.4)",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              None
            </button>
          </div>
        </div>

        {/* Client list */}
        <div style={{ maxHeight: 260, overflowY: "auto", padding: "8px 0" }}>
          {clientsWithForms.length === 0 ? (
            <p
              style={{
                padding: "2rem",
                textAlign: "center",
                fontSize: 12,
                color: "rgba(255,255,255,0.25)",
              }}
            >
              No clients have 2307s for {quarter} {yearStr}.
            </p>
          ) : (
            clientsWithForms.map(({ client, forms }) => (
              <div
                key={client.id}
                onClick={() =>
                  setChecked((prev) => ({
                    ...prev,
                    [client.id]: !prev[client.id],
                  }))
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 20px",
                  cursor: "pointer",
                  background: checked[client.id]
                    ? "rgba(99,102,241,0.06)"
                    : "transparent",
                  borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    border: `1.5px solid ${
                      checked[client.id]
                        ? "#6366f1"
                        : "rgba(255,255,255,0.2)"
                    }`,
                    background: checked[client.id] ? "#6366f1" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {checked[client.id] && (
                    <i
                      className="ti ti-check"
                      style={{ fontSize: 11, color: "#fff" }}
                    />
                  )}
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
                    {client.name}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.3)",
                      marginTop: 1,
                    }}
                  >
                    {client.tin || "No TIN"} · {forms.length} 2307
                    {forms.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Folder name input */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "0.5px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <i
              className="ti ti-folder"
              style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}
            />
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Output folder name
            </p>
            {!fsSupportedHint && (
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  background: "rgba(251,191,36,0.1)",
                  border: "0.5px solid rgba(251,191,36,0.25)",
                  borderRadius: 20,
                  color: "#fcd34d",
                }}
              >
                Falls back to Downloads
              </span>
            )}
          </div>
          <input
            value={folderName}
            onChange={(e) =>
              setFolderName(e.target.value.replace(/[/\\]/g, "-"))
            }
            placeholder={`SAWT-${quarter}-${yearStr}`}
            style={inputStyle}
          />
          {fsSupportedHint ? (
            <p
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.2)",
                marginTop: 5,
              }}
            >
              You&apos;ll be prompted to pick or create a folder — all files
              will be saved there.
            </p>
          ) : (
            <p
              style={{
                fontSize: 10,
                color: "rgba(251,191,36,0.5)",
                marginTop: 5,
              }}
            >
              Your browser doesn&apos;t support folder picking. Files will
              download to Downloads with the folder name as a filename prefix.
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "0.5px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            Will generate:{" "}
            <span style={{ color: "#a5b4fc", fontWeight: 600 }}>
              {selectedCount} DAT
            </span>
            ,{" "}
            <span style={{ color: "#a5b4fc", fontWeight: 600 }}>
              {selectedCount} Excel
            </span>
            ,{" "}
            <span style={{ color: "#a5b4fc", fontWeight: 600 }}>
              1 summary TXT
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                color: "rgba(255,255,255,0.5)",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() =>
                selectedCount > 0 &&
                onConfirm(
                  selectedClients,
                  quarter,
                  folderName.trim() || `SAWT-${quarter}-${yearStr}`
                )
              }
              disabled={selectedCount === 0}
              style={{
                padding: "8px 16px",
                background:
                  selectedCount > 0
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "rgba(255,255,255,0.06)",
                border: "none",
                borderRadius: 10,
                color: selectedCount > 0 ? "#fff" : "rgba(255,255,255,0.3)",
                fontSize: 13,
                fontWeight: 600,
                cursor: selectedCount > 0 ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              <i className="ti ti-folder-down" style={{ fontSize: 13 }} />{" "}
              Generate {selectedCount > 0 ? `(${selectedCount})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
