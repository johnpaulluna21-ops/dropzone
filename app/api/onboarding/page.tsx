/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function formatTin(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 9),
    digits.slice(9, 13),
  ].filter(Boolean);
  return parts.join("-");
}

function isValidTin(tin: string): boolean {
  return /^\d{3}-\d{3}-\d{3}-\d{4}$/.test(tin);
}

const pageStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .ob-input:focus { outline: none; border-color: rgba(99,102,241,0.5) !important; background: rgba(99,102,241,0.04) !important; }
  .ob-input::placeholder { color: rgba(255,255,255,0.2); }
  .ob-btn:hover:not(:disabled) { background: linear-gradient(135deg, #4f46e5, #7c3aed) !important; transform: translateY(-1px); }
`;

const inputStyle = {
  width: "100%", padding: "11px 14px",
  background: "rgba(255,255,255,0.04)",
  border: "0.5px solid rgba(255,255,255,0.1)",
  borderRadius: 12, color: "#fff", fontSize: 14,
  fontFamily: "inherit", transition: "all 0.2s ease",
};

const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 500,
  color: "rgba(255,255,255,0.4)" as const, letterSpacing: "0.5px",
  textTransform: "uppercase" as const, marginBottom: 6,
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tin, setTin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: clients } = await supabase
        .from("clients").select("id").eq("user_id", user.id).limit(1);
      if (clients && clients.length > 0) { router.replace("/dashboard"); return; }
      setCheckingSession(false);
    };
    check();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tin && !isValidTin(tin)) {
      setError("TIN format must be XXX-XXX-XXX-XXXX");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        tin: tin || null,
        user_id: user.id,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error || "Something went wrong");
      setLoading(false);
      return;
    }
    router.replace("/dashboard");
  };

  if (checkingSession) {
    return (
      <main style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style suppressHydrationWarning>{pageStyles}</style>
        <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </main>
    );
  }

  return (
    <>
      <style suppressHydrationWarning>{pageStyles}</style>
      <main style={{
        minHeight: "100vh", background: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem", fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: "2rem", animation: "fadeUp 0.5s ease both" }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>Asikaso</span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "2rem", animation: "fadeUp 0.5s 0.1s ease both", animationFillMode: "both" }}>
            <div style={{ marginBottom: "1.75rem" }}>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#fff", letterSpacing: "-0.4px", marginBottom: 6 }}>Set up your profile</h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>This helps Asikaso organize your tax documents correctly.</p>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input className="ob-input" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="dela Cruz" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input className="ob-input" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>
                    Middle Name <span style={{ color: "rgba(255,255,255,0.2)", marginLeft: 6, fontSize: 10 }}>optional</span>
                  </label>
                  <input className="ob-input" type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Santos" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>
                    TIN <span style={{ color: "rgba(255,255,255,0.2)", marginLeft: 6, fontSize: 10 }}>optional</span>
                  </label>
                  <input className="ob-input" type="text" value={tin} onChange={(e) => setTin(formatTin(e.target.value))} placeholder="000-000-000-0000" maxLength={17}
                    style={{ ...inputStyle, letterSpacing: "1px" }} />
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 5 }}>Format: XXX-XXX-XXX-XXXX</p>
                </div>
                {error && (
                  <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: 10, fontSize: 13, color: "rgba(239,68,68,0.9)" }}>
                    {error}
                  </div>
                )}
                <button className="ob-btn" type="submit" disabled={loading || !firstName || !lastName}
                  style={{
                    marginTop: 4, width: "100%", padding: "12px",
                    background: loading || !firstName || !lastName ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: loading || !firstName || !lastName ? "rgba(255,255,255,0.25)" : "#fff",
                    border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600,
                    cursor: loading || !firstName || !lastName ? "not-allowed" : "pointer",
                    fontFamily: "inherit", letterSpacing: "-0.1px", transition: "all 0.2s ease",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                  {loading ? (
                    <>
                      <div style={{ width: 14, height: 14, border: "1.5px solid rgba(255,255,255,0.2)", borderTop: "1.5px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      Setting up...
                    </>
                  ) : "Get started →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}