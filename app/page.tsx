"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import * as api from "@/lib/api";
import { THEMES, MOOD_OPTIONS, FONTS } from "@/lib/themes";

type Screen = "loading" | "welcome" | "setup-name" | "setup-weight" | "setup-milestones" | "setup-theme" | "setup-done" | "join" | "main";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [journey, setJourney] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [journal, setJournal] = useState<any[]>([]);
  const [on, setOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [celeb, setCeleb] = useState<any>(null);
  const [pts, setPts] = useState<any[]>([]);
  const [finale, setFinale] = useState(false);
  const [fireworks, setFireworks] = useState<any[]>([]);
  const [justChecked, setJustChecked] = useState(-1);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState("journey");
  const [jInput, setJInput] = useState({ weight: "", mood: "", note: "" });
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });
  const [authError, setAuthError] = useState("");
  const [setupData, setSetupData] = useState({ name: "", startKg: "", goalKg: "", theme: "pink", milestones: [] as any[] });
  const tRef = useRef<any>(null);
  const fwRef = useRef<any>(null);

  const supabase = createClient();

  // ============ INIT ============
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const prof = await api.getProfile(user.id);
        setProfile(prof);
        const journeys = await api.getMyJourneys(user.id);
        if (journeys.length > 0) {
          const j = journeys[0];
          setJourney(j);
          const ms = await api.getMilestones(j.id);
          setMilestones(ms);
          const je = await api.getJournalEntries(j.id);
          setJournal(je);
          setScreen("main");
        } else {
          setSetupData(p => ({ ...p, name: prof?.name || "" }));
          setScreen("setup-name");
        }
      } else {
        setScreen("welcome");
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) setUser(session.user);
      else { setUser(null); setScreen("welcome"); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!journey) return;
    const unsub = api.subscribeToJourney(journey.id, {
      onMilestoneCompleted: async () => {
        const ms = await api.getMilestones(journey.id);
        setMilestones(ms);
      },
      onMilestoneUncompleted: async () => {
        const ms = await api.getMilestones(journey.id);
        setMilestones(ms);
      },
      onJournalEntry: (data) => {
        setJournal(prev => [data, ...prev]);
      },
    });
    return () => { unsub(); };
  }, [journey?.id]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setOn(false); setTimeout(() => setOn(true), 60); }, [screen, activeTab]);

  // ============ THEME ============
  const themeKey = profile?.theme || setupData.theme || "pink";
  const T = THEMES[themeKey] || THEMES.pink;
  const f1 = FONTS.serif, f2 = FONTS.sans;

  // eslint-disable-next-line react/display-name
  const Btn = useMemo(() => ({ children, primary, onClick, disabled, style: s }: any) => (
    <button onClick={onClick} disabled={disabled} style={{ fontFamily: f2, padding: primary ? "13px 32px" : "10px 24px", borderRadius: 100, border: primary ? "none" : `1px solid ${T.brd}`, background: primary ? T.accent : "transparent", color: primary ? "#fff" : T.txt2, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" as const, fontWeight: 500, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, transition: "all .2s", width: "100%", ...s }}>{children}</button>
  ), [T, f2]);

  // eslint-disable-next-line react/display-name
  const Input = useMemo(() => ({ label, ...props }: any) => (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.txt3, textTransform: "uppercase" as const, marginBottom: 5 }}>{label}</div>}
      <input {...props} style={{ width: "100%", fontFamily: f2, fontSize: 14, padding: "12px 14px", border: `1px solid ${T.brd}`, borderRadius: 14, background: T.bg, color: T.txt, outline: "none", ...props.style }} />
    </div>
  ), [T, f2]);

  // ============ AUTH ============
  const handleAuth = async () => {
    setAuthError("");
    if (authMode === "signup") {
      const { error } = await api.signUp(authForm.email, authForm.password, authForm.name);
      if (error) { setAuthError(error.message); return; }
      // Supabase sends confirmation email by default. For dev, you can disable this in Auth settings.
      sToast("Check your email to confirm!");
    } else {
      const { error } = await api.signIn(authForm.email, authForm.password);
      if (error) { setAuthError(error.message); return; }
    }
    // Auth state change listener handles the rest
  };

  // ============ SETUP ============
  const finishSetup = async () => {
    if (!user) return;
    await api.updateProfile(user.id, { name: setupData.name, theme: setupData.theme });
    const { journey: j, error } = await api.createJourney({
      userId: user.id,
      title: `${setupData.name}'s journey`,
      startWeight: parseFloat(setupData.startKg),
      goalWeight: parseFloat(setupData.goalKg),
      milestones: setupData.milestones.map(m => ({
        targetKg: m.kg,
        rewardText: m.rw,
        emoji1: m.e,
        emoji2: m.e2 || "✨",
        themeMsg: m.msg || "",
      })),
    });
    if (error || !j) { sToast("Error creating journey"); return; }
    setJourney(j);
    setProfile(await api.getProfile(user.id));
    const ms = await api.getMilestones(j.id);
    setMilestones(ms);
    setScreen("setup-done");
  };

  // ============ MILESTONE LOGIC ============
  const completedIds = new Set(milestones.filter(m => m.milestone_completions?.length > 0).map(m => m.id));
  const mState = milestones.map(m => ({
    completed: m.milestone_completions?.length > 0,
    date: m.milestone_completions?.[0]?.completed_at
      ? new Date(m.milestone_completions[0].completed_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
      : null,
  }));
  const startKg = journey?.start_weight || 57;
  const goalKg = journey?.goal_weight || 47;
  const done = mState.filter(s => s.completed).length;
  const completedKgs = milestones.filter((_, i) => mState[i].completed).map(m => m.target_kg);
  const currentWeight = completedKgs.length > 0 ? Math.min(...completedKgs) : startKg;
  const lost = startKg - currentWeight;
  const totalToLose = startKg - goalKg;
  const pct = totalToLose > 0 ? Math.min(lost / totalToLose, 1) : 0;
  const nextIdx = mState.findIndex(s => !s.completed);
  const circ = 2 * Math.PI * 58;

  const toggleMilestone = async (i: number) => {
    if (!user || !journey) return;
    const m = milestones[i];
    const wasCompleted = mState[i].completed;

    if (!wasCompleted && i > 0 && !mState[i - 1].completed) { sToast(`reach ${milestones[i - 1].target_kg}kg first!`); return; }
    if (wasCompleted && i < milestones.length - 1 && mState[i + 1].completed) { sToast(`uncheck ${milestones[i + 1].target_kg}kg first`); return; }

    if (wasCompleted) {
      await api.uncompleteMilestone(m.id);
    } else {
      await api.completeMilestone(m.id, journey.id, user.id);
      setJustChecked(i);
      setCeleb({ ...m, idx: i });
      sToast(`${m.target_kg}kg — reward unlocked`);
      boom(i);
      setTimeout(() => setJustChecked(-1), 1200);
    }

    // Refresh milestones
    const ms = await api.getMilestones(journey.id);
    setMilestones(ms);
  };

  // ============ EFFECTS ============
  const sToast = (t: string) => { setToast(t); if (tRef.current) clearTimeout(tRef.current); tRef.current = setTimeout(() => setToast(null), 3500); };

  const boom = (idx: number) => {
    const m = milestones[idx];
    const emojis = [m.emoji_1, m.emoji_2, "✨", "🎉", "💫", "⭐"];
    const colors = [T.accent, T.accentL, T.lav, T.grn, "#f0c060"];
    const isLast = idx === milestones.length - 1;
    const count = isLast ? 150 : 80;
    const ps = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i, x: Math.random() * 100, emoji: emojis[i % emojis.length],
      c: colors[i % colors.length], s: Math.random() * (isLast ? 28 : 22) + 12,
      dl: Math.random() * (isLast ? 1.2 : 0.5), dur: Math.random() * (isLast ? 4 : 2.5) + 1.5,
      drift: (Math.random() - 0.5) * (isLast ? 200 : 120), rot: Math.random() * 900,
      useEmoji: i < (isLast ? 60 : 25), round: Math.random() > 0.5,
    }));
    setPts(ps);
    setTimeout(() => setPts([]), isLast ? 8000 : 5000);
  };

  const launchFw = useCallback(() => {
    const x = 15 + Math.random() * 70, y = 15 + Math.random() * 40;
    const emojis = ["🌸","✨","⭐","💫","🎀","💖","🎆","🎇","🌟","💎"];
    const colors = [T.accent, T.accentL, T.lav, "#FFD700", "#FF69B4", "#87CEEB"];
    const cnt = 12 + Math.floor(Math.random() * 10);
    const sparks = Array.from({ length: cnt }, (_, i) => {
      const angle = (i / cnt) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const dist = 40 + Math.random() * 80;
      const useEmoji = Math.random() < 0.35;
      return { id: `${Date.now()}-${Math.random()}`, sx: Math.cos(angle) * dist, sy: Math.sin(angle) * dist, color: colors[Math.floor(Math.random() * colors.length)], emoji: emojis[Math.floor(Math.random() * emojis.length)], size: useEmoji ? 14 + Math.random() * 10 : 3 + Math.random() * 5, dur: 0.6 + Math.random() * 0.8, useEmoji };
    });
    const fw = { id: Date.now() + Math.random(), x, y, sparks };
    setFireworks(prev => [...prev.slice(-40), fw]);
    setTimeout(() => setFireworks(prev => prev.filter(f => f.id !== fw.id)), 2500);
  }, [T]);

  useEffect(() => {
    if (finale) { launchFw(); setTimeout(launchFw, 300); setTimeout(launchFw, 600); fwRef.current = setInterval(() => { launchFw(); if (Math.random() > 0.4) setTimeout(launchFw, 150 + Math.random() * 300); }, 700); }
    else { clearInterval(fwRef.current); setFireworks([]); }
    return () => clearInterval(fwRef.current);
  }, [finale, launchFw]);

  const addEntry = async () => {
    if (!journey || !user || (!jInput.weight && !jInput.note)) return;
    const { data } = await api.addJournalEntry({ journeyId: journey.id, userId: user.id, weight: jInput.weight ? parseFloat(jInput.weight) : undefined, mood: jInput.mood || undefined, note: jInput.note || undefined });
    if (data) setJournal(prev => [data, ...prev]);
    setJInput({ weight: "", mood: "", note: "" });
    sToast("journal entry added");
  };

  // ============ SHARED UI ============

  // ============ LOADING ============
  if (screen === "loading") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, animation: "float 2s ease-in-out infinite", marginBottom: 12 }}>🎀</div>
        <div style={{ fontSize: 10, letterSpacing: 3, color: T.txt3, textTransform: "uppercase" }}>loading</div>
      </div>
    </div>
  );

  // ============ WELCOME + AUTH ============
  if (screen === "welcome") return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: f2, color: T.txt }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(20px)", transition: "all 1s cubic-bezier(.16,1,.3,1)", textAlign: "center", width: "100%" }}>
          <div style={{ fontSize: 56, marginBottom: 20, animation: "float 3s ease-in-out infinite" }}>🎀</div>
          <div style={{ fontFamily: f1, fontSize: 36, fontWeight: 400, fontStyle: "italic", marginBottom: 8 }}>Milestone</div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: T.txt3, textTransform: "uppercase", marginBottom: 32 }}>reward your journey</div>

          <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "24px 20px", marginBottom: 16, textAlign: "left" }}>
            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${T.brd}` }}>
              {(["signup", "signin"] as const).map(m => (
                <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }} style={{ flex: 1, fontFamily: f2, background: "none", border: "none", padding: "10px", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: authMode === m ? T.txt : T.txt3, fontWeight: authMode === m ? 500 : 400, cursor: "pointer", borderBottom: authMode === m ? `1.5px solid ${T.accent}` : "1.5px solid transparent", marginBottom: -1 }}>{m === "signup" ? "Sign up" : "Sign in"}</button>
              ))}
            </div>
            {authMode === "signup" && <Input label="Name" placeholder="Your name" value={authForm.name} onChange={(e: any) => setAuthForm(p => ({ ...p, name: e.target.value }))} />}
            <Input label="Email" type="email" placeholder="you@email.com" value={authForm.email} onChange={(e: any) => setAuthForm(p => ({ ...p, email: e.target.value }))} />
            <Input label="Password" type="password" placeholder="••••••••" value={authForm.password} onChange={(e: any) => setAuthForm(p => ({ ...p, password: e.target.value }))} />
            {authError && <div style={{ fontSize: 12, color: "#c44", marginBottom: 12 }}>{authError}</div>}
            <Btn primary onClick={handleAuth} disabled={!authForm.email || !authForm.password || (authMode === "signup" && !authForm.name)}>
              {authMode === "signup" ? "Create account" : "Sign in"}
            </Btn>
          </div>

          <Btn onClick={() => setScreen("join")} style={{ marginTop: 8 }}>I have an invite code</Btn>
        </div>
      </div>
    </div>
  );

  // ============ SETUP: NAME ============
  if (screen === "setup-name") return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: f2, color: T.txt }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "40px 24px", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 24, opacity: on ? 1 : 0, transition: "all .9s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: T.txt3, textTransform: "uppercase", marginBottom: 8 }}>step 1 of 4</div>
          <div style={{ fontFamily: f1, fontSize: 28, fontStyle: "italic" }}>What's your name?</div>
        </div>
        <div style={{ opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .7s cubic-bezier(.16,1,.3,1) .15s" }}>
          <Input label="Your name" placeholder="e.g. Mariam" value={setupData.name} onChange={(e: any) => setSetupData(p => ({ ...p, name: e.target.value }))} />
          <Btn primary onClick={() => setScreen("setup-weight")} disabled={!setupData.name.trim()}>Continue</Btn>
        </div>
      </div>
    </div>
  );

  // ============ SETUP: WEIGHT ============
  if (screen === "setup-weight") return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: f2, color: T.txt }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "40px 24px", position: "relative" }}>
        <div onClick={() => setScreen("setup-name")} style={{ fontSize: 13, color: T.txt3, cursor: "pointer", marginBottom: 16 }}>← back</div>
        <div style={{ textAlign: "center", marginBottom: 24, opacity: on ? 1 : 0, transition: "all .9s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: T.txt3, textTransform: "uppercase", marginBottom: 8 }}>step 2 of 4</div>
          <div style={{ fontFamily: f1, fontSize: 28, fontStyle: "italic" }}>Set your goal</div>
        </div>
        <div style={{ opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .7s cubic-bezier(.16,1,.3,1) .15s" }}>
          <Input label="Starting weight (kg)" type="number" step="0.1" placeholder="e.g. 57" value={setupData.startKg} onChange={(e: any) => setSetupData(p => ({ ...p, startKg: e.target.value }))} />
          <Input label="Goal weight (kg)" type="number" step="0.1" placeholder="e.g. 47" value={setupData.goalKg} onChange={(e: any) => setSetupData(p => ({ ...p, goalKg: e.target.value }))} />
          <Btn primary onClick={() => {
            const s = parseFloat(setupData.startKg), g = parseFloat(setupData.goalKg);
            if (!s || !g || g >= s) { sToast("goal must be less than start"); return; }
            const ms: { kg: number; rw: string; e: string; e2: string; msg: string }[] = []; for (let kg = s - 1; kg >= g; kg--) ms.push({ kg, rw: "", e: "🎯", e2: "✨", msg: "" });
            setSetupData(p => ({ ...p, milestones: ms }));
            setScreen("setup-milestones");
          }} disabled={!setupData.startKg || !setupData.goalKg}>Continue</Btn>
        </div>
      </div>
    </div>
  );

  // ============ SETUP: MILESTONES ============
  if (screen === "setup-milestones") return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: f2, color: T.txt }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "40px 24px 100px", position: "relative" }}>
        <div onClick={() => setScreen("setup-weight")} style={{ fontSize: 13, color: T.txt3, cursor: "pointer", marginBottom: 16 }}>← back</div>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: T.txt3, textTransform: "uppercase", marginBottom: 8 }}>step 3 of 4</div>
          <div style={{ fontFamily: f1, fontSize: 28, fontStyle: "italic" }}>Add rewards</div>
          <div style={{ fontSize: 12, color: T.txt2, marginTop: 8 }}>What do you get at each milestone?</div>
        </div>
        {setupData.milestones.map((m, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 18, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: f1, fontSize: 17, fontWeight: 500, minWidth: 48 }}>{m.kg} kg</span>
            <input placeholder="Reward..." value={m.rw} onChange={e => { const ms = [...setupData.milestones]; ms[i] = { ...ms[i], rw: e.target.value }; setSetupData(p => ({ ...p, milestones: ms })); }}
              style={{ flex: 1, fontFamily: f2, fontSize: 13, padding: "8px 10px", border: `1px solid ${T.brd}`, borderRadius: 10, background: T.bg, color: T.txt, outline: "none" }} />
            <input placeholder="🎯" value={m.e} onChange={e => { const ms = [...setupData.milestones]; ms[i] = { ...ms[i], e: e.target.value }; setSetupData(p => ({ ...p, milestones: ms })); }}
              style={{ width: 36, fontSize: 16, padding: "6px", border: `1px solid ${T.brd}`, borderRadius: 8, background: T.bg, textAlign: "center", outline: "none" }} />
          </div>
        ))}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 24px", background: T.bg }}>
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <Btn primary onClick={() => setScreen("setup-theme")} disabled={!setupData.milestones.some(m => m.rw.trim())}>Continue</Btn>
          </div>
        </div>
      </div>
    </div>
  );

  // ============ SETUP: THEME ============
  if (screen === "setup-theme") return (
    <div style={{ background: THEMES[setupData.theme].bg, minHeight: "100vh", fontFamily: f2, color: THEMES[setupData.theme].txt, transition: "background .5s" }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "40px 24px", position: "relative" }}>
        <div onClick={() => setScreen("setup-milestones")} style={{ fontSize: 13, color: THEMES[setupData.theme].txt3, cursor: "pointer", marginBottom: 16 }}>← back</div>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: THEMES[setupData.theme].txt3, textTransform: "uppercase", marginBottom: 8 }}>step 4 of 4</div>
          <div style={{ fontFamily: f1, fontSize: 28, fontStyle: "italic" }}>Pick your vibe</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
          {Object.entries(THEMES).map(([key, t]) => (
            <div key={key} onClick={() => setSetupData(p => ({ ...p, theme: key }))} style={{ background: t.card, border: `2px solid ${setupData.theme === key ? t.accent : t.brd}`, borderRadius: 18, padding: "20px 14px", textAlign: "center", cursor: "pointer", transition: "all .3s" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: t.accent, margin: "0 auto 10px", opacity: 0.8 }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: t.txt }}>{t.name}</div>
              <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 8 }}>
                {[t.accent, t.accentL, t.lav, t.grn].map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />)}
              </div>
            </div>
          ))}
        </div>
        <Btn primary onClick={finishSetup}>Create my journey</Btn>
      </div>
    </div>
  );

  // ============ SETUP DONE ============
  if (screen === "setup-done") return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: f2, color: T.txt }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(20px)", transition: "all 1s cubic-bezier(.16,1,.3,1)", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 20, animation: "float 3s ease-in-out infinite" }}>🎉</div>
          <div style={{ fontFamily: f1, fontSize: 28, fontStyle: "italic", marginBottom: 8 }}>You're all set!</div>
          <div style={{ fontSize: 13, color: T.txt2, marginBottom: 24, lineHeight: 1.6 }}>Share this code with your partner:</div>
          <div style={{ background: T.card, border: `2px solid ${T.accentL}`, borderRadius: 16, padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ fontFamily: f1, fontSize: 36, fontWeight: 500, letterSpacing: 6, color: T.accent }}>{journey?.invite_code}</div>
            <div style={{ fontSize: 10, color: T.txt3, marginTop: 6, letterSpacing: 1, textTransform: "uppercase" }}>partner invite code</div>
          </div>
          <Btn primary onClick={() => setScreen("main")}>Start my journey</Btn>
        </div>
      </div>
    </div>
  );

  // ============ JOIN ============
  if (screen === "join") return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: f2, color: T.txt }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "40px 24px", position: "relative" }}>
        <div onClick={() => setScreen("welcome")} style={{ fontSize: 13, color: T.txt3, cursor: "pointer", marginBottom: 16 }}>← back</div>
        <div style={{ textAlign: "center", marginBottom: 24, opacity: on ? 1 : 0, transition: "all .9s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: T.txt3, textTransform: "uppercase", marginBottom: 8 }}>partner mode</div>
          <div style={{ fontFamily: f1, fontSize: 28, fontStyle: "italic" }}>Join a journey</div>
          <div style={{ fontSize: 13, color: T.txt2, marginTop: 8 }}>Enter the invite code your partner shared</div>
        </div>
        <Input label="Invite code" placeholder="e.g. AB3K9X" value={authForm.name} onChange={(e: any) => setAuthForm(p => ({ ...p, name: e.target.value.toUpperCase() }))} style={{ textAlign: "center", fontSize: 24, fontFamily: f1, letterSpacing: 4 }} />
        <div style={{ fontSize: 12, color: T.txt3, textAlign: "center", marginBottom: 20 }}>You'll need to sign in first, then the code connects you</div>
        <Btn primary disabled={authForm.name.length < 4} onClick={async () => {
          if (!user) { sToast("Sign in first, then enter the code"); setScreen("welcome"); return; }
          const { data, error } = await api.joinByInviteCode(authForm.name);
          if (error || data?.error) { sToast(data?.error || "Invalid code"); return; }
          sToast("Connected!");
          window.location.reload();
        }}>Connect</Btn>
      </div>
    </div>
  );

  // ============ MAIN TRACKER ============
  if (screen !== "main" || !journey) return null;

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.txt, fontFamily: f2 }}>
      {/* Particles */}
      {pts.length > 0 && <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
        {pts.map(p => p.useEmoji ? (
          <div key={p.id} style={{ position: "absolute", top: -20, left: `${p.x}%`, fontSize: p.s, lineHeight: 1, "--drift": `${p.drift}px`, "--rot": `${p.rot}deg`, animation: `dropFade ${p.dur}s cubic-bezier(.2,0,.8,1) ${p.dl}s forwards` } as any}>{p.emoji}</div>
        ) : (
          <div key={p.id} style={{ position: "absolute", top: -10, left: `${p.x}%`, width: p.s * 0.4, height: p.s * (p.round ? 0.4 : 0.24), borderRadius: p.round ? "50%" : "3px", background: p.c, opacity: 0.9, "--drift": `${p.drift}px`, "--rot": `${p.rot}deg`, animation: `dropFade ${p.dur}s cubic-bezier(.2,0,.8,1) ${p.dl}s forwards` } as any} />
        ))}
      </div>}

      {/* Toast */}
      {toast && <div style={{ position: "fixed", top: 16, left: "50%", zIndex: 10000, background: "rgba(255,255,255,.94)", border: `1px solid ${T.accentL}`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", color: T.accent, padding: "11px 26px", borderRadius: 100, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", boxShadow: `0 8px 32px ${T.accent}1f`, animation: "toastSlide .55s cubic-bezier(.16,1,.3,1) forwards" }}>🎉 {toast}</div>}

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 0 50px" }}>
        {/* Header */}
        <div style={{ padding: "40px 24px 16px", textAlign: "center", opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .9s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: T.txt3, textTransform: "uppercase", marginBottom: 8 }}>rewards</div>
          <div style={{ fontFamily: f1, fontSize: 30, fontWeight: 400, fontStyle: "italic", lineHeight: 1.2 }}>{journey.title}</div>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <span style={{ fontFamily: f1, fontSize: 13, fontStyle: "italic", color: T.txt3 }}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
            <span style={{ color: T.accentL, fontSize: 10 }}>·</span>
            <span style={{ fontFamily: f1, fontSize: 13, fontStyle: "italic", color: T.accent, fontVariantNumeric: "tabular-nums" }}>{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }).toLowerCase()}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.grn, animation: "pulse 3s ease-in-out infinite" }} />
            <span style={{ fontSize: 9, letterSpacing: 2, color: T.grn, textTransform: "uppercase", opacity: 0.7 }}>synced live</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", justifyContent: "center", margin: "0 20px 12px", borderBottom: `1px solid ${T.brd}`, opacity: on ? 1 : 0, transition: "opacity .7s ease .1s" }}>
          {["journey", "rewards", "journal", "settings"].map(t => <button key={t} onClick={() => setActiveTab(t)} style={{ fontFamily: f2, background: "none", border: "none", padding: "11px 14px", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" as const, color: activeTab === t ? T.txt : T.txt3, fontWeight: activeTab === t ? 500 : 400, cursor: "pointer", borderBottom: activeTab === t ? `1.5px solid ${T.accent}` : "1.5px solid transparent", marginBottom: -1, transition: "all .3s" }}>{t}</button>)}
        </div>

        {/* JOURNEY TAB */}
        {activeTab === "journey" && <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0 20px", opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(18px)", transition: "all .9s cubic-bezier(.16,1,.3,1) .12s" }}>
            <div style={{ position: "relative", width: 156, height: 156 }}>
              <svg viewBox="0 0 132 132" width="156" height="156" style={{ transform: "rotate(-90deg)", animation: "ringPulse 4s ease-in-out infinite" }}>
                <circle cx="66" cy="66" r="58" fill="none" stroke={T.accentL} strokeWidth="4" opacity=".5" />
                <circle cx="66" cy="66" r="58" fill="none" stroke={T.accent} strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontFamily: f1, fontSize: 40, fontWeight: 400, lineHeight: 1 }}>{Math.round(currentWeight)}</div>
                <div style={{ fontSize: 9, letterSpacing: 3, color: T.txt3, textTransform: "uppercase", marginTop: 5 }}>kilograms</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 1, marginTop: 24, background: T.card, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.brd}` }}>
              {[{ v: Math.round(lost), l: "lost", u: "kg" }, { v: done, l: "unlocked" }, { v: nextIdx >= 0 ? Math.round(milestones[nextIdx].target_kg) : 0, l: "next", u: nextIdx >= 0 ? "kg" : "" }].map((s, i) => (
                <div key={i} style={{ padding: "14px 20px", textAlign: "center", borderRight: i < 2 ? `1px solid ${T.brd}` : "none" }}>
                  <div style={{ fontFamily: f1, fontSize: 22, fontWeight: 500 }}>{nextIdx < 0 && i === 2 ? "🎉" : s.v}{s.u && <span style={{ fontSize: 11, color: T.txt3, marginLeft: 2, fontFamily: f2, fontWeight: 300 }}>{s.u}</span>}</div>
                  <div style={{ fontSize: 8, letterSpacing: 2, color: T.txt3, textTransform: "uppercase", marginTop: 3 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ padding: "0 28px", marginBottom: 20, opacity: on ? 1 : 0, transition: "opacity .7s ease .3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 9, letterSpacing: 1.5, color: T.txt3 }}>{startKg} kg</span>
              <span style={{ fontSize: 9, letterSpacing: 1.5, color: T.accent }}>{goalKg} kg</span>
            </div>
            <div style={{ height: 5, background: T.accentXL, borderRadius: 3, overflow: "hidden", position: "relative" }}>
              <div style={{ height: "100%", background: `linear-gradient(90deg,${T.accent},${T.lav})`, borderRadius: 3, width: `${pct * 100}%`, transition: "width 1.4s cubic-bezier(.16,1,.3,1)", position: "relative", overflow: "hidden", animation: "barPulse 2.5s ease-in-out infinite" }}>
                <div style={{ position: "absolute", top: 0, bottom: 0, width: "30%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent)", animation: "barShine 2s ease-in-out infinite", borderRadius: 3 }} />
              </div>
            </div>
          </div>

          {/* Milestone cards */}
          <div style={{ padding: "0 14px" }}>
            {milestones.map((m, i) => {
              const s = mState[i], isNx = i === nextIdx, jc = justChecked === i;
              const canCheck = s.completed || i === 0 || mState[i - 1]?.completed;
              return (
                <div key={m.id} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", marginBottom: 6,
                  background: s.completed ? "rgba(255,255,255,0.5)" : T.card,
                  border: `1px solid ${isNx ? T.accentL : T.brd}`, borderRadius: 18,
                  boxShadow: isNx ? `0 2px 16px ${T.accent}1a` : `0 1px 4px ${T.accent}0a`,
                  position: "relative", overflow: "hidden",
                  opacity: on ? (canCheck ? 1 : 0.45) : 0, transform: on ? "translateY(0)" : "translateY(20px)",
                  transition: `all .7s cubic-bezier(.16,1,.3,1) ${0.18 + i * 0.055}s`,
                  ...(jc ? { animation: "cardPop .6s cubic-bezier(.16,1,.3,1)" } : {}),
                }}>
                  {isNx && <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `linear-gradient(90deg,transparent 0%,${T.accent}0f 50%,transparent 100%)`, backgroundSize: "200% 100%", animation: "shimmer 3s ease-in-out infinite" }} />}
                  <div onClick={() => toggleMilestone(i)} style={{
                    width: 40, height: 40, minWidth: 40, borderRadius: "50%",
                    border: `2px solid ${s.completed ? T.grn : canCheck ? T.accentL : T.txt3 + "4d"}`,
                    background: s.completed ? T.grnBg : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: canCheck ? "pointer" : "default", transition: "all .35s cubic-bezier(.16,1,.3,1)",
                    zIndex: 2, position: "relative",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.grn} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ opacity: s.completed ? 1 : 0, transform: s.completed ? "scale(1)" : "scale(.4)", transition: "all .4s cubic-bezier(.34,1.56,.64,1)", ...(s.completed && jc ? { strokeDasharray: 30, animation: "checkDraw .4s ease .15s both" } : {}) }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {!s.completed && isNx && <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accentL, animation: "pulse 2s ease-in-out infinite" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, zIndex: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontFamily: f1, fontSize: 18, fontWeight: 500, color: s.completed ? T.txt3 : T.txt, textDecoration: s.completed ? "line-through" : "none" }}>{m.target_kg} kg</span>
                      <span style={{ fontSize: 14 }}>{m.emoji_1}{m.emoji_2}</span>
                      {isNx && <span style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase" as const, color: T.accent, background: T.accent + "14", padding: "2px 8px", borderRadius: 100, fontWeight: 500, border: `1px solid ${T.accent}26` }}>next</span>}
                      {!s.completed && !canCheck && <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 100, color: T.txt3, background: T.txt3 + "14" }}>🔒</span>}
                    </div>
                    {m.reward_text && <div style={{ fontSize: 12.5, color: s.completed ? T.txt3 : T.txt2, lineHeight: 1.4, textDecoration: s.completed ? "line-through" : "none" }}>{m.reward_text}</div>}
                    {s.date && <div style={{ fontSize: 9, color: T.grn, marginTop: 4, fontWeight: 500, ...(jc ? { animation: "stampIn .5s cubic-bezier(.34,1.56,.64,1) .2s both" } : {}) }}>completed {s.date}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>}

        {/* REWARDS TAB */}
        {activeTab === "rewards" && <div style={{ padding: "20px 14px" }}>
          <div style={{ textAlign: "center", marginBottom: 24, opacity: on ? 1 : 0, transition: "opacity .6s ease" }}>
            <div style={{ fontFamily: f1, fontSize: 18, fontStyle: "italic" }}>{done} of {milestones.length} unlocked</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {milestones.map((m, i) => { const s = mState[i]; return (
              <div key={m.id} style={{ background: s.completed ? T.grnBg : T.card, border: `1px solid ${s.completed ? T.grn + "40" : T.brd}`, borderRadius: 18, padding: "22px 12px 16px", textAlign: "center", opacity: on ? (s.completed ? 1 : 0.4) : 0, transform: on ? "translateY(0) scale(1)" : "translateY(14px) scale(.97)", transition: `all .65s cubic-bezier(.16,1,.3,1) ${.08 + i * .045}s` }}>
                <span style={{ fontSize: 30, display: "block", marginBottom: 8, ...(s.completed ? { animation: `float 3.5s ease-in-out infinite`, animationDelay: `${i * .25}s` } : { filter: "grayscale(.8) opacity(.5)" }) }}>{m.emoji_1}{m.emoji_2}</span>
                <div style={{ fontFamily: f1, fontSize: 16, fontWeight: 500, marginBottom: 5, color: s.completed ? T.txt : T.txt3 }}>{m.target_kg} kg</div>
                {m.reward_text && <div style={{ fontSize: 10.5, color: s.completed ? T.txt2 : T.txt3, lineHeight: 1.35 }}>{m.reward_text}</div>}
              </div>); })}
          </div>
        </div>}

        {/* JOURNAL TAB */}
        {activeTab === "journal" && <div style={{ padding: "20px 14px" }}>
          <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 16, opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .7s cubic-bezier(.16,1,.3,1) .1s" }}>
            <div style={{ fontFamily: f1, fontSize: 16, fontWeight: 500, fontStyle: "italic", marginBottom: 14 }}>New entry</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.txt3, textTransform: "uppercase", marginBottom: 5 }}>weight</div>
                <input type="number" step="0.1" placeholder="kg" value={jInput.weight} onChange={e => setJInput(p => ({ ...p, weight: e.target.value }))} style={{ width: "100%", fontFamily: f2, fontSize: 14, padding: "10px 12px", border: `1px solid ${T.brd}`, borderRadius: 12, background: T.bg, color: T.txt, outline: "none" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.txt3, textTransform: "uppercase", marginBottom: 5 }}>mood</div>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {MOOD_OPTIONS.slice(0, 5).map(mood => <button key={mood} onClick={() => setJInput(p => ({ ...p, mood: p.mood === mood ? "" : mood }))} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${jInput.mood === mood ? T.accent : T.brd}`, background: jInput.mood === mood ? T.accent + "14" : T.bg, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{mood}</button>)}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.txt3, textTransform: "uppercase", marginBottom: 5 }}>note</div>
              <textarea placeholder="How are you feeling?" value={jInput.note} onChange={e => setJInput(p => ({ ...p, note: e.target.value }))} rows={2} style={{ width: "100%", fontFamily: f2, fontSize: 13, padding: "10px 12px", border: `1px solid ${T.brd}`, borderRadius: 12, background: T.bg, color: T.txt, outline: "none", resize: "none", lineHeight: 1.5 }} />
            </div>
            <Btn primary onClick={addEntry} disabled={!jInput.weight && !jInput.note}>Add entry</Btn>
          </div>
          {journal.map((entry, i) => (
            <div key={entry.id} style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 18, padding: "16px 18px", marginBottom: 6, opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: `all .6s cubic-bezier(.16,1,.3,1) ${.15 + i * .04}s`, position: "relative" }}>
              <div onClick={() => api.deleteJournalEntry(entry.id).then(() => setJournal(j => j.filter(e => e.id !== entry.id)))} style={{ position: "absolute", top: 12, right: 14, fontSize: 11, color: T.txt3, cursor: "pointer", opacity: 0.5 }}>x</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: T.txt3 }}>{new Date(entry.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                {entry.mood && <span style={{ fontSize: 16 }}>{entry.mood}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                {entry.weight && <div style={{ fontFamily: f1, fontSize: 22, fontWeight: 500 }}>{entry.weight}<span style={{ fontSize: 12, color: T.txt3, fontFamily: f2, fontWeight: 300, marginLeft: 2 }}>kg</span></div>}
                {entry.note && <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5, flex: 1 }}>{entry.note}</div>}
              </div>
            </div>
          ))}
        </div>}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && <div style={{ padding: "20px 14px" }}>
          <div style={{ opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .7s cubic-bezier(.16,1,.3,1) .1s" }}>
            <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 12 }}>
              <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic", marginBottom: 14 }}>Partner code</div>
              <div style={{ fontFamily: f1, fontSize: 28, fontWeight: 500, letterSpacing: 4, color: T.accent, textAlign: "center", padding: "12px 0" }}>{journey.invite_code}</div>
              <div style={{ fontSize: 10, color: T.txt3, textAlign: "center" }}>Share with your partner</div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 12 }}>
              <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic", marginBottom: 14 }}>Theme</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {Object.entries(THEMES).map(([key, t]) => (
                  <div key={key} onClick={async () => { await api.updateProfile(user.id, { theme: key }); setProfile((p: any) => ({ ...p, theme: key })); }} style={{ padding: "12px 8px", borderRadius: 12, textAlign: "center", cursor: "pointer", border: `2px solid ${themeKey === key ? t.accent : T.brd}`, background: t.bg, transition: "all .3s" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: t.accent, margin: "0 auto 6px" }} />
                    <div style={{ fontSize: 10, color: t.txt }}>{t.name}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 12 }}>
              <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic", marginBottom: 8 }}>Account</div>
              <div style={{ fontSize: 12, color: T.txt2, marginBottom: 4 }}>{user?.email}</div>
              <div style={{ fontSize: 12, color: T.txt2 }}>{profile?.name} — {startKg}kg → {goalKg}kg</div>
            </div>
            <Btn onClick={async () => { await api.signOut(); setScreen("welcome"); }} style={{ marginTop: 8 }}>Sign out</Btn>
          </div>
        </div>}
      </div>

      {/* Celebration modal */}
      {celeb && <div onClick={() => setCeleb(null)} style={{ position: "fixed", inset: 0, background: `${T.bg}cc`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, animation: "fadeIn .35s ease forwards" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: T.card, border: `1px solid ${T.accentL}`, borderRadius: 24, padding: "40px 30px 32px", textAlign: "center", maxWidth: 310, width: "88%", boxShadow: `0 12px 48px ${T.accent}26`, animation: "celebPop .55s cubic-bezier(.16,1,.3,1) forwards" }}>
          <span style={{ fontSize: 48, display: "block", marginBottom: 18, animation: "celebEmoji .6s cubic-bezier(.34,1.56,.64,1) .2s both" }}>{celeb.emoji_1}{celeb.emoji_2}</span>
          <div style={{ fontFamily: f1, fontSize: 26, fontStyle: "italic", marginBottom: 6 }}>{celeb.target_kg} kg</div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: T.accent, textTransform: "uppercase", marginBottom: 14, fontWeight: 500 }}>reward unlocked</div>
          {celeb.theme_msg && <div style={{ fontSize: 13, color: T.accent, fontStyle: "italic", fontFamily: f1, marginBottom: 6, opacity: 0.8 }}>{celeb.theme_msg}</div>}
          <div style={{ fontSize: 14, color: T.txt2, lineHeight: 1.6, marginBottom: 28 }}>{celeb.reward_text}</div>
          <Btn primary onClick={() => { const isLast = celeb.idx === milestones.length - 1; setCeleb(null); if (isLast) setTimeout(() => setFinale(true), 200); }}>OKI LET'S GO</Btn>
        </div>
      </div>}

      {/* Finale */}
      {finale && <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: "linear-gradient(180deg, #1a1028 0%, #2a1538 30%, #1a1028 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn .6s ease forwards", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {fireworks.map(fw => (
            <div key={fw.id} style={{ position: "absolute", left: `${fw.x}%`, top: `${fw.y}%` }}>
              <div style={{ position: "absolute", left: "50%", top: "50%", width: 8, height: 8, borderRadius: "50%", background: "#fff", transform: "translate(-50%,-50%)", animation: "fwBurst .4s ease-out forwards", boxShadow: "0 0 20px #fff" }} />
              {fw.sparks.map((s: any) => (
                <div key={s.id} style={{ position: "absolute", left: 0, top: 0, "--sx": `${s.sx}px`, "--sy": `${s.sy}px`, animation: `fwSpark ${s.dur}s cubic-bezier(0,.6,.4,1) forwards` } as any}>
                  {s.useEmoji ? <span style={{ fontSize: s.size }}>{s.emoji}</span> : <div style={{ width: s.size, height: s.size, borderRadius: "50%", background: s.color, boxShadow: `0 0 ${s.size}px ${s.color}` }} />}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "0 30px" }}>
          <div style={{ animation: "finaleFloat 1s cubic-bezier(.16,1,.3,1) .3s forwards", opacity: 0 }}><div style={{ fontSize: 72, marginBottom: 20, animation: "finalePulse 2s ease-in-out infinite" }}>🎉✨🌟</div></div>
          <div style={{ animation: "finaleFloat 1s cubic-bezier(.16,1,.3,1) .6s forwards", opacity: 0 }}><div style={{ fontFamily: f1, fontSize: 38, fontStyle: "italic", color: "#fff", animation: "finaleGlow 3s ease-in-out infinite" }}>You did it!</div></div>
          <div style={{ animation: "finaleFloat 1s cubic-bezier(.16,1,.3,1) .9s forwards", opacity: 0 }}><div style={{ fontFamily: f1, fontSize: 18, fontStyle: "italic", color: "rgba(255,255,255,.6)", marginTop: 10 }}>Every single milestone.</div></div>
          <div style={{ animation: "finaleFloat 1s cubic-bezier(.16,1,.3,1) 1.2s forwards", opacity: 0 }}><div style={{ fontFamily: f1, fontSize: 17, fontStyle: "italic", color: T.accentL, marginTop: 20 }}>Time to claim every reward.</div></div>
          <div style={{ animation: "finaleFloat 1s cubic-bezier(.16,1,.3,1) 2s forwards", opacity: 0 }}>
            <button onClick={() => setFinale(false)} style={{ marginTop: 36, fontFamily: f2, padding: "14px 48px", borderRadius: 100, border: "1.5px solid rgba(240,200,216,.3)", background: "rgba(240,200,216,.1)", color: T.accentL, fontSize: 14, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", fontWeight: 600 }}>🌸 YAY 🌸</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
