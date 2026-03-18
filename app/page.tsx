"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import * as api from "@/lib/api";
import { THEMES, MOOD_OPTIONS, FONTS } from "@/lib/themes";

type Screen = "loading" | "welcome" | "setup-name" | "setup-weight" | "setup-milestones" | "setup-theme" | "setup-done" | "join" | "main";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [journey, setJourney] = useState<any>(null);
  const [isPartner, setIsPartner] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
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
  const [authLoading, setAuthLoading] = useState(false);
  const [emojiPicker, setEmojiPicker] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [editingMilestones, setEditingMilestones] = useState(false);
  const [editMs, setEditMs] = useState<any[]>([]);
  const [savingMs, setSavingMs] = useState(false);
  const [editEmojiPicker, setEditEmojiPicker] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [rewardClaims, setRewardClaims] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<Record<string, Array<{ userId: string; emoji: string }>>>({});
  const [reactionPicker, setReactionPicker] = useState<string | null>(null);
  const pendingInviteRef = useRef<string>("");
  const [setupData, setSetupData] = useState({ name: "", startKg: "", goalKg: "", theme: "pink", milestones: [] as any[] });
  const tRef = useRef<any>(null);
  const fwRef = useRef<any>(null);
  // ============ INIT ============
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const prof = await api.getProfile(firebaseUser.uid);
          setProfile(prof);

          // Check if there's a pending invite code from the join screen
          const pending = pendingInviteRef.current;
          if (pending) {
            pendingInviteRef.current = "";
            try {
              const { error } = await api.joinByInviteCode(pending);
              if (error) { sToast(error.message || "Invalid invite code"); }
              else { sToast("Connected to partner's journey!"); }
            } catch { sToast("Failed to join — try the code again from settings"); }
          }

          const journeys = await api.getMyJourneys(firebaseUser.uid);
          // Also check partner journeys
          const partnerJourneys = await api.getPartnerJourneys(firebaseUser.uid);
          if (journeys.length > 0) {
            const j = journeys[0];
            setJourney(j);
            setIsPartner(false);
            const ms = await api.getMilestones(j.id);
            setMilestones(ms);
            const je = await api.getJournalEntries(j.id);
            setJournal(je);
            const claims = await api.getRewardClaims(j.id, ms.map((m: any) => m.id));
            setRewardClaims(claims);
            const rxns = await api.getReactionsForJourney(j.id, je.map((e: any) => e.id));
            setReactions(rxns);
            setScreen("main");
          } else if (partnerJourneys.length > 0) {
            // Partner joined someone else's journey — load that journey
            const pj = partnerJourneys[0] as any;
            const fullJourney = pj.journeys;
            setJourney(fullJourney);
            setIsPartner(true);
            // Load the journey owner's profile for their theme
            if (fullJourney.user_id) {
              const op = await api.getProfile(fullJourney.user_id);
              setOwnerProfile(op);
            }
            const ms = await api.getMilestones(fullJourney.id);
            setMilestones(ms);
            const je = await api.getJournalEntries(fullJourney.id);
            setJournal(je);
            const claims = await api.getRewardClaims(fullJourney.id, ms.map((m: any) => m.id));
            setRewardClaims(claims);
            const rxns = await api.getReactionsForJourney(fullJourney.id, je.map((e: any) => e.id));
            setReactions(rxns);
            setScreen("main");
          } else {
            setSetupData(p => ({ ...p, name: prof?.name || "" }));
            setScreen("setup-name");
          }
        } catch (err: any) {
          console.error("Failed to load journey data:", err);
          const msg = err?.message || "Failed to load data";
          if (msg.includes("permission")) {
            setLoadError("Firestore security rules are blocking access. Update your rules in the Firebase console (see firestore.rules in the repo for the correct rules).");
          } else {
            setLoadError(msg);
          }
        }
      } else {
        setUser(null);
        setScreen("welcome");
      }
    });
    return () => unsubscribe();
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!journey) return;
    const unsub = api.subscribeToJourney(journey.id, {
      onMilestoneCompleted: async (data) => {
        const ms = await api.getMilestones(journey.id);
        setMilestones(ms);
        // Notify partner when owner hits a milestone
        if (isPartner && data.completed_by !== user?.uid) {
          const m = milestones.find(m => m.id === data.milestone_id);
          if (m) sToast(`🎉 They just hit ${m.target_kg}kg!`);
        }
      },
      onMilestoneUncompleted: async () => {
        const ms = await api.getMilestones(journey.id);
        setMilestones(ms);
      },
      onJournalEntry: (data) => {
        setJournal(prev => [data, ...prev]);
        // Notify partner of new journal entries
        if (isPartner && data.user_id !== user?.uid) {
          sToast(data.weight ? `📝 New weigh-in: ${data.weight}kg` : "📝 New journal entry!");
        }
      },
    });
    return () => { unsub(); };
  }, [journey?.id]);

  // Check notification permission state
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifEnabled(Notification.permission === "granted");
    }
  }, []);

  // Foreground push message listener
  useEffect(() => {
    if (!notifEnabled) return;
    let unsub: (() => void) | undefined;
    api.onForegroundMessage((payload: any) => {
      sToast(payload?.notification?.body || "New notification");
    }).then(u => { unsub = u; });
    return () => { unsub?.(); };
  }, [notifEnabled]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { setOn(false); setTimeout(() => setOn(true), 60); }, [screen, activeTab]);

  // ============ THEME ============
  const themeKey = (isPartner ? ownerProfile?.theme : profile?.theme) || setupData.theme || "pink";
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
    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        await api.signUp(authForm.email, authForm.password, authForm.name);
        // onAuthStateChanged will pick up the new user and navigate to setup
      } else {
        const { error } = await api.signIn(authForm.email, authForm.password);
        if (error) setAuthError(error.message);
        // onAuthStateChanged will handle navigation
      }
    } catch (err: any) {
      setAuthError(err.message || "Something went wrong");
    } finally {
      setAuthLoading(false);
    }
  };

  // ============ SETUP ============
  const finishSetup = async () => {
    if (!user) { sToast("Not signed in"); setScreen("welcome"); return; }
    setCreating(true);
    try {
      await api.updateUserProfile(user.uid, { name: setupData.name, theme: setupData.theme });
      const { journey: j, error } = await api.createJourney({
        userId: user.uid,
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
      setProfile(await api.getProfile(user.uid));
      const ms = await api.getMilestones(j.id);
      setMilestones(ms);
      setScreen("setup-done");
    } catch (err: any) {
      console.error("finishSetup error:", err);
      sToast(err?.message || "Failed to create journey");
    } finally {
      setCreating(false);
    }
  };

  // ============ MILESTONE LOGIC ============
  const completedIds = new Set(milestones.filter(m => m.milestone_completions?.length > 0).map(m => m.id));
  const mState = milestones.map(m => ({
    completed: m.milestone_completions?.length > 0,
    date: m.milestone_completions?.[0]?.completed_at
      ? (m.milestone_completions[0].completed_at?.toDate?.() || new Date(m.milestone_completions[0].completed_at)).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
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
  const lastWeight = journal.find(e => e.weight)?.weight;
  const circ = 2 * Math.PI * 58;

  // Weight trend data (chronological, entries with weight only)
  const weightEntries = useMemo(() =>
    [...journal].reverse().filter(e => e.weight).map(e => ({
      weight: e.weight,
      date: e.created_at?.toDate?.() || new Date(e.created_at),
    })),
  [journal]);

  // Milestone ETA prediction based on weight trend (linear regression)
  const nextMilestoneEta = useMemo(() => {
    if (weightEntries.length < 2 || nextIdx < 0) return null;
    const targetKg = milestones[nextIdx].target_kg;
    // Use last 14 entries max for recent trend
    const recent = weightEntries.slice(-14);
    const n = recent.length;
    const t0 = recent[0].date.getTime();
    const xs = recent.map(e => (e.date.getTime() - t0) / (1000 * 60 * 60 * 24)); // days
    const ys = recent.map(e => e.weight);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
    const sumX2 = xs.reduce((a, x) => a + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    if (slope >= 0) return null; // not losing weight
    const intercept = (sumY - slope * sumX) / n;
    const daysToTarget = (targetKg - intercept) / slope;
    if (daysToTarget < 0 || daysToTarget > 365) return null;
    const eta = new Date(t0 + daysToTarget * 24 * 60 * 60 * 1000);
    return eta;
  }, [weightEntries, milestones, nextIdx]);

  // Motivational quotes — rotates daily
  const dailyQuote = useMemo(() => {
    const quotes = [
      { q: "The secret of getting ahead is getting started.", a: "Mark Twain" },
      { q: "Small daily improvements are the key to staggering long-term results.", a: "Unknown" },
      { q: "You don't have to be extreme, just consistent.", a: "Unknown" },
      { q: "Progress, not perfection.", a: "Unknown" },
      { q: "Every step forward counts, no matter how small.", a: "Unknown" },
      { q: "Believe you can and you're halfway there.", a: "Theodore Roosevelt" },
      { q: "It does not matter how slowly you go, as long as you do not stop.", a: "Confucius" },
      { q: "The only bad workout is the one that didn't happen.", a: "Unknown" },
      { q: "You are stronger than you think.", a: "Unknown" },
      { q: "What feels impossible today will one day be your warm-up.", a: "Unknown" },
      { q: "Be proud of how far you've come.", a: "Unknown" },
      { q: "A little progress each day adds up to big results.", a: "Unknown" },
      { q: "Discipline is choosing between what you want now and what you want most.", a: "Abraham Lincoln" },
      { q: "Your body hears everything your mind says. Stay positive.", a: "Unknown" },
      { q: "The journey of a thousand miles begins with a single step.", a: "Lao Tzu" },
      { q: "Don't wish for it. Work for it.", a: "Unknown" },
      { q: "Success is the sum of small efforts, repeated day in and day out.", a: "Robert Collier" },
      { q: "You are worth the effort.", a: "Unknown" },
      { q: "Fall seven times, stand up eight.", a: "Japanese Proverb" },
      { q: "The best project you'll ever work on is you.", a: "Unknown" },
    ];
    const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return quotes[day % quotes.length];
  }, []);

  // Weekly summary — stats for the last 7 days
  const weeklySummary = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    weekAgo.setHours(0, 0, 0, 0);
    const thisWeekEntries = journal.filter(e => {
      const d = e.created_at?.toDate?.() || new Date(e.created_at);
      return d >= weekAgo;
    });
    const thisWeekWeights = thisWeekEntries.filter(e => e.weight).map(e => e.weight);
    const weightChange = thisWeekWeights.length >= 2
      ? thisWeekWeights[0] - thisWeekWeights[thisWeekWeights.length - 1]
      : null;
    const milestonesThisWeek = milestones.filter((m, i) => {
      if (!mState[i]?.completed) return false;
      const comp = m.milestone_completions?.[0];
      if (!comp) return false;
      const d = comp.completed_at?.toDate?.() || comp.created_at?.toDate?.() || new Date(comp.created_at);
      return d >= weekAgo;
    }).length;
    return {
      entries: thisWeekEntries.length,
      weightChange,
      milestonesHit: milestonesThisWeek,
      hasData: thisWeekEntries.length > 0,
    };
  }, [journal, milestones, mState]);

  // Streak tracking — count consecutive days with journal entries ending today/yesterday
  const streak = useMemo(() => {
    if (journal.length === 0) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const entryDays = new Set(journal.map(e => {
      const d = e.created_at?.toDate?.() || new Date(e.created_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }));
    let count = 0;
    const check = new Date(today);
    // Allow streak to start from today or yesterday
    const todayKey = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
    if (!entryDays.has(todayKey)) {
      check.setDate(check.getDate() - 1);
      const yKey = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
      if (!entryDays.has(yKey)) return 0;
    }
    while (true) {
      const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
      if (!entryDays.has(key)) break;
      count++;
      check.setDate(check.getDate() - 1);
    }
    return count;
  }, [journal]);

  const toggleMilestone = async (i: number) => {
    if (!user || !journey) return;
    if (isPartner) { sToast("Only the journey owner can check milestones"); return; }
    const m = milestones[i];
    const wasCompleted = mState[i].completed;

    if (!wasCompleted && i > 0 && !mState[i - 1].completed) { sToast(`reach ${milestones[i - 1].target_kg}kg first!`); return; }
    if (wasCompleted && i < milestones.length - 1 && mState[i + 1].completed) { sToast(`uncheck ${milestones[i + 1].target_kg}kg first`); return; }

    if (wasCompleted) {
      if (!confirm(`Uncheck ${m.target_kg}kg? This will remove your progress.`)) return;
      const { error } = await api.uncompleteMilestone(m.id);
      if (error) { sToast("Failed to uncheck — try again"); return; }
    } else {
      const { error } = await api.completeMilestone(m.id, journey.id, user.uid);
      if (error) { sToast("Failed to check — try again"); return; }
      // Haptic feedback for milestone completion
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(i === milestones.length - 1 ? [100, 50, 100, 50, 200] : [80, 40, 120]);
      }
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

  // ============ SHARE CARD ============
  const generateShareCard = useCallback(async (): Promise<File | null> => {
    const dpr = 2;
    const W = 540 * dpr, H = 720 * dpr;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const s = (v: number) => v * dpr; // scale helper

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, T.bg);
    bg.addColorStop(0.5, T.accentXL);
    bg.addColorStop(1, T.bg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Decorative blobs
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = T.accent;
    ctx.beginPath(); ctx.arc(W * 0.82, H * 0.12, s(120), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.15, H * 0.88, s(90), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Card container with rounded rect
    const cx = s(30), cy = s(30), cw = W - s(60), ch = H - s(60), cr = s(28);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, cr);
    ctx.fill();
    ctx.strokeStyle = T.accentL;
    ctx.lineWidth = s(1.5);
    ctx.stroke();

    // Inner shadow glow
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, cr);
    ctx.clip();
    ctx.shadowColor = T.accent + "1a";
    ctx.shadowBlur = s(40);
    ctx.shadowOffsetY = s(4);
    ctx.fillStyle = "transparent";
    ctx.fill();
    ctx.restore();

    // Top accent bar
    const abg = ctx.createLinearGradient(cx, cy, cx + cw, cy);
    abg.addColorStop(0, T.accent);
    abg.addColorStop(1, T.accentL);
    ctx.fillStyle = abg;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, s(5), [cr, cr, 0, 0]);
    ctx.fill();

    // App title
    let y = s(70);
    ctx.fillStyle = T.txt3;
    ctx.font = `300 ${s(9)}px 'Nunito Sans', sans-serif`;
    ctx.letterSpacing = `${s(3)}px`;
    ctx.textAlign = "center";
    ctx.fillText("MILESTONE REWARDS", W / 2, y);
    ctx.letterSpacing = "0px";

    // Journey title
    y += s(30);
    ctx.fillStyle = T.txt;
    ctx.font = `italic 400 ${s(22)}px 'Cormorant Garamond', Georgia, serif`;
    ctx.fillText(journey?.title || "My Journey", W / 2, y);

    // Progress ring
    const ringCx = W / 2, ringCy = y + s(90), ringR = s(60), ringW = s(5);
    // Track
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = T.accentXL;
    ctx.lineWidth = ringW;
    ctx.stroke();
    // Progress arc
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * pct);
    const arcGrad = ctx.createLinearGradient(ringCx - ringR, ringCy, ringCx + ringR, ringCy);
    arcGrad.addColorStop(0, T.accent);
    arcGrad.addColorStop(1, T.lav);
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, startAngle, endAngle);
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = ringW;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.lineCap = "butt";
    // Ring center text
    ctx.fillStyle = T.txt;
    ctx.font = `400 ${s(36)}px 'Cormorant Garamond', Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(pct * 100)}%`, ringCx, ringCy - s(4));
    ctx.font = `300 ${s(9)}px 'Nunito Sans', sans-serif`;
    ctx.fillStyle = T.txt3;
    ctx.letterSpacing = `${s(2)}px`;
    ctx.fillText("COMPLETE", ringCx, ringCy + s(18));
    ctx.letterSpacing = "0px";
    ctx.textBaseline = "alphabetic";

    // Stats row
    const statsY = ringCy + ringR + s(36);
    const stats = [
      { v: `${Math.round(lost)}kg`, l: "LOST" },
      { v: `${done}/${milestones.length}`, l: "MILESTONES" },
      ...(streak > 0 ? [{ v: `${streak}🔥`, l: "STREAK" }] : []),
    ];
    const sw = s(120), gap = s(12);
    const totalW = stats.length * sw + (stats.length - 1) * gap;
    let sx = (W - totalW) / 2;
    for (const st of stats) {
      // Stat box
      ctx.fillStyle = T.bg;
      ctx.beginPath();
      ctx.roundRect(sx, statsY - s(18), sw, s(54), s(12));
      ctx.fill();
      ctx.strokeStyle = T.brd;
      ctx.lineWidth = s(1);
      ctx.stroke();
      // Value
      ctx.fillStyle = T.txt;
      ctx.font = `500 ${s(18)}px 'Cormorant Garamond', Georgia, serif`;
      ctx.textAlign = "center";
      ctx.fillText(st.v, sx + sw / 2, statsY + s(10));
      // Label
      ctx.fillStyle = T.txt3;
      ctx.font = `300 ${s(7)}px 'Nunito Sans', sans-serif`;
      ctx.letterSpacing = `${s(1.5)}px`;
      ctx.fillText(st.l, sx + sw / 2, statsY + s(28));
      ctx.letterSpacing = "0px";
      sx += sw + gap;
    }

    // Milestones list
    let my = statsY + s(58);
    const listX = s(60), listW = W - s(120);
    const visibleMs = milestones.slice(0, 6); // max 6 to fit
    for (let i = 0; i < visibleMs.length; i++) {
      const m = visibleMs[i];
      const completed = mState[i]?.completed;
      const rowH = s(34);

      // Row background
      if (i % 2 === 0) {
        ctx.fillStyle = T.bg + "80";
        ctx.beginPath();
        ctx.roundRect(listX - s(10), my - s(4), listW + s(20), rowH, s(8));
        ctx.fill();
      }

      // Checkbox
      const cbX = listX + s(6), cbY = my + s(8), cbR = s(9);
      ctx.beginPath();
      ctx.arc(cbX, cbY, cbR, 0, Math.PI * 2);
      if (completed) {
        ctx.fillStyle = T.grnBg;
        ctx.fill();
        ctx.strokeStyle = T.grn;
        ctx.lineWidth = s(1.5);
        ctx.stroke();
        // Checkmark
        ctx.beginPath();
        ctx.moveTo(cbX - s(4), cbY);
        ctx.lineTo(cbX - s(1), cbY + s(3.5));
        ctx.lineTo(cbX + s(4.5), cbY - s(3));
        ctx.strokeStyle = T.grn;
        ctx.lineWidth = s(2);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
      } else {
        ctx.strokeStyle = T.accentL;
        ctx.lineWidth = s(1.5);
        ctx.setLineDash([s(3), s(2)]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Weight text
      ctx.textAlign = "left";
      ctx.fillStyle = completed ? T.txt3 : T.txt;
      ctx.font = `italic 500 ${s(14)}px 'Cormorant Garamond', Georgia, serif`;
      const kgText = `${m.target_kg} kg`;
      ctx.fillText(kgText, cbX + s(18), my + s(13));

      // Reward text
      if (m.reward_text) {
        ctx.fillStyle = completed ? T.txt3 : T.txt2;
        ctx.font = `300 ${s(10)}px 'Nunito Sans', sans-serif`;
        const maxRwW = listW - s(80);
        let rw = m.reward_text;
        if (ctx.measureText(rw).width > maxRwW) rw = rw.substring(0, 20) + "…";
        ctx.textAlign = "right";
        ctx.fillText(rw, listX + listW + s(4), my + s(13));
      }

      // Strikethrough line for completed
      if (completed) {
        const kgW = ctx.measureText(kgText).width;
        ctx.textAlign = "left";
        ctx.font = `italic 500 ${s(14)}px 'Cormorant Garamond', Georgia, serif`;
        ctx.strokeStyle = T.txt3;
        ctx.lineWidth = s(0.8);
        ctx.beginPath();
        ctx.moveTo(cbX + s(18), my + s(10));
        ctx.lineTo(cbX + s(18) + ctx.measureText(kgText).width, my + s(10));
        ctx.stroke();
      }

      my += rowH;
    }
    if (milestones.length > 6) {
      ctx.textAlign = "center";
      ctx.fillStyle = T.txt3;
      ctx.font = `300 ${s(9)}px 'Nunito Sans', sans-serif`;
      ctx.fillText(`+${milestones.length - 6} more milestones`, W / 2, my + s(10));
    }

    // Bottom branding
    const bottomY = H - s(52);
    ctx.textAlign = "center";
    ctx.fillStyle = T.txt3;
    ctx.font = `300 ${s(9)}px 'Nunito Sans', sans-serif`;
    ctx.letterSpacing = `${s(2)}px`;
    ctx.fillText("SET GOALS · EARN REWARDS", W / 2, bottomY);
    ctx.letterSpacing = "0px";

    // Bottom accent bar
    const bbg = ctx.createLinearGradient(cx, 0, cx + cw, 0);
    bbg.addColorStop(0, T.accent);
    bbg.addColorStop(1, T.accentL);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = bbg;
    ctx.beginPath();
    ctx.roundRect(cx, H - s(34), cw, s(4), [0, 0, cr, cr]);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Convert to blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(null); return; }
        resolve(new File([blob], "milestone-progress.png", { type: "image/png" }));
      }, "image/png");
    });
  }, [T, journey, pct, lost, done, milestones, mState, streak, f1, f2]);

  const addEntry = async () => {
    if (!journey || !user || (!jInput.weight && !jInput.note)) return;
    const { data } = await api.addJournalEntry({ journeyId: journey.id, userId: user.uid, weight: jInput.weight ? parseFloat(jInput.weight) : undefined, mood: jInput.mood || undefined, note: jInput.note || undefined });
    if (data) setJournal(prev => [data, ...prev]);
    setJInput({ weight: "", mood: "", note: "" });
    sToast("journal entry added");
  };

  // ============ SHARED UI ============

  // ============ LOADING ============
  const Skel = ({ w, h, r, s }: { w: string | number; h: number; r?: number; s?: any }) => (
    <div style={{ width: w, height: h, borderRadius: r ?? 10, background: T.brd, animation: "skeletonPulse 1.5s ease-in-out infinite", ...s }} />
  );

  if (screen === "loading") return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: f2 }}>
      {loadError ? (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>😵‍💫</div>
            <div style={{ fontSize: 13, color: T.txt2, marginBottom: 6 }}>Something went wrong</div>
            <div style={{ fontSize: 10, color: T.txt3, marginBottom: 16, maxWidth: 260 }}>{loadError}</div>
            <button onClick={() => { setLoadError(null); window.location.reload(); }} style={{ fontFamily: f2, fontSize: 13, padding: "10px 24px", borderRadius: 12, border: `1px solid ${T.brd}`, background: T.card, color: T.txt, cursor: "pointer" }}>Try again</button>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 14px" }}>
          {/* Header skeleton */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 12px" }}>
            <Skel w={80} h={10} r={4} />
            <Skel w={180} h={28} r={6} s={{ marginTop: 10 }} />
            <Skel w={160} h={10} r={4} s={{ marginTop: 10 }} />
          </div>
          {/* Tabs skeleton */}
          <div style={{ display: "flex", gap: 20, justifyContent: "center", padding: "10px 0 18px" }}>
            {[60, 55, 50, 55].map((w, i) => <Skel key={i} w={w} h={12} r={4} />)}
          </div>
          {/* Progress ring skeleton */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 20px" }}>
            <Skel w={156} h={156} r={78} />
            <div style={{ display: "flex", gap: 1, marginTop: 24, width: "100%", maxWidth: 320 }}>
              {[1, 2, 3].map(i => <Skel key={i} w="33%" h={56} r={i === 1 ? "16px 0 0 16px" as any : i === 3 ? "0 16px 16px 0" as any : 0} />)}
            </div>
          </div>
          {/* Progress bar skeleton */}
          <div style={{ padding: "0 14px", marginBottom: 20 }}>
            <Skel w="100%" h={5} r={3} />
          </div>
          {/* Milestone cards skeleton */}
          <div style={{ padding: "0 0px" }}>
            {[1, 2, 3].map(i => (
              <Skel key={i} w="100%" h={70} r={16} s={{ marginBottom: 8 }} />
            ))}
          </div>
        </div>
      )}
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
            <Btn primary onClick={handleAuth} disabled={authLoading || !authForm.email || !authForm.password || (authMode === "signup" && !authForm.name)}>
              {authLoading ? "Please wait..." : authMode === "signup" ? "Create account" : "Sign in"}
            </Btn>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
              <div style={{ flex: 1, height: 1, background: T.brd }} />
              <span style={{ fontSize: 10, letterSpacing: 2, color: T.txt3, textTransform: "uppercase" }}>or</span>
              <div style={{ flex: 1, height: 1, background: T.brd }} />
            </div>

            <button onClick={async () => {
              setAuthError("");
              setAuthLoading(true);
              try {
                await api.signInWithGoogle();
              } catch (err: any) {
                setAuthError(err.message || "Google sign-in failed");
              } finally {
                setAuthLoading(false);
              }
            }} disabled={authLoading} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "12px 24px", borderRadius: 100, border: `1px solid ${T.brd}`, background: T.card,
              fontFamily: f2, fontSize: 13, letterSpacing: 0.5, color: T.txt, cursor: authLoading ? "default" : "pointer",
              opacity: authLoading ? 0.4 : 1, transition: "all .2s",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
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
            <div style={{ position: "relative" }}>
              <button onClick={() => setEmojiPicker(emojiPicker === i ? null : i)}
                style={{ width: 36, height: 36, fontSize: 16, padding: 0, border: `1px solid ${T.brd}`, borderRadius: 8, background: T.bg, textAlign: "center", cursor: "pointer", lineHeight: "36px" }}>
                {m.e}
              </button>
              {emojiPicker === i && (
                <div style={{ position: "absolute", right: 0, top: 40, background: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, padding: 8, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, zIndex: 100, boxShadow: `0 4px 20px rgba(0,0,0,.12)` }}>
                  {["🎯", "✨", "💎", "🌸", "🎀", "💖", "⭐", "🌟", "💫", "🎉", "🏆", "👑", "🦋", "🌺", "🍰", "🧁", "💅", "👗", "👠", "🛍️", "💄", "🎁", "🥂", "🍾"].map(em => (
                    <button key={em} onClick={() => { const ms = [...setupData.milestones]; ms[i] = { ...ms[i], e: em }; setSetupData(p => ({ ...p, milestones: ms })); setEmojiPicker(null); }}
                      style={{ width: 32, height: 32, fontSize: 18, border: "none", background: m.e === em ? T.accent + "22" : "transparent", borderRadius: 6, cursor: "pointer", lineHeight: "32px", padding: 0 }}>
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
        <Btn primary onClick={finishSetup} disabled={creating}>{creating ? "Creating..." : "Create my journey"}</Btn>
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
          <div onClick={() => { navigator.clipboard.writeText(journey?.invite_code || ""); sToast("Code copied!"); }} style={{ background: T.card, border: `2px solid ${T.accentL}`, borderRadius: 16, padding: "20px 24px", marginBottom: 24, cursor: "pointer", transition: "transform .15s", position: "relative" }}>
            <div style={{ fontFamily: f1, fontSize: 36, fontWeight: 500, letterSpacing: 6, color: T.accent }}>{journey?.invite_code}</div>
            <div style={{ fontSize: 10, color: T.txt3, marginTop: 6, letterSpacing: 1, textTransform: "uppercase" }}>tap to copy</div>
          </div>
          <Btn primary onClick={() => setScreen("main")}>Start my journey</Btn>
        </div>
      </div>
    </div>
  );

  // ============ JOIN ============
  const handleJoinAuth = async () => {
    if (!inviteCode || inviteCode.length < 4) { sToast("Enter the invite code first"); return; }
    setAuthError("");
    setAuthLoading(true);
    pendingInviteRef.current = inviteCode;
    try {
      if (authMode === "signup") {
        await api.signUp(authForm.email, authForm.password, authForm.name);
      } else {
        const { error } = await api.signIn(authForm.email, authForm.password);
        if (error) { setAuthError(error.message); pendingInviteRef.current = ""; }
      }
    } catch (err: any) {
      setAuthError(err.message || "Something went wrong");
      pendingInviteRef.current = "";
    } finally {
      setAuthLoading(false);
    }
  };

  const handleJoinGoogle = async () => {
    if (!inviteCode || inviteCode.length < 4) { sToast("Enter the invite code first"); return; }
    setAuthError("");
    setAuthLoading(true);
    pendingInviteRef.current = inviteCode;
    try {
      await api.signInWithGoogle();
    } catch (err: any) {
      setAuthError(err.message || "Google sign-in failed");
      pendingInviteRef.current = "";
    } finally {
      setAuthLoading(false);
    }
  };

  if (screen === "join") return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: f2, color: T.txt }}>
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "40px 24px", position: "relative" }}>
        <div onClick={() => { setScreen("welcome"); setInviteCode(""); setAuthError(""); }} style={{ fontSize: 13, color: T.txt3, cursor: "pointer", marginBottom: 16 }}>← back</div>
        <div style={{ textAlign: "center", marginBottom: 24, opacity: on ? 1 : 0, transition: "all .9s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: T.txt3, textTransform: "uppercase", marginBottom: 8 }}>partner mode</div>
          <div style={{ fontFamily: f1, fontSize: 28, fontStyle: "italic" }}>Join a journey</div>
          <div style={{ fontSize: 13, color: T.txt2, marginTop: 8 }}>Enter your partner's code, then sign in to connect</div>
        </div>

        {/* Invite code input */}
        <div style={{ background: T.card, border: `2px solid ${inviteCode.length >= 4 ? T.accent : T.brd}`, borderRadius: 20, padding: "20px 18px", marginBottom: 16, transition: "border-color .3s" }}>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.txt3, textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>invite code</div>
          <input placeholder="AB3K9X" value={inviteCode} onChange={(e: any) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            style={{ width: "100%", fontFamily: f1, fontSize: 28, padding: "10px 14px", border: "none", background: "transparent", color: T.txt, outline: "none", textAlign: "center", letterSpacing: 6 }} />
          {inviteCode.length >= 4 && <div style={{ fontSize: 10, color: T.accent, textAlign: "center", marginTop: 4 }}>code ready</div>}
        </div>

        {/* Auth form */}
        <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "24px 20px", marginBottom: 16, textAlign: "left", opacity: inviteCode.length >= 4 ? 1 : 0.4, pointerEvents: inviteCode.length >= 4 ? "auto" : "none", transition: "opacity .3s" }}>
          <div style={{ fontSize: 11, color: T.txt2, textAlign: "center", marginBottom: 14 }}>Now sign in to connect</div>
          <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${T.brd}` }}>
            {(["signup", "signin"] as const).map(m => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }} style={{ flex: 1, fontFamily: f2, background: "none", border: "none", padding: "10px", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: authMode === m ? T.txt : T.txt3, fontWeight: authMode === m ? 500 : 400, cursor: "pointer", borderBottom: authMode === m ? `1.5px solid ${T.accent}` : "1.5px solid transparent", marginBottom: -1 }}>{m === "signup" ? "Sign up" : "Sign in"}</button>
            ))}
          </div>
          {authMode === "signup" && <Input label="Name" placeholder="Your name" value={authForm.name} onChange={(e: any) => setAuthForm(p => ({ ...p, name: e.target.value }))} />}
          <Input label="Email" type="email" placeholder="you@email.com" value={authForm.email} onChange={(e: any) => setAuthForm(p => ({ ...p, email: e.target.value }))} />
          <Input label="Password" type="password" placeholder="••••••••" value={authForm.password} onChange={(e: any) => setAuthForm(p => ({ ...p, password: e.target.value }))} />
          {authError && <div style={{ fontSize: 12, color: "#c44", marginBottom: 12 }}>{authError}</div>}
          <Btn primary onClick={handleJoinAuth} disabled={authLoading || !authForm.email || !authForm.password || (authMode === "signup" && !authForm.name) || inviteCode.length < 4}>
            {authLoading ? "Connecting..." : authMode === "signup" ? "Sign up & join" : "Sign in & join"}
          </Btn>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: T.brd }} />
            <span style={{ fontSize: 10, letterSpacing: 2, color: T.txt3, textTransform: "uppercase" }}>or</span>
            <div style={{ flex: 1, height: 1, background: T.brd }} />
          </div>

          <button onClick={handleJoinGoogle} disabled={authLoading || inviteCode.length < 4} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "12px 24px", borderRadius: 100, border: `1px solid ${T.brd}`, background: T.card,
            fontFamily: f2, fontSize: 13, letterSpacing: 0.5, color: T.txt, cursor: authLoading ? "default" : "pointer",
            opacity: authLoading ? 0.4 : 1, transition: "all .2s",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google & join
          </button>
        </div>
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
      {toast && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10000, background: "rgba(255,255,255,.94)", border: `1px solid ${T.accentL}`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", color: T.accent, padding: "11px 26px", borderRadius: 100, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", boxShadow: `0 8px 32px ${T.accent}1f`, animation: "toastSlide .55s cubic-bezier(.16,1,.3,1) forwards" }}>🎉 {toast}</div>}

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 0 50px" }}>
        {/* Header */}
        <div style={{ padding: "40px 24px 16px", textAlign: "center", opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .9s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: T.txt3, textTransform: "uppercase", marginBottom: 8 }}>{isPartner ? "supporting" : "rewards"}</div>
          <div style={{ fontFamily: f1, fontSize: 30, fontWeight: 400, fontStyle: "italic", lineHeight: 1.2 }}>{journey.title}</div>
          {isPartner && <div style={{ display: "inline-block", marginTop: 8, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: T.lav, background: T.lav + "18", padding: "4px 14px", borderRadius: 100, border: `1px solid ${T.lav}30` }}>partner view</div>}
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
              {[{ v: Math.round(lost), l: "lost", u: "kg" }, { v: done, l: "unlocked" }, ...(streak > 0 ? [{ v: streak, l: "streak", u: "🔥", icon: true }] : []), { v: nextIdx >= 0 ? Math.round(milestones[nextIdx].target_kg) : 0, l: "next", u: nextIdx >= 0 ? "kg" : "" }].map((s, i, arr) => (
                <div key={i} style={{ padding: "14px 16px", textAlign: "center", borderRight: i < arr.length - 1 ? `1px solid ${T.brd}` : "none", flex: 1 }}>
                  <div style={{ fontFamily: f1, fontSize: 22, fontWeight: 500 }}>{nextIdx < 0 && s.l === "next" ? "🎉" : s.v}{s.u && <span style={{ fontSize: (s as any).icon ? 14 : 11, color: T.txt3, marginLeft: 2, fontFamily: f2, fontWeight: 300 }}>{s.u}</span>}</div>
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

          {/* Daily motivation + ETA */}
          <div style={{ padding: "0 14px", marginBottom: 12, opacity: on ? 1 : 0, transition: "opacity .7s ease .35s" }}>
            <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 18, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 12, right: 14, fontSize: 14, opacity: 0.3 }}>💭</div>
              <div style={{ fontFamily: f1, fontSize: 14, fontStyle: "italic", color: T.txt, lineHeight: 1.6, marginBottom: 4 }}>"{dailyQuote.q}"</div>
              <div style={{ fontSize: 10, color: T.txt3, letterSpacing: 0.5 }}>— {dailyQuote.a}</div>
              {nextMilestoneEta && nextIdx >= 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.brd}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📅</span>
                  <div>
                    <div style={{ fontSize: 11, color: T.accent, fontWeight: 500 }}>
                      ETA for {milestones[nextIdx].target_kg}kg: {nextMilestoneEta.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ fontSize: 9, color: T.txt3 }}>Based on your recent trend</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Weekly summary */}
          {weeklySummary.hasData && (
            <div style={{ padding: "0 14px", marginBottom: 12, opacity: on ? 1 : 0, transition: "opacity .7s ease .4s" }}>
              <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 18, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: T.txt3, textTransform: "uppercase" as const }}>this week</div>
                  <div style={{ fontSize: 12, opacity: 0.3 }}>📊</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {weeklySummary.weightChange !== null && (
                    <div style={{ flex: 1, background: weeklySummary.weightChange > 0 ? T.grnBg : T.bg, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontFamily: f1, fontSize: 18, fontWeight: 500, color: weeklySummary.weightChange > 0 ? T.grn : T.txt }}>
                        {weeklySummary.weightChange > 0 ? "-" : "+"}{Math.abs(Math.round(weeklySummary.weightChange * 10) / 10)}
                        <span style={{ fontSize: 10, fontFamily: f2, fontWeight: 300, marginLeft: 1 }}>kg</span>
                      </div>
                      <div style={{ fontSize: 8, letterSpacing: 1, color: T.txt3, textTransform: "uppercase" as const, marginTop: 2 }}>change</div>
                    </div>
                  )}
                  <div style={{ flex: 1, background: T.bg, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontFamily: f1, fontSize: 18, fontWeight: 500 }}>{weeklySummary.entries}</div>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: T.txt3, textTransform: "uppercase" as const, marginTop: 2 }}>entries</div>
                  </div>
                  {weeklySummary.milestonesHit > 0 && (
                    <div style={{ flex: 1, background: T.grnBg, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontFamily: f1, fontSize: 18, fontWeight: 500, color: T.grn }}>{weeklySummary.milestonesHit}</div>
                      <div style={{ fontSize: 8, letterSpacing: 1, color: T.txt3, textTransform: "uppercase" as const, marginTop: 2 }}>milestones</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Milestone cards */}
          <div style={{ padding: "0 14px" }}>
            {milestones.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: T.txt3 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
              <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic", marginBottom: 6 }}>No milestones yet</div>
              <div style={{ fontSize: 12 }}>Your milestones will appear here once your journey is set up</div>
            </div>}
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
                  <div onClick={() => !isPartner && toggleMilestone(i)} style={{
                    width: 40, height: 40, minWidth: 40, borderRadius: "50%",
                    border: `2px solid ${s.completed ? T.grn : canCheck && !isPartner ? T.accentL : T.txt3 + "4d"}`,
                    background: s.completed ? T.grnBg : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: canCheck && !isPartner ? "pointer" : "default", transition: "all .35s cubic-bezier(.16,1,.3,1)",
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

          {/* Share progress */}
          {!isPartner && done > 0 && (
            <div style={{ padding: "12px 14px 0", opacity: on ? 1 : 0, transition: "opacity .7s ease .5s" }}>
              <button onClick={async () => {
                sToast("Generating card...");
                const file = await generateShareCard();
                if (!file) { sToast("Couldn't generate card"); return; }
                const shareData: ShareData = {
                  title: "My Milestone Progress",
                  text: `🎯 ${done}/${milestones.length} milestones hit! Tracking with Milestone Rewards`,
                  files: [file],
                };
                if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.(shareData)) {
                  try { await navigator.share(shareData); }
                  catch { /* user cancelled */ }
                } else {
                  // Fallback: download the image
                  const url = URL.createObjectURL(file);
                  const a = document.createElement("a");
                  a.href = url; a.download = "milestone-progress.png";
                  document.body.appendChild(a); a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  sToast("Card saved!");
                }
              }} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px 20px", borderRadius: 16, border: `1px solid ${T.brd}`,
                background: T.card, fontFamily: f2, fontSize: 12, letterSpacing: 1,
                textTransform: "uppercase" as const, color: T.txt2, cursor: "pointer",
                transition: "all .2s",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.txt3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share progress
              </button>
            </div>
          )}
        </>}

        {/* REWARDS TAB */}
        {activeTab === "rewards" && <div style={{ padding: "20px 14px" }}>
          <div style={{ textAlign: "center", marginBottom: 8, opacity: on ? 1 : 0, transition: "opacity .6s ease" }}>
            <div style={{ fontFamily: f1, fontSize: 18, fontStyle: "italic" }}>{done} of {milestones.length} unlocked</div>
          </div>
          {done > 0 && (() => {
            const claimed = milestones.filter((m, i) => mState[i].completed && rewardClaims[m.id]).length;
            return (
              <div style={{ textAlign: "center", marginBottom: 20, opacity: on ? 1 : 0, transition: "opacity .6s ease .1s" }}>
                <div style={{ fontSize: 11, color: T.txt3 }}>{claimed} of {done} rewards claimed</div>
              </div>
            );
          })()}
          {milestones.length === 0 ? <div style={{ textAlign: "center", padding: "40px 20px", color: T.txt3 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎁</div>
            <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic", marginBottom: 6 }}>No rewards yet</div>
            <div style={{ fontSize: 12 }}>Rewards will unlock as you hit milestones</div>
          </div> : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {milestones.map((m, i) => { const s = mState[i]; const isClaimed = rewardClaims[m.id]; return (
              <div key={m.id} style={{ background: isClaimed ? T.grnBg : s.completed ? T.card : T.card, border: `1px solid ${isClaimed ? T.grn + "50" : s.completed ? T.accentL : T.brd}`, borderRadius: 18, padding: "22px 12px 12px", textAlign: "center", opacity: on ? (s.completed ? 1 : 0.4) : 0, transform: on ? "translateY(0) scale(1)" : "translateY(14px) scale(.97)", transition: `all .65s cubic-bezier(.16,1,.3,1) ${.08 + i * .045}s`, position: "relative", overflow: "hidden" }}>
                {isClaimed && <div style={{ position: "absolute", top: 8, right: 8, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" as const, color: T.grn, background: T.grn + "18", padding: "2px 7px", borderRadius: 100, fontWeight: 600 }}>claimed</div>}
                <span style={{ fontSize: 30, display: "block", marginBottom: 8, ...(s.completed ? { animation: `float 3.5s ease-in-out infinite`, animationDelay: `${i * .25}s` } : { filter: "grayscale(.8) opacity(.5)" }) }}>{m.emoji_1}{m.emoji_2}</span>
                <div style={{ fontFamily: f1, fontSize: 16, fontWeight: 500, marginBottom: 5, color: s.completed ? T.txt : T.txt3 }}>{m.target_kg} kg</div>
                {m.reward_text && <div style={{ fontSize: 10.5, color: s.completed ? T.txt2 : T.txt3, lineHeight: 1.35, marginBottom: s.completed ? 8 : 0 }}>{m.reward_text}</div>}
                {s.completed && !isPartner && (
                  <button onClick={async () => {
                    if (isClaimed) {
                      await api.unclaimReward(m.id, user.uid);
                      setRewardClaims(p => { const n = { ...p }; delete n[m.id]; return n; });
                    } else {
                      await api.claimReward(m.id, user.uid);
                      setRewardClaims(p => ({ ...p, [m.id]: true }));
                      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(50);
                      sToast(`${m.reward_text || m.target_kg + "kg reward"} claimed!`);
                    }
                  }} style={{
                    marginTop: 4, padding: "6px 16px", borderRadius: 100, fontSize: 10, letterSpacing: 1,
                    textTransform: "uppercase" as const, fontFamily: f2, cursor: "pointer",
                    border: isClaimed ? `1px solid ${T.grn}40` : `1px solid ${T.accent}40`,
                    background: isClaimed ? "transparent" : T.accent + "14",
                    color: isClaimed ? T.grn : T.accent, fontWeight: 500, transition: "all .2s",
                  }}>
                    {isClaimed ? "✓ Claimed" : "Claim reward"}
                  </button>
                )}
              </div>); })}
          </div>}
        </div>}

        {/* JOURNAL TAB */}
        {activeTab === "journal" && <div style={{ padding: "20px 14px" }}>
          {isPartner ? (
            /* Partner: send encouragement */
            <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 16, opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .7s cubic-bezier(.16,1,.3,1) .1s" }}>
              <div style={{ fontFamily: f1, fontSize: 16, fontWeight: 500, fontStyle: "italic", marginBottom: 14 }}>Send encouragement</div>
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 10 }}>
                {MOOD_OPTIONS.slice(0, 5).map(mood => <button key={mood} onClick={() => setJInput(p => ({ ...p, mood: p.mood === mood ? "" : mood }))} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${jInput.mood === mood ? T.accent : T.brd}`, background: jInput.mood === mood ? T.accent + "14" : T.bg, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{mood}</button>)}
              </div>
              <div style={{ marginBottom: 14 }}>
                <textarea placeholder="You're doing amazing! Keep going..." value={jInput.note} onChange={e => setJInput(p => ({ ...p, note: e.target.value }))} rows={2} style={{ width: "100%", fontFamily: f2, fontSize: 13, padding: "10px 12px", border: `1px solid ${T.brd}`, borderRadius: 12, background: T.bg, color: T.txt, outline: "none", resize: "none", lineHeight: 1.5 }} />
              </div>
              <Btn primary onClick={addEntry} disabled={!jInput.note}>Send note</Btn>
            </div>
          ) : (
            /* Owner: full journal entry */
            <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 16, opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .7s cubic-bezier(.16,1,.3,1) .1s" }}>
              <div style={{ fontFamily: f1, fontSize: 16, fontWeight: 500, fontStyle: "italic", marginBottom: 14 }}>New entry</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.txt3, textTransform: "uppercase", marginBottom: 5 }}>weight</div>
                  <input type="number" step="0.1" placeholder={lastWeight ? `${lastWeight} kg` : "kg"} value={jInput.weight} onChange={e => setJInput(p => ({ ...p, weight: e.target.value }))} onFocus={e => { if (!e.target.value && lastWeight) setJInput(p => ({ ...p, weight: String(lastWeight) })); }} style={{ width: "100%", fontFamily: f2, fontSize: 14, padding: "10px 12px", border: `1px solid ${T.brd}`, borderRadius: 12, background: T.bg, color: T.txt, outline: "none" }} />
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
          )}
          {/* Streak + Weight Chart */}
          {journal.length > 0 && <div style={{ marginBottom: 12, opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .7s cubic-bezier(.16,1,.3,1) .15s" }}>
            {streak > 0 && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "10px 14px", background: T.card, border: `1px solid ${T.brd}`, borderRadius: 14 }}>
              <span style={{ fontSize: 20 }}>🔥</span>
              <div>
                <div style={{ fontFamily: f1, fontSize: 18, fontWeight: 500 }}>{streak} day streak</div>
                <div style={{ fontSize: 10, color: T.txt3 }}>{streak === 1 ? "Keep it going!" : streak < 7 ? "Building momentum!" : streak < 30 ? "On fire!" : "Unstoppable!"}</div>
              </div>
            </div>}
            {weightEntries.length >= 2 && (() => {
              const W = 340, H = 120, px = 28, py = 16;
              const weights = weightEntries.map(e => e.weight);
              const minW = Math.min(...weights) - 0.5, maxW = Math.max(...weights) + 0.5;
              const rangeW = maxW - minW || 1;
              const pts = weightEntries.map((e, i) => ({
                x: px + (i / (weightEntries.length - 1)) * (W - px * 2),
                y: py + (1 - (e.weight - minW) / rangeW) * (H - py * 2),
                w: e.weight,
                d: e.date,
              }));
              const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
              const area = `${line} L${pts[pts.length - 1].x},${H - py} L${pts[0].x},${H - py} Z`;
              return (
                <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 18, padding: "16px 10px 10px", overflow: "hidden" }}>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.txt3, textTransform: "uppercase", marginBottom: 8, paddingLeft: 8 }}>weight trend</div>
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
                    {/* Goal line */}
                    {goalKg >= minW && goalKg <= maxW && <>
                      <line x1={px} y1={py + (1 - (goalKg - minW) / rangeW) * (H - py * 2)} x2={W - px} y2={py + (1 - (goalKg - minW) / rangeW) * (H - py * 2)} stroke={T.grn} strokeWidth="1" strokeDasharray="4 3" opacity=".5" />
                      <text x={W - px + 4} y={py + (1 - (goalKg - minW) / rangeW) * (H - py * 2) + 3} fontSize="8" fill={T.grn} opacity=".7">goal</text>
                    </>}
                    {/* Area fill */}
                    <path d={area} fill={T.accent} opacity=".08" />
                    {/* Line */}
                    <path d={line} fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Dots */}
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2.5} fill={i === pts.length - 1 ? T.accent : T.accentL} stroke={T.card} strokeWidth="1.5" />
                        {(i === 0 || i === pts.length - 1) && <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fontWeight="500" fill={T.txt2}>{p.w}</text>}
                      </g>
                    ))}
                    {/* Y axis labels */}
                    <text x={4} y={py + 3} fontSize="8" fill={T.txt3}>{Math.round(maxW)}</text>
                    <text x={4} y={H - py + 3} fontSize="8" fill={T.txt3}>{Math.round(minW)}</text>
                  </svg>
                </div>
              );
            })()}
          </div>}
          {journal.length === 0 && <div style={{ textAlign: "center", padding: "30px 20px", color: T.txt3 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
            <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic", marginBottom: 6 }}>No entries yet</div>
            <div style={{ fontSize: 12 }}>{isPartner ? "Journal entries will appear here" : "Log your first weigh-in above"}</div>
          </div>}
          {journal.map((entry, i) => {
            const entryReactions = reactions[entry.id] || [];
            const myReaction = entryReactions.find(r => r.userId === user?.uid);
            const isOwnEntry = entry.user_id === user?.uid;
            const reactionEmojis = ["👏", "💪", "🎉", "❤️", "🔥", "⭐"];
            return (
            <div key={entry.id} style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 18, padding: "16px 18px", marginBottom: 6, opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: `all .6s cubic-bezier(.16,1,.3,1) ${.15 + i * .04}s`, position: "relative" }}>
              {!isPartner && (confirmDelete === entry.id
                ? <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }}>
                    <button onClick={() => { api.deleteJournalEntry(entry.id).then(() => setJournal(j => j.filter(e => e.id !== entry.id))); setConfirmDelete(null); }} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, border: "none", background: "#c44", color: "#fff", cursor: "pointer", letterSpacing: 0.5 }}>delete</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, border: `1px solid ${T.brd}`, background: T.card, color: T.txt3, cursor: "pointer" }}>cancel</button>
                  </div>
                : <div onClick={() => setConfirmDelete(entry.id)} style={{ position: "absolute", top: 12, right: 14, fontSize: 11, color: T.txt3, cursor: "pointer", opacity: 0.5 }}>x</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: T.txt3 }}>{(entry.created_at?.toDate?.() || new Date(entry.created_at)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                {entry.mood && <span style={{ fontSize: 16 }}>{entry.mood}</span>}
                {isPartner && entry.user_id === user?.uid && <span style={{ fontSize: 8, letterSpacing: 1, color: T.lav, background: T.lav + "18", padding: "2px 6px", borderRadius: 100 }}>you</span>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                {entry.weight && <div style={{ fontFamily: f1, fontSize: 22, fontWeight: 500 }}>{entry.weight}<span style={{ fontSize: 12, color: T.txt3, fontFamily: f2, fontWeight: 300, marginLeft: 2 }}>kg</span></div>}
                {entry.note && <div style={{ fontSize: 13, color: T.txt2, lineHeight: 1.5, flex: 1 }}>{entry.note}</div>}
              </div>
              {/* Reactions */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                {/* Show existing reactions */}
                {entryReactions.length > 0 && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {Object.entries(entryReactions.reduce<Record<string, number>>((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})).map(([emoji, count]) => (
                      <span key={emoji} style={{
                        fontSize: 13, padding: "3px 8px", borderRadius: 100,
                        background: myReaction?.emoji === emoji ? T.accent + "1a" : T.bg,
                        border: `1px solid ${myReaction?.emoji === emoji ? T.accent + "40" : T.brd}`,
                        cursor: !isOwnEntry ? "pointer" : "default",
                        transition: "all .2s",
                      }} onClick={async () => {
                        if (isOwnEntry) return;
                        if (myReaction?.emoji === emoji) {
                          await api.removeReaction(entry.id, user.uid);
                          setReactions(p => ({ ...p, [entry.id]: (p[entry.id] || []).filter(r => r.userId !== user.uid) }));
                        } else {
                          if (myReaction) {
                            await api.removeReaction(entry.id, user.uid);
                          }
                          await api.addReaction(entry.id, user.uid, emoji);
                          setReactions(p => ({ ...p, [entry.id]: [...(p[entry.id] || []).filter(r => r.userId !== user.uid), { userId: user.uid, emoji }] }));
                        }
                      }}>
                        {emoji}{count > 1 && <span style={{ fontSize: 10, marginLeft: 2, color: T.txt3 }}>{count}</span>}
                      </span>
                    ))}
                  </div>
                )}
                {/* Add reaction button (only if not own entry) */}
                {!isOwnEntry && (
                  <div style={{ position: "relative" }}>
                    <button onClick={() => setReactionPicker(reactionPicker === entry.id ? null : entry.id)} style={{
                      width: 28, height: 28, borderRadius: "50%", border: `1px solid ${T.brd}`,
                      background: reactionPicker === entry.id ? T.accent + "14" : T.bg,
                      fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      color: T.txt3, transition: "all .2s", padding: 0,
                    }}>
                      {myReaction ? "😊" : "+"}
                    </button>
                    {reactionPicker === entry.id && (
                      <div style={{
                        position: "absolute", bottom: 34, left: "50%", transform: "translateX(-50%)",
                        background: T.card, border: `1px solid ${T.brd}`, borderRadius: 16,
                        padding: "6px 8px", display: "flex", gap: 2, zIndex: 50,
                        boxShadow: `0 4px 20px rgba(0,0,0,.12)`, animation: "celebPop .3s cubic-bezier(.16,1,.3,1)",
                      }}>
                        {reactionEmojis.map(emoji => (
                          <button key={emoji} onClick={async () => {
                            if (myReaction) {
                              await api.removeReaction(entry.id, user.uid);
                            }
                            await api.addReaction(entry.id, user.uid, emoji);
                            setReactions(p => ({
                              ...p,
                              [entry.id]: [...(p[entry.id] || []).filter(r => r.userId !== user.uid), { userId: user.uid, emoji }],
                            }));
                            setReactionPicker(null);
                            if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(30);
                          }} style={{
                            width: 34, height: 34, borderRadius: 8, border: "none",
                            background: myReaction?.emoji === emoji ? T.accent + "22" : "transparent",
                            fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "transform .15s",
                          }}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && <div style={{ padding: "20px 14px" }}>
          <div style={{ opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(14px)", transition: "all .7s cubic-bezier(.16,1,.3,1) .1s" }}>
            {isPartner && <div style={{ background: T.lav + "14", border: `1px solid ${T.lav}30`, borderRadius: 20, padding: "22px 18px", marginBottom: 12, textAlign: "center" }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.lav, textTransform: "uppercase", marginBottom: 6 }}>partner mode</div>
              <div style={{ fontFamily: f1, fontSize: 15, fontStyle: "italic", color: T.txt2, lineHeight: 1.5 }}>You're supporting this journey. You can view progress and send encouragement.</div>
            </div>}
            {!isPartner && <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 12 }}>
              <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic", marginBottom: 14 }}>Partner code</div>
              <div onClick={() => { navigator.clipboard.writeText(journey.invite_code || ""); sToast("Code copied!"); }} style={{ cursor: "pointer", padding: "12px 0" }}>
                <div style={{ fontFamily: f1, fontSize: 28, fontWeight: 500, letterSpacing: 4, color: T.accent, textAlign: "center" }}>{journey.invite_code}</div>
                <div style={{ fontSize: 10, color: T.txt3, textAlign: "center", marginTop: 4 }}>tap to copy</div>
              </div>
            </div>}
            {!isPartner && <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic" }}>Milestones</div>
                {!editingMilestones ? (
                  <button onClick={() => { setEditMs(milestones.map(m => ({ id: m.id, kg: m.target_kg, rw: m.reward_text, e: m.emoji_1, e2: m.emoji_2 || "✨", isNew: false, completed: m.milestone_completions?.length > 0 }))); setEditingMilestones(true); }}
                    style={{ fontSize: 10, letterSpacing: 1, color: T.accent, background: "none", border: `1px solid ${T.accent}40`, padding: "5px 12px", borderRadius: 8, cursor: "pointer", textTransform: "uppercase", fontFamily: f2 }}>Edit</button>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setEditingMilestones(false); setEditEmojiPicker(null); }}
                      style={{ fontSize: 10, letterSpacing: 1, color: T.txt3, background: "none", border: `1px solid ${T.brd}`, padding: "5px 12px", borderRadius: 8, cursor: "pointer", textTransform: "uppercase", fontFamily: f2 }}>Cancel</button>
                    <button disabled={savingMs} onClick={async () => {
                      setSavingMs(true);
                      try {
                        const existing = new Set(editMs.filter(m => !m.isNew).map(m => m.id));
                        // Delete removed milestones
                        for (const m of milestones) {
                          if (!existing.has(m.id)) await api.deleteMilestone(m.id);
                        }
                        // Update existing + add new
                        for (let i = 0; i < editMs.length; i++) {
                          const m = editMs[i];
                          if (m.isNew) {
                            await api.addMilestone(journey.id, { targetKg: parseFloat(m.kg), rewardText: m.rw, emoji1: m.e, emoji2: m.e2 || "✨", sortOrder: i });
                          } else {
                            await api.updateMilestone(m.id, { target_kg: parseFloat(m.kg), reward_text: m.rw, emoji_1: m.e, emoji_2: m.e2 || "✨", sort_order: i });
                          }
                        }
                        // Update journey goal weight to match lowest milestone
                        const newGoal = Math.min(...editMs.map(m => parseFloat(m.kg)));
                        if (newGoal && newGoal !== journey.goal_weight) {
                          await api.updateJourney(journey.id, { goal_weight: newGoal });
                          setJourney((j: any) => ({ ...j, goal_weight: newGoal }));
                        }
                        const ms = await api.getMilestones(journey.id);
                        setMilestones(ms);
                        setEditingMilestones(false);
                        setEditEmojiPicker(null);
                        sToast("Milestones saved!");
                      } catch (err: any) {
                        sToast(err.message || "Failed to save");
                      } finally {
                        setSavingMs(false);
                      }
                    }} style={{ fontSize: 10, letterSpacing: 1, color: "#fff", background: T.accent, border: "none", padding: "5px 12px", borderRadius: 8, cursor: savingMs ? "default" : "pointer", textTransform: "uppercase", fontFamily: f2, opacity: savingMs ? 0.5 : 1 }}>
                      {savingMs ? "..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
              {!editingMilestones ? (
                <div>
                  {milestones.map((m, i) => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < milestones.length - 1 ? `1px solid ${T.brd}` : "none" }}>
                      <span style={{ fontSize: 16 }}>{m.emoji_1}</span>
                      <span style={{ fontFamily: f1, fontSize: 15, fontWeight: 500, minWidth: 44 }}>{m.target_kg}kg</span>
                      <span style={{ fontSize: 12, color: T.txt2, flex: 1 }}>{m.reward_text}</span>
                      {mState[i]?.completed && <span style={{ fontSize: 10, color: T.grn }}>done</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  {editMs.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, position: "relative" }}>
                      <div style={{ position: "relative" }}>
                        <button onClick={() => setEditEmojiPicker(editEmojiPicker === i ? null : i)}
                          style={{ width: 34, height: 34, fontSize: 16, padding: 0, border: `1px solid ${T.brd}`, borderRadius: 8, background: T.bg, textAlign: "center", cursor: "pointer", lineHeight: "34px" }}>
                          {m.e}
                        </button>
                        {editEmojiPicker === i && (
                          <div style={{ position: "absolute", left: 0, top: 38, background: T.card, border: `1px solid ${T.brd}`, borderRadius: 12, padding: 8, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, zIndex: 100, boxShadow: `0 4px 20px rgba(0,0,0,.12)` }}>
                            {["🎯", "✨", "💎", "🌸", "🎀", "💖", "⭐", "🌟", "💫", "🎉", "🏆", "👑", "🦋", "🌺", "🍰", "🧁", "💅", "👗", "👠", "🛍️", "💄", "🎁", "🥂", "🍾"].map(em => (
                              <button key={em} onClick={() => { const ms = [...editMs]; ms[i] = { ...ms[i], e: em }; setEditMs(ms); setEditEmojiPicker(null); }}
                                style={{ width: 32, height: 32, fontSize: 18, border: "none", background: m.e === em ? T.accent + "22" : "transparent", borderRadius: 6, cursor: "pointer", lineHeight: "32px", padding: 0 }}>
                                {em}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input type="number" step="0.1" value={m.kg} onChange={e => { const ms = [...editMs]; ms[i] = { ...ms[i], kg: e.target.value }; setEditMs(ms); }}
                        style={{ width: 58, fontFamily: f1, fontSize: 14, padding: "7px 6px", border: `1px solid ${T.brd}`, borderRadius: 8, background: T.bg, color: T.txt, outline: "none", textAlign: "center" }} />
                      <input placeholder="Reward..." value={m.rw} onChange={e => { const ms = [...editMs]; ms[i] = { ...ms[i], rw: e.target.value }; setEditMs(ms); }}
                        style={{ flex: 1, fontFamily: f2, fontSize: 12, padding: "7px 8px", border: `1px solid ${T.brd}`, borderRadius: 8, background: T.bg, color: T.txt, outline: "none" }} />
                      <button onClick={() => setEditMs(editMs.filter((_, j) => j !== i))}
                        style={{ width: 28, height: 28, fontSize: 14, border: "none", background: "none", color: T.txt3, cursor: "pointer", padding: 0, opacity: 0.6 }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setEditMs([...editMs, { id: null, kg: "", rw: "", e: "🎯", e2: "✨", isNew: true, completed: false }])}
                    style={{ width: "100%", padding: "10px", border: `1px dashed ${T.brd}`, borderRadius: 10, background: "none", color: T.txt3, fontSize: 12, cursor: "pointer", fontFamily: f2 }}>+ Add milestone</button>
                </div>
              )}
            </div>}
            {!isPartner && <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 12 }}>
              <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic", marginBottom: 14 }}>Theme</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {Object.entries(THEMES).map(([key, t]) => (
                  <div key={key} onClick={async () => { await api.updateUserProfile(user.uid, { theme: key }); setProfile((p: any) => ({ ...p, theme: key })); }} style={{ padding: "12px 8px", borderRadius: 12, textAlign: "center", cursor: "pointer", border: `2px solid ${themeKey === key ? t.accent : T.brd}`, background: t.bg, transition: "all .3s" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: t.accent, margin: "0 auto 6px" }} />
                    <div style={{ fontSize: 10, color: t.txt }}>{t.name}</div>
                  </div>
                ))}
              </div>
            </div>}
            {isPartner && <div style={{ background: T.card, border: `1px solid ${T.brd}`, borderRadius: 20, padding: "22px 18px", marginBottom: 12 }}>
              <div style={{ fontFamily: f1, fontSize: 16, fontStyle: "italic", marginBottom: 14 }}>Notifications</div>
              {notifEnabled ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🔔</span>
                  <div>
                    <div style={{ fontSize: 13, color: T.txt }}>Push notifications enabled</div>
                    <div style={{ fontSize: 10, color: T.txt3 }}>You'll be notified when your partner hits milestones</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: T.txt2, marginBottom: 10, lineHeight: 1.5 }}>Get notified when your partner hits a milestone or logs a weigh-in</div>
                  <Btn primary onClick={async () => {
                    const token = await api.requestNotificationPermission();
                    if (token && user) {
                      await api.saveNotificationToken(user.uid, token);
                      setNotifEnabled(true);
                      sToast("Notifications enabled!");
                    } else if (token === null && "Notification" in window && Notification.permission === "denied") {
                      sToast("Notifications blocked — enable in browser settings");
                    } else {
                      sToast("Couldn't enable notifications");
                    }
                  }}>Enable notifications</Btn>
                </div>
              )}
            </div>}
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
