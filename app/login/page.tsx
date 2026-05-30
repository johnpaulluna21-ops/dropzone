"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace("/dashboard");
      else setCheckingSession(false);
    };
    checkSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.replace("/dashboard");
    }
  };

  if (checkingSession) {
    return (
      <main style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          width: 20,
          height: 20,
          border: "2px solid rgba(255,255,255,0.1)",
          borderTop: "2px solid #6366f1",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
      </main>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        .input-field:focus { outline: none; border-color: rgba(99,102,241,0.5) !important; background: rgba(99,102,241,0.04) !important; }
        .input-field::placeholder { color: rgba(255,255,255,0.2); }
        .login-btn:hover:not(:disabled) { background: linear-gradient(135deg, #4f46e5, #7c3aed) !important; transform: translateY(-1px); }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      <main style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        backgroundImage: `
          radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.1) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 80%, rgba(20,184,166,0.06) 0%, transparent 50%)
        `,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        fontFamily: "'Inter', sans-serif",
      }}>

        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Logo */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: "2.5rem",
            animation: "fadeUp 0.5s ease both",
          }}>
            <div style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}>⚡</div>
            <span style={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>
              Asikaso
            </span>
          </div>

          {/* Card */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "2rem",
            animation: "fadeUp 0.5s 0.1s ease both",
            animationFillMode: "both",
          }}>

            <div style={{ marginBottom: "1.75rem" }}>
              <h1 style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#fff",
                letterSpacing: "-0.4px",
                marginBottom: 6,
              }}>
                Welcome back
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                Sign in to your Asikaso account
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Email */}
                <div>
                  <label style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.4)",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}>
                    Email
                  </label>
                  <input
                    className="input-field"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      background: "rgba(255,255,255,0.04)",
                      border: "0.5px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      color: "#fff",
                      fontSize: 14,
                      fontFamily: "inherit",
                      transition: "all 0.2s ease",
                    }}
                  />
                </div>

                {/* Password */}
                <div>
                  <label style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.4)",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}>
                    Password
                  </label>
                  <input
                    className="input-field"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      background: "rgba(255,255,255,0.04)",
                      border: "0.5px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      color: "#fff",
                      fontSize: 14,
                      fontFamily: "inherit",
                      transition: "all 0.2s ease",
                    }}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div style={{
                    padding: "10px 14px",
                    background: "rgba(239,68,68,0.08)",
                    border: "0.5px solid rgba(239,68,68,0.2)",
                    borderRadius: 10,
                    fontSize: 13,
                    color: "rgba(239,68,68,0.9)",
                    animation: "fadeUp 0.2s ease both",
                  }}>
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  className="login-btn"
                  type="submit"
                  disabled={loading || !email || !password}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "12px",
                    background: loading || !email || !password
                      ? "rgba(255,255,255,0.06)"
                      : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    color: loading || !email || !password
                      ? "rgba(255,255,255,0.25)"
                      : "#fff",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: loading || !email || !password ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    letterSpacing: "-0.1px",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{
                        width: 14,
                        height: 14,
                        border: "1.5px solid rgba(255,255,255,0.2)",
                        borderTop: "1.5px solid #fff",
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                      }} />
                      Signing in...
                    </>
                  ) : "Sign in →"}
                </button>

              </div>
            </form>
          </div>

          {/* Signup link */}
          <p style={{
            textAlign: "center",
            marginTop: "1.25rem",
            fontSize: 13,
            color: "rgba(255,255,255,0.3)",
            animation: "fadeUp 0.5s 0.2s ease both",
            animationFillMode: "both",
          }}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" style={{
              color: "#a5b4fc",
              textDecoration: "none",
              fontWeight: 500,
            }}>
              Sign up free
            </Link>
          </p>

        </div>
      </main>
    </>
  );
}