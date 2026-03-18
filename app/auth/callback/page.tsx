"use client";
import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fdf6f9" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ animation: "float 2s ease-in-out infinite", marginBottom: 12 }}>
          <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="28" fill="#d4829e" opacity="0.13"/>
            <circle cx="32" cy="32" r="22" stroke="#d4829e" strokeWidth="2.5" fill="none"/>
            <polyline points="22,33 29,40 42,26" fill="none" stroke="#d4829e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="50" cy="12" r="4" fill="#d4829e" opacity="0.5"/>
            <circle cx="54" cy="20" r="2" fill="#d4829e" opacity="0.35"/>
            <circle cx="12" cy="14" r="2.5" fill="#d4829e" opacity="0.4"/>
          </svg>
        </div>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#c8b8c4", textTransform: "uppercase" }}>signing you in...</div>
      </div>
    </div>
  );
}
