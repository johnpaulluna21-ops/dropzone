/**
 * components/tax/ResubmitModal.tsx
 *
 * Extracted from app/admin/tax/page.tsx — Step 1 structural cleanup.
 * Zero logic changes. UI only.
 *
 * Handles both single-client and batch resubmission warnings.
 */

"use client";
import { useState } from "react";
import { type BatchEmailItem } from "@/core/types/tax";

interface ResubmitModalProps {
  clientName: string;
  quarterNum: number;
  submittedAt: string;
  newClients?: BatchEmailItem[];
  duplicateClients?: BatchEmailItem[];
  onConfirmSkip?: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function ResubmitModal({
  clientName,
  quarterNum,
  submittedAt,
  newClients,
  duplicateClients,
  onConfirmSkip,
  onConfirm,
  onClose,
}: ResubmitModalProps) {
  const [resubmitInput, setResubmitInput] = useState("");
  const confirmed = resubmitInput.toLowerCase() === "resubmit";

  // suppress unused warning — quarterNum kept for future use in header copy
  void quarterNum;
  void submittedAt;
  void duplicateClients;

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
          maxWidth: 500,
          background: "#1a1a1a",
          border: "0.5px solid rgba(239,68,68,0.3)",
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
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              background: "rgba(239,68,68,0.1)",
              border: "0.5px solid rgba(239,68,68,0.3)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i
              className="ti ti-alert-triangle"
              style={{ fontSize: 18, color: "#fca5a5" }}
            />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
              Duplicate Submission Detected
            </p>
            <p
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                marginTop: 2,
              }}
            >
              Some clients were already submitted to BIR
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>
          {/* Already submitted */}
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(239,68,68,0.06)",
              border: "0.5px solid rgba(239,68,68,0.2)",
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#fca5a5",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              ⚠️ Already Submitted
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#fca5a5",
                whiteSpace: "pre-line",
                lineHeight: 1.8,
              }}
            >
              {clientName}
            </p>
          </div>

          {/* New clients ready */}
          {newClients && newClients.length > 0 && (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(16,185,129,0.06)",
                border: "0.5px solid rgba(16,185,129,0.2)",
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6ee7b7",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                ✅ Ready for First Submission
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "#6ee7b7",
                  whiteSpace: "pre-line",
                  lineHeight: 1.8,
                }}
              >
                {newClients
                  .map(
                    (item) =>
                      `${item.client.last_name || ""}, ${item.client.first_name || ""}`.trim()
                  )
                  .join("\n")}
              </p>
            </div>
          )}

          <p
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              marginBottom: 12,
              lineHeight: 1.6,
            }}
          >
            {onConfirmSkip
              ? `To send only new clients, click "Skip Duplicates". To send all including duplicates, type resubmit below.`
              : `Type resubmit below to confirm sending again.`}
          </p>

          <input
            value={resubmitInput}
            onChange={(e) => setResubmitInput(e.target.value)}
            placeholder="Type resubmit to send all..."
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "rgba(255,255,255,0.06)",
              border: `0.5px solid ${
                confirmed
                  ? "rgba(239,68,68,0.5)"
                  : "rgba(255,255,255,0.1)"
              }`,
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              marginBottom: 16,
            }}
            autoFocus
          />

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
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
            {onConfirmSkip && (
              <button
                onClick={onConfirmSkip}
                style={{
                  padding: "8px 16px",
                  background: "rgba(16,185,129,0.15)",
                  border: "0.5px solid rgba(16,185,129,0.3)",
                  borderRadius: 10,
                  color: "#6ee7b7",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Skip Duplicates &amp; Send {newClients?.length} New
              </button>
            )}
            <button
              onClick={() => confirmed && onConfirm()}
              disabled={!confirmed}
              style={{
                padding: "8px 16px",
                background: confirmed
                  ? "rgba(239,68,68,0.2)"
                  : "rgba(255,255,255,0.04)",
                border: `0.5px solid ${
                  confirmed
                    ? "rgba(239,68,68,0.4)"
                    : "rgba(255,255,255,0.08)"
                }`,
                borderRadius: 10,
                color: confirmed ? "#fca5a5" : "rgba(255,255,255,0.2)",
                fontSize: 13,
                fontWeight: 600,
                cursor: confirmed ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              Send All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
