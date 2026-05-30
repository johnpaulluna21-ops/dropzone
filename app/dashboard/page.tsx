import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UploadWorkspace from "@/components/upload/UploadWorkspace";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <>
      
      <main style={{
        minHeight: "100vh",
        background: "#0f0f0f",
        backgroundImage: "radial-gradient(circle at top left, rgba(99,102,241,0.08) 0%, transparent 40%), radial-gradient(circle at bottom right, rgba(20,184,166,0.05) 0%, transparent 40%)",
        padding: "2rem 1.5rem",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "2rem",
            animation: "fadeUp 0.4s ease both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>⚡</div>
              <div>
                <h1 style={{ fontSize: 16, fontWeight: 600, color: "#fff", letterSpacing: "-0.3px" }}>
                  Asikaso
                </h1>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                  {user.email}
                </p>
              </div>
            </div>

            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                style={{
                  fontSize: 12, color: "rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.05)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  borderRadius: 8, padding: "6px 12px",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Sign out
              </button>
            </form>
          </div>

          {/* Upload Card */}
          <div style={{
            background: "#1a1a1a",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "1.75rem",
            animation: "fadeUp 0.4s 0.1s ease both",
            animationFillMode: "both",
          }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{
                fontSize: 17, fontWeight: 600, color: "#fff",
                letterSpacing: "-0.3px", marginBottom: 4,
              }}>
                Submit documents
              </h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
                Upload receipts and invoices — AI extracts and organizes everything automatically.
              </p>
            </div>
            <UploadWorkspace />
          </div>

        </div>
      </main>
    </>
  );
}