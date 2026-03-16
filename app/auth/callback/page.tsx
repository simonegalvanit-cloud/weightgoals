"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        router.push("/journey");
      }
    });
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fdf6f9" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, animation: "float 2s ease-in-out infinite", marginBottom: 12 }}>🎀</div>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#c8b8c4", textTransform: "uppercase" }}>signing you in...</div>
      </div>
    </div>
  );
}
