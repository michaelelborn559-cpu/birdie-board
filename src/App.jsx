import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase client ──────────────────────────────────────────────────────
const supabase = createClient(
  "https://ybzvotuypswnwzcxdfmw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlienZvdHV5cHN3bnd6Y3hkZm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDc0MTcsImV4cCI6MjA4OTcyMzQxN30.WOZILcmpsZWOl6P0K4X9C6TWE2e0u99XUZfddDWJQWk"
);

// ─── Storage helpers (Supabase data_store table) ──────────────────────────
const KEYS = {
  players: "bb:players",
  rounds: "bb:rounds",
  settings: "bb:settings",
  availability: "bb:availability",
  initialized: "bb:initialized",
  pending: "bb:pending",
  brackets: "bb:brackets",
  votes: "bb:votes",
};

async function sget(key) {
  try {
    const { data, error } = await supabase
      .from("data_store")
      .select("value")
      .eq("key", key)
      .single();
    if (error || !data) return null;
    return data.value;
  } catch { return null; }
}

async function sset(key, val) {
  try {
    await supabase
      .from("data_store")
      .upsert({ key, value: val, updated_at: new Date().toISOString() }, { onConflict: "key" });
  } catch {}
}

// ─── Revelstoke Golf Club Scorecard ───────────────────────────────────────
const REVELSTOKE = {
  name: "Revelstoke Golf Club",
  location: "Revelstoke, BC",
  par: 72,
  yards: 6537,
  rating: 71.2,
  slope: 127,
  holes: [
    { hole: 1,  par: 5, hcp: 15, yards: 460 },
    { hole: 2,  par: 4, hcp: 7,  yards: 368 },
    { hole: 3,  par: 3, hcp: 13, yards: 216 },
    { hole: 4,  par: 5, hcp: 11, yards: 482 },
    { hole: 5,  par: 4, hcp: 1,  yards: 396 },
    { hole: 6,  par: 4, hcp: 5,  yards: 441 },
    { hole: 7,  par: 3, hcp: 17, yards: 151 },
    { hole: 8,  par: 4, hcp: 3,  yards: 435 },
    { hole: 9,  par: 5, hcp: 9,  yards: 480 },
    { hole: 10, par: 5, hcp: 4,  yards: 543 },
    { hole: 11, par: 3, hcp: 12, yards: 177 },
    { hole: 12, par: 4, hcp: 2,  yards: 428 },
    { hole: 13, par: 4, hcp: 18, yards: 334 },
    { hole: 14, par: 3, hcp: 16, yards: 133 },
    { hole: 15, par: 5, hcp: 10, yards: 499 },
    { hole: 16, par: 4, hcp: 6,  yards: 405 },
    { hole: 17, par: 3, hcp: 14, yards: 157 },
    { hole: 18, par: 4, hcp: 8,  yards: 432 },
  ],
};

// ─── Styles ───────────────────────────────────────────────────────────────
const G = {
  bg: "#0a1a0a",
  surface: "#112211",
  card: "#162616",
  border: "#1e3a1e",
  green: "#2d7a2d",
  greenBright: "#3daa3d",
  greenGlow: "#4cce4c",
  gold: "#c9a84c",
  goldLight: "#e0c070",
  cream: "#f0ead8",
  muted: "#7a9a7a",
  red: "#c0392b",
  danger: "#e74c3c",
};

const font = `'Georgia', 'Times New Roman', serif`;
const mono = `'Courier New', 'Lucida Console', monospace`;

const globalStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=DM+Mono:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${G.bg}; color: ${G.cream}; font-family: 'Playfair Display', Georgia, serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${G.bg}; }
  ::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 3px; }
  input, select { font-family: 'DM Mono', monospace; }
  button { font-family: 'Playfair Display', Georgia, serif; cursor: pointer; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(77,206,77,0.4); } 50% { box-shadow: 0 0 0 8px rgba(77,206,77,0); } }
  @keyframes glow { 0%,100% { text-shadow: 0 0 8px rgba(201,168,76,0.5); } 50% { text-shadow: 0 0 20px rgba(201,168,76,0.9); } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;

// ─── Utility ──────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

function getBirdiedHoles(rounds, playerId) {
  const holes = new Set();
  rounds.filter(r => r.playerId === playerId).forEach(r => r.birdies.forEach(h => holes.add(h)));
  return holes;
}

function getCompletion(rounds, playerId) {
  return getBirdiedHoles(rounds, playerId).size;
}

function getCompletionDate(rounds, playerId) {
  const playerRounds = rounds.filter(r => r.playerId === playerId).sort((a, b) => a.date.localeCompare(b.date));
  let filled = new Set();
  for (const r of playerRounds) {
    r.birdies.forEach(h => filled.add(h));
    if (filled.size === 18) return r.date;
  }
  return null;
}

function getSeed(players, rounds) {
  const finished = players
    .map(p => ({ ...p, comp: getCompletion(rounds, p.id), finDate: getCompletionDate(rounds, p.id) }))
    .filter(p => p.comp === 18)
    .sort((a, b) => a.finDate.localeCompare(b.finDate));
  const seeds = {};
  finished.forEach((p, i) => { seeds[p.id] = i + 1; });
  return seeds;
}

function getHoleDifficulty(rounds, players) {
  const counts = {};
  for (let h = 1; h <= 18; h++) {
    const who = new Set();
    players.forEach(p => { if (getBirdiedHoles(rounds, p.id).has(h)) who.add(p.id); });
    counts[h] = who.size;
  }
  return counts;
}

function getHotStreaks(rounds, players) {
  const best = {};
  players.forEach(p => {
    const pr = rounds.filter(r => r.playerId === p.id);
    let max = 0;
    let bestRound = null;
    pr.forEach(r => {
      if (r.birdies.length > max) { max = r.birdies.length; bestRound = r; }
    });
    best[p.id] = { count: max, round: bestRound };
  });
  return best;
}

// ─── Components ───────────────────────────────────────────────────────────

function Btn({ children, onClick, variant = "primary", small, style: s = {} }) {
  const base = {
    border: "none", borderRadius: 4, fontWeight: 600,
    padding: small ? "6px 14px" : "10px 22px",
    fontSize: small ? 13 : 15,
    transition: "all 0.15s",
    cursor: "pointer",
    letterSpacing: "0.03em",
    ...s,
  };
  const variants = {
    primary: { background: G.green, color: G.cream, border: `1px solid ${G.greenBright}` },
    gold: { background: "transparent", color: G.gold, border: `1px solid ${G.gold}` },
    ghost: { background: "transparent", color: G.muted, border: `1px solid ${G.border}` },
    danger: { background: "transparent", color: G.danger, border: `1px solid ${G.danger}` },
  };
  return (
    <button style={{ ...base, ...variants[variant] }} onClick={onClick}
      onMouseEnter={e => { e.target.style.opacity = "0.8"; }}
      onMouseLeave={e => { e.target.style.opacity = "1"; }}>
      {children}
    </button>
  );
}

function Card({ children, style: s = {} }) {
  return (
    <div style={{
      background: G.card, border: `1px solid ${G.border}`,
      borderRadius: 8, padding: "20px", ...s
    }}>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, style: s = {} }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 11, color: G.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, fontFamily: mono }}>{label}</div>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", background: G.surface, border: `1px solid ${G.border}`,
          borderRadius: 4, padding: "9px 12px", color: G.cream, fontSize: 14,
          outline: "none", fontFamily: mono, ...s,
        }}
      />
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: G.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontFamily: mono }}>{children}</div>;
}

// ─── Side comp options ────────────────────────────────────────────────────
const SIDE_COMPS = [
  {
    id: "hole_hunter",
    emoji: "🎯",
    name: "Hole Hunter",
    pitch: "A featured hole is revealed every Monday. Birdie it that week, earn a point. First to 10 wins.",
    spice: "New target every week — changes the way you think about the round.",
  },
  {
    id: "hot_hand",
    emoji: "⚡",
    name: "Hot Hand",
    pitch: "Whoever has the most birdies across their last 3 rounds holds the crown. Anyone can take it at any time.",
    spice: "The crown changes hands constantly — great for group chat.",
  },
  {
    id: "skins_bank",
    emoji: "💰",
    name: "Skins Bank",
    pitch: "First to birdie a hole banks it. Someone else birdies it — they steal it. Most holes owned at season end wins.",
    spice: "Every birdie matters, even on holes you\'ve already birdied.",
  },
  {
    id: "streak_wars",
    emoji: "📈",
    name: "Streak Wars",
    pitch: "Longest consecutive-round streak with at least one birdie. Break the streak — start from zero.",
    spice: "Brutal. One bad round wipes everything.",
  },
  {
    id: "birdie_bingo",
    emoji: "🎲",
    name: "Birdie Bingo",
    pitch: "Everyone gets a random 3×3 card of holes at season start. Birdie a line — win.",
    spice: "Pure chaos. Depends entirely on which card you draw.",
  },
  {
    id: "the_snake",
    emoji: "🐍",
    name: "The Snake",
    pitch: "One player holds the snake. Out-birdie them in a shared round to steal it. Whoever holds it at season end loses.",
    spice: "Nobody wants to win. Keeps everyone on edge all season.",
  },
];

// ─── Login Screen ─────────────────────────────────────────────────────────
function LoginScreen({ players, onLogin, pending, onPendingChange, votes, onVotesChange }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "vote" | "done"
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [sName, setSName] = useState("");
  const [sPw, setSPw] = useState("");
  const [sPw2, setSPw2] = useState("");
  const [sHcp, setSHcp] = useState("");
  const [sErr, setSErr] = useState("");
  const [sSaving, setSSaving] = useState(false);
  const [pendingEntry, setPendingEntry] = useState(null);
  const [vote, setVote] = useState(null);
  const [voteSaving, setVoteSaving] = useState(false);
  const [nickname, setNickname] = useState(null);
  const [nicknameReason, setNicknameReason] = useState(null);

  function doLogin() {
    if (name === "Admin" && pw === "birdieboard2026") {
      onLogin({ id: "admin", name: "Admin", password: pw });
      return;
    }
    if (!name) { setErr("Enter your name"); return; }
    const player = players.find(p => p.name === name);
    if (!player) { setErr("Player not found — use Sign Up if you\'re new"); return; }
    if (player.password !== pw) { setErr("Wrong password"); return; }
    onLogin(player);
  }

  async function doSignup() {
    setSErr("");
    if (!sName.trim()) { setSErr("Name required"); return; }
    if (sName.trim().toLowerCase() === "admin") { setSErr("That name is reserved"); return; }
    if (players.find(p => p.name.toLowerCase() === sName.trim().toLowerCase())) { setSErr("Name already taken — try logging in"); return; }
    if (pending.find(p => p.name.toLowerCase() === sName.trim().toLowerCase())) { setSErr("You\'ve already requested — wait for admin approval"); return; }
    if (!sPw || sPw.length < 4) { setSErr("Password must be at least 4 characters"); return; }
    if (sPw !== sPw2) { setSErr("Passwords don\'t match"); return; }
    setSSaving(true);

    // Generate nickname via Claude API
    let generatedNick = null;
    let generatedReason = null;
    try {
      const hcpStr = sHcp ? `Their handicap index is ${sHcp}.` : "They haven\'t set a handicap yet.";
      const prompt = `You are generating a ridiculous golf nickname for a player joining a season-long birdie challenge competition called the Birdie Board at Revelstoke Golf Club in BC, Canada.

Player name: ${sName.trim()}
${hcpStr}

Generate:
1. A single ridiculous, funny golf nickname (2-5 words max, can include puns, alliteration, absurd imagery, golf references, or anything that would make their mates laugh)
2. A short 1-2 sentence private explanation of exactly why you chose that nickname for THIS specific person — be specific to their name or handicap, make it feel personal and a bit roast-y

Respond ONLY with valid JSON in this exact format, no markdown, no extra text:
{"nickname":"The nickname here","reason":"The private reason here"}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      generatedNick = parsed.nickname;
      generatedReason = parsed.reason;
    } catch (e) {
      // Fallback if API fails
      const fallbacks = ["The Bogey Banisher", "Captain Three-Putt", "The Fairway Phantom", "El Condor Grande", "The Green Reaper"];
      generatedNick = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      generatedReason = "Our nickname oracle had a moment — but this one suits you.";
    }

    setNickname(generatedNick);
    setNicknameReason(generatedReason);

    const entry = { id: uid(), name: sName.trim(), password: sPw, handicap: sHcp ? parseFloat(sHcp) : null, nickname: generatedNick, requestedAt: new Date().toISOString() };
    const updated = [...pending, entry];
    await onPendingChange(updated);
    setPendingEntry(entry);
    setSSaving(false);
    setMode("vote");
  }

  async function submitVote() {
    if (!vote) { return; }
    setVoteSaving(true);
    const updated = { ...votes, [pendingEntry.id]: { name: pendingEntry.name, vote, votedAt: new Date().toISOString() } };
    await onVotesChange(updated);
    setVoteSaving(false);
    setMode("done");
  }

  const bgStyle = { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", background: `radial-gradient(ellipse at 50% 0%, #0d2a0d 0%, ${G.bg} 70%)` };

  // ── Vote screen ────────────────────────────────────────────────────────
  if (mode === "vote") return (
    <div style={{ ...bgStyle, justifyContent: "flex-start" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Nickname reveal */}
        {nickname && (
          <div style={{ textAlign: "center", marginBottom: 24, padding: "16px 20px", background: "linear-gradient(135deg, #0f2a0f, #1a1a08)", border: `1px solid ${G.gold}`, borderRadius: 10, animation: "fadeIn 0.5s ease" }}>
            <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, letterSpacing: "0.15em", marginBottom: 6 }}>YOUR BIRDIE BOARD NICKNAME</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: G.gold, marginBottom: 10, lineHeight: 1.2 }}>{nickname}</div>
            <div style={{ height: 1, background: G.border, margin: "10px 0" }} />
            <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginBottom: 4, letterSpacing: "0.08em" }}>WHY? (ONLY YOU CAN SEE THIS)</div>
            <div style={{ fontSize: 13, color: G.cream, fontFamily: mono, lineHeight: 1.6, fontStyle: "italic" }}>{nicknameReason}</div>
          </div>
        )}

        {/* Competitions explainer */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: G.gold, letterSpacing: "0.2em", fontFamily: mono, marginBottom: 8 }}>SEASON 2026 — BIRDIE BOARD</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: G.cream, marginBottom: 6 }}>The Competitions</div>
          <div style={{ fontSize: 13, color: G.muted, fontFamily: mono, lineHeight: 1.6 }}>
            Three ways to compete this season. Prizes for all three will be decided on the night.
          </div>
        </div>

        {/* The three comps */}
        {[
          {
            icon: "⛳",
            title: "The Bracket",
            colour: G.greenGlow,
            desc: "Players split into 4 brackets by handicap. Within your bracket, you go head-to-head against one player for the whole season. First to birdie all 18 holes on the course wins your bracket.",
          },
          {
            icon: "🔢",
            title: "Net Birdie Board",
            colour: G.gold,
            desc: "Your handicap levels the playing field. A net birdie is a par score on a hole where you get a stroke. First to net-birdie all 18 holes wins — separate from the bracket, open to everyone.",
          },
          {
            icon: "🎉",
            title: "Side Comp",
            colour: "#b06ae0",
            desc: "A fun third competition for the whole group. Format decided by popular vote — you\'re choosing it right now. $ Prizes for all three competitions will be confirmed on draw night.",
          },
        ].map(c => (
          <Card key={c.title} style={{ marginBottom: 12, borderColor: c.colour, background: "linear-gradient(135deg, #0f1f0f, #111)" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.colour, marginBottom: 4 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: G.muted, lineHeight: 1.6, fontFamily: mono }}>{c.desc}</div>
              </div>
            </div>
          </Card>
        ))}

        {/* Vote */}
        <div style={{ marginTop: 24, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: G.cream, marginBottom: 4 }}>Vote for the Side Comp</div>
          <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginBottom: 14 }}>Pick your favourite — most votes wins. Results shown after everyone signs up.</div>
          {SIDE_COMPS.map(c => (
            <div key={c.id} onClick={() => setVote(c.id)} style={{
              padding: "12px 14px", marginBottom: 8, borderRadius: 6, cursor: "pointer",
              background: vote === c.id ? "linear-gradient(90deg, #162e16, #1a1a08)" : G.surface,
              border: `2px solid ${vote === c.id ? G.greenBright : G.border}`,
              transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 22, width: 32, textAlign: "center", flexShrink: 0 }}>{c.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: vote === c.id ? G.greenGlow : G.cream }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginTop: 2, lineHeight: 1.5 }}>{c.pitch}</div>
                  <div style={{ fontSize: 11, color: vote === c.id ? G.gold : G.border, fontFamily: mono, marginTop: 3, fontStyle: "italic" }}>{c.spice}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${vote === c.id ? G.greenBright : G.border}`, background: vote === c.id ? G.green : "transparent", flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>

        <Btn onClick={submitVote} style={{ width: "100%", marginBottom: 10 }} disabled={voteSaving}>
          {voteSaving ? "Saving…" : vote ? `Vote for ${SIDE_COMPS.find(c => c.id === vote)?.name} →` : "Select a side comp to continue"}
        </Btn>
        <Btn variant="ghost" onClick={() => setMode("done")} style={{ width: "100%" }}>Skip vote</Btn>
      </div>
    </div>
  );

  if (mode === "done") {
    // Everyone who's signed up: approved players + pending (excluding admin)
    const allSignedUp = [
      ...players.filter(p => p.name !== "Admin"),
      ...pending,
    ];
    // Put the current signup at the top if they're in pending
    const myName = pendingEntry?.name;
    const sorted = [...allSignedUp].sort((a, b) => {
      if (a.name === myName) return -1;
      if (b.name === myName) return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div style={{ ...bgStyle, justifyContent: "flex-start" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>🐦</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: G.greenGlow, marginBottom: 4 }}>You\'re on the list!</div>
            {nickname && (
              <div style={{ fontSize: 18, fontWeight: 700, color: G.gold, marginBottom: 6 }}>{nickname}</div>
            )}
            <div style={{ fontSize: 13, color: G.muted, fontFamily: mono, lineHeight: 1.6 }}>
              Pending admin approval. See you at the pub for draw night.
            </div>
            {vote && (
              <div style={{ marginTop: 10, fontSize: 12, color: G.gold, fontFamily: mono, background: "#1a1a08", padding: "6px 14px", borderRadius: 20, display: "inline-block", border: `1px solid ${G.gold}` }}>
                Voted: {SIDE_COMPS.find(c => c.id === vote)?.emoji} {SIDE_COMPS.find(c => c.id === vote)?.name}
              </div>
            )}
          </div>

          {/* Signed up list */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Label style={{ marginBottom: 0 }}>Who\'s Signed Up</Label>
              <div style={{ fontSize: 12, color: G.muted, fontFamily: mono }}>
                {sorted.length} signed up
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sorted.map(p => {
                const isMe = p.name === myName;
                const isPending = pending.some(x => x.id === p.id);
                return (
                  <div key={p.id || p.name} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 20,
                    background: isMe ? G.green : isPending ? G.surface : "#0f2a0f",
                    border: `1px solid ${isMe ? G.greenBright : isPending ? G.border : G.green}`,
                    animation: isMe ? "pulse 2s infinite" : "none",
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: isMe ? G.greenBright : isPending ? G.border : G.green,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: G.bg, flexShrink: 0,
                    }}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: isMe ? 700 : 400,
                      color: isMe ? G.cream : isPending ? G.muted : G.cream,
                      fontFamily: isMe ? "inherit" : mono,
                    }}>
                      {p.nickname || p.name}{isMe && " (you)"}
                    </span>
                    {isPending && !isMe && (
                      <span style={{ fontSize: 9, color: G.muted, fontFamily: mono }}>pending</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, fontSize: 11, color: G.muted, fontFamily: mono, textAlign: "center" }}>
              Share the link to get everyone signed up!
            </div>
          </Card>

          <Btn variant="ghost" onClick={() => setMode("login")} style={{ width: "100%" }}>Back to Login</Btn>
        </div>
      </div>
    );
  }

  if (mode === "signup") return (
    <div style={bgStyle}>
      <div style={{ fontSize: 11, color: G.gold, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12, fontFamily: mono }}>Season 2026</div>
      <div style={{ fontSize: 36, fontWeight: 900, color: G.cream, lineHeight: 1, marginBottom: 4 }}>Birdie Board</div>
      <div style={{ fontSize: 13, color: G.muted, marginBottom: 28 }}>Create your account</div>
      <Card style={{ width: "100%", maxWidth: 360, animation: "fadeIn 0.3s ease" }}>
        <Input label="Your Name" value={sName} onChange={setSName} placeholder="First name (as the group knows you)" />
        <Input label="Choose a Password" type="password" value={sPw} onChange={setSPw} placeholder="Min. 4 characters" />
        <Input label="Confirm Password" type="password" value={sPw2} onChange={setSPw2} placeholder="Same again" />
        <div style={{ marginBottom: 14 }}>
          <Label>Handicap Index</Label>
          <input type="number" step="0.1" min="0" max="54" value={sHcp} onChange={e => setSHcp(e.target.value)} placeholder="e.g. 12.4 — find on Golf Canada app"
            style={{ width: "100%", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 4, padding: "9px 12px", color: G.cream, fontSize: 14, fontFamily: mono, outline: "none" }} />
          <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginTop: 4 }}>Used to calculate net birdies and set your bracket</div>
        </div>
        {sErr && <div style={{ color: G.danger, fontSize: 13, marginBottom: 12, fontFamily: mono }}>{sErr}</div>}
        <Btn onClick={doSignup} style={{ width: "100%", marginBottom: 10 }}>{sSaving ? "Submitting…" : "Request Access"}</Btn>
        <Btn variant="ghost" onClick={() => setMode("login")} style={{ width: "100%" }}>Back to Login</Btn>
      </Card>
    </div>
  );

  return (
    <div style={bgStyle}>
      <div style={{ fontSize: 11, color: G.gold, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12, fontFamily: mono }}>Season 2026</div>
      <div style={{ fontSize: 42, fontWeight: 900, color: G.cream, lineHeight: 1, marginBottom: 4 }}>Birdie Board</div>
      <div style={{ fontSize: 14, color: G.muted, marginBottom: 40, letterSpacing: "0.04em" }}>The 18-Hole Challenge</div>
      <Card style={{ width: "100%", maxWidth: 360, animation: "fadeIn 0.4s ease" }}>
        <div style={{ marginBottom: 20 }}>
          <Label>Your Name</Label>
          <input type="text" list="player-list" value={name} onChange={e => setName(e.target.value)} placeholder="Type your name…"
            style={{ width: "100%", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 4, padding: "9px 12px", color: G.cream, fontSize: 14, fontFamily: mono, outline: "none" }} />
          <datalist id="player-list">
            {players.sort((a, b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.name} />)}
          </datalist>
        </div>
        <Input label="Password" type="password" value={pw} onChange={setPw} placeholder="••••••" />
        {err && <div style={{ color: G.danger, fontSize: 13, marginBottom: 12, fontFamily: mono }}>{err}</div>}
        <Btn onClick={doLogin} style={{ width: "100%", marginBottom: 12 }}>Sign In</Btn>
        <div style={{ textAlign: "center" }}>
          <button onClick={() => setMode("signup")} style={{ background: "none", border: "none", color: G.gold, fontSize: 13, fontFamily: mono, cursor: "pointer", textDecoration: "underline" }}>
            New to Birdie Board? Sign up here
          </button>
        </div>
      </Card>

    </div>
  );
}

// ─── My Board ─────────────────────────────────────────────────────────────
function MyBoard({ player, rounds, onHandicapUpdate }) {
  const birdied = getBirdiedHoles(rounds, player.id);
  const count = birdied.size;
  const pct = Math.round((count / 18) * 100);
  const courseHcp = getCourseHandicap(player.handicap);

  const [hcpInput, setHcpInput] = useState(player.handicap != null ? String(player.handicap) : "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveHandicap() {
    const val = hcpInput.trim();
    if (val === "" || isNaN(parseFloat(val))) {
      alert("Please enter a valid handicap index (e.g. 8.4)");
      return;
    }
    const parsed = Math.min(54, Math.max(0, parseFloat(parseFloat(val).toFixed(1))));
    setSaving(true);
    await onHandicapUpdate(parsed);
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      {/* Handicap card */}
      <Card style={{ marginBottom: 20, background: "linear-gradient(135deg, #0f1f0f, #1a1a08)", borderColor: player.handicap != null ? G.gold : G.border }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 14 : 0 }}>
          <div>
            <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>My Handicap Index</div>
            {!editing && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 34, fontWeight: 900, color: player.handicap != null ? G.gold : G.muted }}>
                  {player.handicap != null ? player.handicap : "—"}
                </span>
                {player.handicap != null && (
                  <span style={{ fontSize: 12, color: G.muted, fontFamily: mono }}>
                    → Course HCP <span style={{ color: G.cream, fontWeight: 700 }}>{courseHcp}</span> at Revelstoke
                  </span>
                )}
              </div>
            )}
            {!editing && player.handicap == null && (
              <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginTop: 2 }}>Tap Edit to set your index</div>
            )}
          </div>
          {!editing && (
            <button onClick={() => { setEditing(true); setSaved(false); }} style={{
              background: "transparent", border: `1px solid ${G.gold}`, borderRadius: 4,
              color: G.gold, fontSize: 12, fontFamily: mono, padding: "6px 14px", cursor: "pointer",
              letterSpacing: "0.04em",
            }}>
              {saved ? "✓ Saved" : "Edit"}
            </button>
          )}
        </div>

        {editing && (
          <div>
            <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginBottom: 8, letterSpacing: "0.06em" }}>
              HANDICAP INDEX (e.g. 2.0, 8.4, 14.2)
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="number"
                step="0.1" min="0" max="54"
                value={hcpInput}
                onChange={e => setHcpInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveHandicap()}
                autoFocus
                placeholder="e.g. 8.4"
                style={{
                  flex: 1, background: G.surface, border: `1px solid ${G.gold}`,
                  borderRadius: 4, padding: "10px 12px", color: G.cream,
                  fontSize: 20, fontFamily: mono, outline: "none", fontWeight: 700,
                }}
              />
              <button onClick={saveHandicap} disabled={saving} style={{
                background: G.gold, border: "none", borderRadius: 4,
                color: "#0a0a00", fontSize: 14, fontFamily: mono, fontWeight: 700,
                padding: "10px 18px", cursor: "pointer", whiteSpace: "nowrap",
              }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} style={{
                background: "transparent", border: `1px solid ${G.border}`, borderRadius: 4,
                color: G.muted, fontSize: 13, fontFamily: mono, padding: "10px 12px", cursor: "pointer",
              }}>
                ✕
              </button>
            </div>
            <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginTop: 8 }}>
              Find your current index on the Golf Canada app or at scg.golfcanada.ca
            </div>
          </div>
        )}
      </Card>

      {/* Progress */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: G.muted, fontFamily: mono, marginBottom: 4 }}>Your Progress</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 48, fontWeight: 900, color: count === 18 ? G.gold : G.cream, animation: count === 18 ? "glow 2s infinite" : "none" }}>{count}</span>
          <span style={{ fontSize: 20, color: G.muted }}>/18 holes</span>
        </div>
        <div style={{ marginTop: 8, height: 4, background: G.border, borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: count === 18 ? G.gold : G.greenBright, borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {Array.from({ length: 18 }, (_, i) => i + 1).map(h => {
          const done = birdied.has(h);
          return (
            <div key={h} style={{
              aspectRatio: "1", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: done ? G.green : G.surface,
              border: `1px solid ${done ? G.greenBright : G.border}`,
              borderRadius: 6,
              boxShadow: done ? `0 0 12px rgba(77,170,61,0.3)` : "none",
              animation: done ? "pulse 3s infinite" : "none",
              transition: "all 0.3s",
            }}>
              <div style={{ fontSize: 10, color: done ? G.greenGlow : G.muted, fontFamily: mono, letterSpacing: "0.05em" }}>H{h}</div>
              <div style={{ fontSize: 22, marginTop: 2 }}>{done ? "🐦" : ""}</div>
              {!done && <div style={{ fontSize: 18, color: G.border }}>○</div>}
            </div>
          );
        })}
      </div>

      {count === 18 && (
        <Card style={{ marginTop: 20, textAlign: "center", borderColor: G.gold, background: `linear-gradient(135deg, ${G.card}, #2a1f00)` }}>
          <div style={{ fontSize: 32 }}>🏆</div>
          <div style={{ fontSize: 18, color: G.gold, fontWeight: 700, marginTop: 8 }}>Board Complete!</div>
          <div style={{ fontSize: 13, color: G.muted, marginTop: 4, fontFamily: mono }}>All 18 holes birdied — awaiting match play draw</div>
        </Card>
      )}
    </div>
  );
}

// ─── Round Card (with edit) ───────────────────────────────────────────────
function RoundCard({ round: r, player, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [editScores, setEditScores] = useState(r.scores || {});
  const [saving, setSaving] = useState(false);

  const courseHcp = getCourseHandicap(player.handicap);
  const strokeHoles = getStrokeHoles(courseHcp);
  const isRevelstoke = r.course?.toLowerCase().includes("revelstoke");
  const holes = isRevelstoke ? REVELSTOKE.holes : Array.from({ length: 18 }, (_, i) => ({ hole: i+1, par: 4, hcp: i+1, yards: 0 }));

  function scoreColor(score, par) {
    if (score === null || score === undefined) return G.border;
    if (score <= par - 2) return "#a06ee0";
    if (score === par - 1) return G.greenBright;
    if (score === par) return G.muted;
    if (score === par + 1) return "#c07070";
    return "#e06060";
  }

  function deriveFromScores(scores) {
    const birdies = [], netBirdies = [];
    holes.forEach(h => {
      const s = scores[h.hole];
      if (s == null) return;
      const hasStroke = strokeHoles.has(h.hole);
      const isGrossBirdie = s <= h.par - 1;
      if (isGrossBirdie) birdies.push(h.hole);
      // Net birdie: par on a stroke hole OR gross birdie on a stroke hole
      const net = s - (hasStroke ? 1 : 0);
      if (net <= h.par - 1) netBirdies.push(h.hole);
    });
    return { birdies, netBirdies };
  }

  async function saveEdit() {
    setSaving(true);
    const { birdies, netBirdies } = deriveFromScores(editScores);
    const updated = { ...r, scores: editScores, birdies, netBirdies };
    await onEdit(updated);
    setSaving(false);
    setEditing(false);
  }

  if (editing) return (
    <div style={{ padding: "12px 14px", marginBottom: 6, background: G.surface, border: `1px solid ${G.greenBright}`, borderRadius: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: G.cream }}>{r.course}</div>
          <div style={{ fontSize: 11, color: G.muted, fontFamily: mono }}>{r.date} — tap scores to edit</div>
        </div>
        <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: G.muted, fontSize: 18, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5, marginBottom: 12 }}>
        {holes.map(h => {
          const s = editScores[h.hole] !== undefined ? editScores[h.hole] : null;
          const col = scoreColor(s, h.par);
          return (
            <div key={h.hole} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: G.muted, fontFamily: mono, marginBottom: 2 }}>H{h.hole}</div>
              <div style={{ display: "flex", alignItems: "center", background: G.card, border: `1px solid ${col}`, borderRadius: 4, overflow: "hidden" }}>
                <button onClick={() => setEditScores(prev => ({ ...prev, [h.hole]: (s ?? h.par) - 1 }))}
                  style={{ flex: 1, background: "none", border: "none", color: G.muted, fontSize: 14, cursor: "pointer", padding: "3px 0" }}>−</button>
                <div style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: mono, minWidth: 18, textAlign: "center" }}>
                  {s ?? "—"}
                </div>
                <button onClick={() => setEditScores(prev => ({ ...prev, [h.hole]: (s ?? h.par) + 1 }))}
                  style={{ flex: 1, background: "none", border: "none", color: G.muted, fontSize: 14, cursor: "pointer", padding: "3px 0" }}>+</button>
              </div>
              <div style={{ fontSize: 8, color: G.muted, fontFamily: mono, marginTop: 1 }}>P{h.par}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={saveEdit} style={{ flex: 1 }} small>{saving ? "Saving…" : "Save Changes"}</Btn>
        <Btn variant="danger" onClick={() => { if (confirm("Delete this round?")) onDelete(r.id); }} small>Delete</Btn>
      </div>
    </div>
  );

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 14px", marginBottom: 6,
      background: G.card, border: `1px solid ${G.border}`, borderRadius: 6,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: G.cream }}>{r.course}</div>
        <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginTop: 2 }}>{r.date}</div>
        {r.birdies?.length > 0 && (
          <div style={{ fontSize: 11, color: G.greenGlow, fontFamily: mono, marginTop: 3 }}>
            🐦 H{[...r.birdies].sort((a,b)=>a-b).join(", H")}
          </div>
        )}
        {r.netBirdies?.length > 0 && (
          <div style={{ fontSize: 11, color: G.gold, fontFamily: mono, marginTop: 2 }}>
            ★ Net H{[...r.netBirdies].sort((a,b)=>a-b).join(", H")}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0, marginTop: 2 }}>
        <button onClick={() => setEditing(true)} style={{
          background: "none", border: `1px solid ${G.border}`, borderRadius: 4,
          color: G.muted, fontSize: 12, fontFamily: mono, padding: "4px 10px", cursor: "pointer",
        }}>Edit</button>
        <button onClick={() => { if (confirm("Delete this round?")) onDelete(r.id); }} style={{
          background: "none", border: `1px solid ${G.border}`, borderRadius: 4,
          color: G.muted, fontSize: 12, fontFamily: mono, padding: "4px 10px", cursor: "pointer",
        }}>Delete</button>
      </div>
    </div>
  );
}

// ─── Log Round ────────────────────────────────────────────────────────────
function ScoreCell({ holeData, score, onScore, hasStroke, alreadyBirdied, alreadyNetBirdied }) {
  const par = holeData.par;
  const s = score !== null ? score : null;

  // Classify score for colour
  const isEagle  = s !== null && s <= par - 2;
  const isBirdie = s !== null && s === par - 1;
  const isPar    = s !== null && s === par;
  const isBogey  = s !== null && s === par + 1;
  const isDouble = s !== null && s >= par + 2;

  // Net: player gets +1 stroke on stroke holes
  const netScore = s !== null ? s - (hasStroke ? 1 : 0) : null;
  const isNetBirdie = netScore !== null && netScore === par - 1 && !isBirdie; // net only, not already gross

  let bg = G.surface;
  let borderCol = G.border;
  let scoreColor = G.cream;
  let badge = null;

  if (isEagle)        { bg = "#1a0a3a"; borderCol = "#a06ee0"; scoreColor = "#c08af0"; badge = "🦅"; }
  else if (isBirdie)  { bg = G.green;   borderCol = G.greenBright; scoreColor = G.cream; badge = "🐦"; }
  else if (isNetBirdie){ bg = "#2a1f00"; borderCol = G.gold; scoreColor = G.gold; badge = "★"; }
  else if (isPar)     { bg = G.surface; borderCol = G.border; scoreColor = G.cream; }
  else if (isBogey)   { bg = "#2a1010"; borderCol = "#6a2020"; scoreColor = "#d08080"; }
  else if (isDouble)  { bg = "#3a0808"; borderCol = "#8a1010"; scoreColor = "#e06060"; }

  return (
    <div style={{ marginBottom: 6 }}>
      {/* Hole info row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 10px",
        background: G.card,
        border: `1px solid ${borderCol}`,
        borderBottom: "none",
        borderRadius: "6px 6px 0 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: mono, color: G.cream }}>H{holeData.hole}</span>
          <span style={{ fontSize: 11, fontFamily: mono, color:
            holeData.par === 3 ? "#6ab0d4" : holeData.par === 5 ? G.gold : G.muted
          }}>P{holeData.par}</span>
          <span style={{ fontSize: 10, fontFamily: mono, color: G.muted }}>{holeData.yards}y</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {hasStroke && <span style={{ fontSize: 10, color: G.gold, fontFamily: mono, background: "#2a1f00", padding: "1px 5px", borderRadius: 3 }}>+stroke</span>}
          {alreadyBirdied && <span style={{ fontSize: 10, color: G.greenGlow, fontFamily: mono }}>✓ birdie</span>}
          {alreadyNetBirdied && !alreadyBirdied && <span style={{ fontSize: 10, color: G.gold, fontFamily: mono }}>✓ net</span>}
        </div>
      </div>

      {/* Score input row */}
      <div style={{
        display: "flex", alignItems: "center",
        background: bg, border: `1px solid ${borderCol}`,
        borderRadius: "0 0 6px 6px", overflow: "hidden",
        transition: "all 0.2s",
      }}>
        <button onClick={() => onScore(s !== null ? s - 1 : par - 1)} style={{
          width: 44, height: 44, background: "rgba(0,0,0,0.2)", border: "none",
          color: G.muted, fontSize: 20, cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>−</button>

        <div style={{ flex: 1, textAlign: "center" }}>
          {s !== null ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 0" }}>
              <span style={{ fontSize: 24, fontWeight: 900, fontFamily: mono, color: scoreColor, lineHeight: 1 }}>{s}</span>
              {badge && <span style={{ fontSize: 14, marginTop: 1 }}>{badge}</span>}
              {isNetBirdie && <span style={{ fontSize: 9, color: G.gold, fontFamily: mono, marginTop: 1 }}>NET BIRDIE</span>}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: G.border, fontFamily: mono }}>—</span>
          )}
        </div>

        <button onClick={() => onScore(s !== null ? s + 1 : par + 1)} style={{
          width: 44, height: 44, background: "rgba(0,0,0,0.2)", border: "none",
          color: G.muted, fontSize: 20, cursor: "pointer", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>+</button>

        {s !== null && (
          <button onClick={() => onScore(null)} style={{
            width: 36, height: 44, background: "rgba(0,0,0,0.15)", border: "none",
            borderLeft: `1px solid ${G.border}`,
            color: G.border, fontSize: 14, cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        )}
      </div>
    </div>
  );
}

function LogRound({ player, rounds, onSave, onDelete, onEdit }) {
  const [course, setCourse] = useState("Revelstoke Golf Club");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // scores: { [holeNumber]: scoreInt | null }
  const [scores, setScores] = useState({});
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState("front"); // "front" | "back"
  const [lastRound, setLastRound] = useState(null);
  const [copied, setCopied] = useState(false);

  const birdied    = getBirdiedHoles(rounds, player.id);
  const netBirdied = getNetBirdiedHoles(rounds, player.id, player.handicap);
  const isRevelstoke = course.trim().toLowerCase().includes("revelstoke");
  const courseHcp  = getCourseHandicap(player.handicap);
  const strokeHoles = getStrokeHoles(courseHcp);
  const hasHandicap = player.handicap != null;

  const holes = isRevelstoke
    ? REVELSTOKE.holes
    : Array.from({ length: 18 }, (_, i) => ({ hole: i+1, par: 4, hcp: i+1, yards: 0 }));

  const frontHoles = holes.slice(0, 9);
  const backHoles  = holes.slice(9, 18);

  function setScore(holeNum, val) {
    setScores(prev => ({ ...prev, [holeNum]: val }));
  }

  // Derive birdies & net birdies automatically from scores
  const grossBirdiesThisRound = holes
    .filter(h => scores[h.hole] !== undefined && scores[h.hole] !== null && scores[h.hole] <= h.par - 1)
    .map(h => h.hole);

  const netBirdiesThisRound = holes
    .filter(h => {
      const s = scores[h.hole];
      if (s === null || s === undefined) return false;
      const hasStroke = strokeHoles.has(h.hole);
      const netScore = s - (hasStroke ? 1 : 0);
      return netScore <= h.par - 1; // includes gross birdies on stroke holes
    })
    .map(h => h.hole);

  // Totals
  const holesPlayed = holes.filter(h => scores[h.hole] != null).length;
  const totalScore  = holes.reduce((sum, h) => sum + (scores[h.hole] ?? 0), 0);
  const totalPar    = holes.filter(h => scores[h.hole] != null).reduce((sum, h) => sum + h.par, 0);
  const scoreToPar  = totalScore - totalPar;

  async function submit() {
    if (!course.trim()) { alert("Enter a course name"); return; }
    if (grossBirdiesThisRound.length === 0 && netBirdiesThisRound.length === 0 && holesPlayed === 0) {
      alert("Enter at least one hole score"); return;
    }
    const round = {
      id: uid(),
      playerId: player.id,
      playerName: player.name,
      course: course.trim(),
      date,
      birdies: grossBirdiesThisRound,
      netBirdies: netBirdiesThisRound,
      scores,
    };
    await onSave(round);
    setLastRound({ ...round, grossBirdies: grossBirdiesThisRound, netBirdies: netBirdiesThisRound });
    setSaved(true);
    setTimeout(() => { setSaved(false); setScores({}); setView("front"); }, 8000);
  }

  const tabStyle = (active) => ({
    flex: 1, padding: "8px 0", background: active ? G.green : G.surface,
    border: `1px solid ${active ? G.greenBright : G.border}`,
    color: active ? G.cream : G.muted, fontSize: 13, fontFamily: mono,
    cursor: "pointer", fontWeight: active ? 700 : 400,
    borderRadius: active ? 4 : 4,
  });

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <Input label="Course" value={course} onChange={setCourse} placeholder="e.g. Pitt Meadows Golf Club" />
      <Input label="Date" type="date" value={date} onChange={setDate} />

      {/* Front / Back toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={tabStyle(view === "front")} onClick={() => setView("front")}>
          Front 9 {frontHoles.filter(h => scores[h.hole] != null).length > 0 && `(${frontHoles.filter(h => scores[h.hole] != null).length}/9)`}
        </button>
        <button style={tabStyle(view === "back")} onClick={() => setView("back")}>
          Back 9 {backHoles.filter(h => scores[h.hole] != null).length > 0 && `(${backHoles.filter(h => scores[h.hole] != null).length}/9)`}
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { bg: G.green, label: "Birdie 🐦" },
          { bg: "#2a1f00", label: "Net ★", border: G.gold },
          { bg: "#1a0a3a", label: "Eagle 🦅", border: "#a06ee0" },
          { bg: "#2a1010", label: "Bogey" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: l.bg, border: `1px solid ${l.border || "transparent"}` }} />
            <span style={{ fontSize: 10, color: G.muted, fontFamily: mono }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Hole cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {(view === "front" ? frontHoles : backHoles).map(h => (
          <ScoreCell
            key={h.hole}
            holeData={h}
            score={scores[h.hole] !== undefined ? scores[h.hole] : null}
            onScore={(val) => setScore(h.hole, val)}
            hasStroke={strokeHoles.has(h.hole)}
            alreadyBirdied={birdied.has(h.hole)}
            alreadyNetBirdied={netBirdied.has(h.hole)}
          />
        ))}
      </div>

      {/* Running summary */}
      {holesPlayed > 0 && (
        <Card style={{ marginBottom: 16, background: "linear-gradient(135deg, #0f1f0f, #1a1a08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginBottom: 2 }}>HOLES</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: mono, color: G.cream }}>{holesPlayed}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginBottom: 2 }}>SCORE</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: mono, color: G.cream }}>{totalScore}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginBottom: 2 }}>TO PAR</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: mono, color: scoreToPar < 0 ? G.greenGlow : scoreToPar > 0 ? "#e06060" : G.cream }}>
                {scoreToPar === 0 ? "E" : scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginBottom: 2 }}>BIRDIES</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: mono, color: G.greenGlow }}>
                {grossBirdiesThisRound.length}
                {netBirdiesThisRound.length > 0 && <span style={{ fontSize: 12, color: G.gold }}> +{netBirdiesThisRound.length}★</span>}
              </div>
            </div>
          </div>
          {(grossBirdiesThisRound.length > 0 || netBirdiesThisRound.length > 0) && (
            <div style={{ marginTop: 10, fontSize: 11, color: G.muted, fontFamily: mono }}>
              {grossBirdiesThisRound.length > 0 && <>Gross birdies: <span style={{ color: G.greenGlow }}>H{grossBirdiesThisRound.join(", H")}</span></>}
              {netBirdiesThisRound.length > 0 && <> · Net: <span style={{ color: G.gold }}>H{netBirdiesThisRound.join(", H")}</span></>}
            </div>
          )}
        </Card>
      )}

      {saved && lastRound ? (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ textAlign: "center", padding: "16px 0 12px" }}>
            <div style={{ fontSize: 28 }}>🐦</div>
            <div style={{ color: G.greenGlow, fontSize: 16, fontFamily: mono, marginTop: 4 }}>Round saved!</div>
            <div style={{ color: G.muted, fontSize: 12, fontFamily: mono, marginTop: 4 }}>
              {lastRound.grossBirdies.length} birdie{lastRound.grossBirdies.length !== 1 ? "s" : ""}
              {lastRound.netBirdies.length > 0 && ` · ${lastRound.netBirdies.length} net`}
              {" "}added to your board
            </div>
          </div>

          {/* Share button */}
          {lastRound.grossBirdies.length > 0 && (() => {
            const nickname = player.nickname || player.name;
            const birdies = lastRound.grossBirdies.sort((a,b) => a-b);
            const nets = lastRound.netBirdies.sort((a,b) => a-b);
            const birdieTotal = getBirdiedHoles(rounds, player.id).size;

            let msg = "";
            if (lastRound.grossBirdies.length === 1) {
              msg = `🐦 ${nickname} just birdied Hole ${birdies[0]} at ${lastRound.course} — ${birdieTotal}/18 holes on the board!`;
            } else if (lastRound.grossBirdies.length >= 3) {
              msg = `🔥 ${nickname} is ON FIRE — ${lastRound.grossBirdies.length} birdies in one round at ${lastRound.course} (H${birdies.join(", H")})! ${birdieTotal}/18 holes on the board.`;
            } else {
              msg = `🐦 ${nickname} birdied H${birdies.join(" & H")} at ${lastRound.course} — ${birdieTotal}/18 on the board!`;
            }
            if (nets.length > 0) {
              msg += ` Also picked up ${nets.length} net birdie${nets.length > 1 ? "s" : ""} ⭐`;
            }

            function copyToClipboard() {
              navigator.clipboard.writeText(msg).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
              }).catch(() => {
                // fallback for older browsers
                const el = document.createElement("textarea");
                el.value = msg;
                document.body.appendChild(el);
                el.select();
                document.execCommand("copy");
                document.body.removeChild(el);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
              });
            }

            return (
              <div style={{ margin: "0 0 12px" }}>
                <div style={{ padding: "12px 14px", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, marginBottom: 10, fontSize: 13, color: G.cream, lineHeight: 1.6 }}>
                  {msg}
                </div>
                <button onClick={copyToClipboard} style={{
                  width: "100%", padding: "12px 0",
                  background: copied ? G.green : "#1877F2",
                  border: "none", borderRadius: 6,
                  color: "white", fontSize: 14, fontWeight: 700,
                  fontFamily: mono, cursor: "pointer", letterSpacing: "0.02em",
                  transition: "all 0.2s",
                }}>
                  {copied ? "✓ Copied — paste into Messenger!" : "📋 Copy to share in Messenger"}
                </button>
              </div>
            );
          })()}
        </div>
      ) : !saved && (
        <Btn onClick={submit} style={{ width: "100%" }}>Save Round</Btn>
      )}

      {/* Previous rounds */}
      {(() => {
        const myRounds = rounds
          .filter(r => r.playerId === player.id)
          .sort((a, b) => b.date.localeCompare(a.date));
        if (myRounds.length === 0) return null;
        return (
          <div style={{ marginTop: 28 }}>
            <div style={{ height: 1, background: G.border, marginBottom: 16 }} />
            <Label>Previous Rounds</Label>
            {myRounds.map(r => (
              <RoundCard key={r.id} round={r} player={player} onDelete={onDelete} onEdit={onEdit} />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────
function Leaderboard({ players, rounds, currentPlayer }) {
  const [expanded, setExpanded] = useState(null);
  const ranked = players
    .map(p => {
      const comp = getCompletion(rounds, p.id);
      const finDate = getCompletionDate(rounds, p.id);
      const totalBirdies = rounds.filter(r => r.playerId === p.id).reduce((s, r) => s + r.birdies.length, 0);
      return { ...p, comp, finDate, totalBirdies };
    })
    .sort((a, b) => {
      if (b.comp !== a.comp) return b.comp - a.comp;
      if (a.finDate && b.finDate) return a.finDate.localeCompare(b.finDate);
      if (a.finDate) return -1;
      if (b.finDate) return 1;
      return b.totalBirdies - a.totalBirdies;
    });

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {ranked.map((p, i) => {
        const isMe = p.id === currentPlayer.id;
        const done = p.comp === 18;
        const medals = ["🥇", "🥈", "🥉"];

        return (
          <div key={p.id} style={{ marginBottom: 6 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px",
            background: isMe ? `linear-gradient(90deg, #162e16, ${G.card})` : G.card,
            border: `1px solid ${isMe ? G.green : done ? G.gold : G.border}`,
            borderRadius: expanded === p.id ? "6px 6px 0 0" : 6,
            transition: "all 0.2s",
          }}>
            <div style={{ width: 32, textAlign: "center", fontSize: i < 3 ? 20 : 14, color: G.muted, fontFamily: mono, fontWeight: 700 }}>
              {i < 3 ? medals[i] : `${i + 1}`}
            </div>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
              <div style={{ fontSize: 15, fontWeight: 600, color: isMe ? G.greenGlow : G.cream }}>
                {p.name}{isMe && <span style={{ fontSize: 11, color: G.muted, marginLeft: 8, fontFamily: mono }}>(you)</span>}
              </div>
              {p.nickname && <div style={{ fontSize: 11, color: G.gold, fontFamily: mono, marginTop: 1 }}>{p.nickname}</div>}
              {done && <div style={{ fontSize: 11, color: G.gold, fontFamily: mono, marginTop: 2 }}>✓ Completed {p.finDate}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: done ? G.gold : G.cream, fontFamily: mono }}>{p.comp}<span style={{ fontSize: 13, color: G.muted }}>/18</span></div>
              <div style={{ fontSize: 11, color: G.muted, fontFamily: mono }}>{p.totalBirdies} 🐦 total</div>
            </div>
            <div style={{ width: 48 }}>
              <div style={{ height: 48, width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ height: `${(p.comp / 18) * 48}px`, background: done ? G.gold : G.green, borderRadius: "2px 2px 0 0", transition: "height 0.5s ease", minHeight: p.comp > 0 ? 2 : 0 }} />
              </div>
            </div>
          </div>

          {/* Expandable hole grid */}
          {expanded === p.id && (() => {
            const birdied = getBirdiedHoles(rounds, p.id);
            return (
              <div style={{ padding: "10px 14px 12px", background: G.surface, borderRadius: "0 0 6px 6px", border: `1px solid ${G.border}`, animation: "fadeIn 0.2s ease" }}>
                <div style={{ fontSize: 10, color: G.muted, fontFamily: mono, marginBottom: 8, letterSpacing: "0.08em" }}>
                  BIRDIED HOLES — {birdied.size}/18
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4 }}>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map(h => {
                    const got = birdied.has(h);
                    const holeData = REVELSTOKE.holes[h - 1];
                    return (
                      <div key={h} style={{
                        padding: "4px 2px", textAlign: "center",
                        background: got ? G.green : G.card,
                        border: `1px solid ${got ? G.greenBright : G.border}`,
                        borderRadius: 3,
                      }}>
                        <div style={{ fontSize: 9, fontFamily: mono, color: got ? G.cream : G.muted, fontWeight: got ? 700 : 400 }}>{h}</div>
                        <div style={{ fontSize: 8, color: got ? G.greenGlow : G.border, fontFamily: mono }}>P{holeData.par}</div>
                        {got && <div style={{ fontSize: 10 }}>🐦</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          </div>
        );
      })}
    </div>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────
function Heatmap({ players, rounds }) {
  const difficulty = getHoleDifficulty(rounds, players);
  const total = players.length;
  const sorted = Object.entries(difficulty).sort((a, b) => a[1] - b[1]);

  function color(count) {
    if (total === 0) return G.surface;
    const pct = count / total;
    if (pct === 0) return G.surface;
    if (pct < 0.15) return "#1a0a0a";
    if (pct < 0.3) return "#3a1a1a";
    if (pct < 0.5) return "#3a2a0a";
    if (pct < 0.7) return "#1e3a1e";
    return G.green;
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ fontSize: 13, color: G.muted, fontFamily: mono, marginBottom: 16 }}>
        How many players have birdied each hole. Red = toughest, green = most birdied.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 28 }}>
        {Array.from({ length: 18 }, (_, i) => i + 1).map(h => {
          const count = difficulty[h] || 0;
          const pct = total > 0 ? count / total : 0;
          return (
            <div key={h} style={{
              aspectRatio: "1", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: color(count),
              border: `1px solid ${G.border}`,
              borderRadius: 6,
            }}>
              <div style={{ fontSize: 10, color: G.muted, fontFamily: mono }}>H{h}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: G.cream, fontFamily: mono }}>{count}</div>
              <div style={{ fontSize: 10, color: G.muted, fontFamily: mono }}>{Math.round(pct * 100)}%</div>
            </div>
          );
        })}
      </div>

      <Label>Hardest Holes (fewest birdies)</Label>
      {sorted.slice(0, 5).map(([h, count], i) => (
        <div key={h} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 4, background: G.card, border: `1px solid ${G.border}`, borderRadius: 6 }}>
          <div style={{ fontSize: 14, color: G.muted, fontFamily: mono, width: 20 }}>#{i + 1}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Hole {h}</div>
          <div style={{ flex: 1, marginLeft: 8, height: 4, background: G.border, borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${total > 0 ? (count / total) * 100 : 0}%`, background: G.danger, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 13, color: G.danger, fontFamily: mono }}>{count}/{total}</div>
        </div>
      ))}

      <Label style={{ marginTop: 20 }}>Easiest Holes (most birdies)</Label>
      {sorted.reverse().slice(0, 5).map(([h, count], i) => (
        <div key={h} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 4, background: G.card, border: `1px solid ${G.border}`, borderRadius: 6 }}>
          <div style={{ fontSize: 14, color: G.muted, fontFamily: mono, width: 20 }}>#{i + 1}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Hole {h}</div>
          <div style={{ flex: 1, marginLeft: 8, height: 4, background: G.border, borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${total > 0 ? (count / total) * 100 : 0}%`, background: G.greenBright, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 13, color: G.greenGlow, fontFamily: mono }}>{count}/{total}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Hot Streaks ──────────────────────────────────────────────────────────
function HotStreaks({ players, rounds, currentPlayer }) {
  const streaks = getHotStreaks(rounds, players);
  const ranked = players
    .map(p => ({ ...p, ...streaks[p.id] }))
    .sort((a, b) => b.count - a.count)
    .filter(p => p.count > 0);

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ fontSize: 13, color: G.muted, fontFamily: mono, marginBottom: 20 }}>
        Most birdies in a single round — the hottest streaks of the season.
      </div>

      {ranked.length === 0 && <div style={{ color: G.muted, fontFamily: mono, textAlign: "center", padding: 40 }}>No rounds logged yet.</div>}

      {ranked.map((p, i) => {
        const isMe = p.id === currentPlayer.id;
        return (
          <div key={p.id} style={{
            padding: "14px 16px", marginBottom: 8,
            background: isMe ? `linear-gradient(90deg, #162e16, ${G.card})` : G.card,
            border: `1px solid ${i === 0 ? G.gold : isMe ? G.green : G.border}`,
            borderRadius: 6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 24, width: 36, textAlign: "center" }}>
                {i === 0 ? "🔥" : i === 1 ? "⚡" : i === 2 ? "✨" : `${i + 1}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: isMe ? G.greenGlow : G.cream }}>{p.name}</div>
                <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginTop: 2 }}>
                  {p.round?.course} · {p.round?.date}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: i === 0 ? G.gold : G.cream, fontFamily: mono }}>{p.count}</div>
                <div style={{ fontSize: 11, color: G.muted, fontFamily: mono }}>birdies</div>
              </div>
            </div>
            {p.round && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {p.round.birdies.sort((a, b) => a - b).map(h => (
                  <span key={h} style={{ fontSize: 11, background: G.green, color: G.cream, borderRadius: 3, padding: "2px 7px", fontFamily: mono }}>H{h}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Match Play ───────────────────────────────────────────────────────────
// ─── Admin Panel ──────────────────────────────────────────────────────────
function AdminPanel({ players, onPlayersChange, rounds, onRoundsChange, availability, onAvailabilityChange, pending, onPendingChange, brackets, onBracketsChange, votes, onVotesChange, onLogout }) {
  const [section, setSection] = useState("pending"); // "pending"|"players"|"draw"
  const [newName, setNewName] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newHcp, setNewHcp] = useState("");
  const [editHcp, setEditHcp] = useState({});
  const [msg, setMsg] = useState("");
  const [drawBrackets, setDrawBrackets] = useState(
    brackets.locked ? brackets.brackets : [
      { name: "Bracket 1", playerIds: [], pairs: [] },
      { name: "Bracket 2", playerIds: [], pairs: [] },
      { name: "Bracket 3", playerIds: [], pairs: [] },
      { name: "Bracket 4", playerIds: [], pairs: [] },
    ]
  );

  // ── Player management ──
  async function addPlayer() {
    if (!newName.trim() || !newPw.trim()) { setMsg("Name and password required"); return; }
    if (players.find(p => p.name.toLowerCase() === newName.trim().toLowerCase())) { setMsg("Name already taken"); return; }
    const hcpVal = newHcp.trim() !== "" ? parseFloat(newHcp) : null;
    const updated = [...players, { id: uid(), name: newName.trim(), password: newPw.trim(), handicap: hcpVal }];
    await sset(KEYS.players, updated);
    onPlayersChange(updated);
    setNewName(""); setNewPw(""); setNewHcp("");
    setMsg("Added " + newName.trim());
  }

  async function updateHandicap(id, val) {
    const updated = players.map(p => p.id === id ? { ...p, handicap: val === "" ? null : parseFloat(val) } : p);
    await sset(KEYS.players, updated);
    onPlayersChange(updated);
  }

  async function removePlayer(id) {
    const p = players.find(x => x.id === id);
    if (!confirm("Completely remove " + p.name + "? This will delete them and all their rounds, availability posts and votes.")) return;
    // Remove player
    const updatedPlayers = players.filter(x => x.id !== id);
    await sset(KEYS.players, updatedPlayers);
    onPlayersChange(updatedPlayers);
    // Remove their rounds
    const updatedRounds = (rounds || []).filter(r => r.playerId !== id);
    await onRoundsChange(updatedRounds);
    // Remove their availability posts
    const updatedAvail = (availability || []).filter(a => a.playerId !== id);
    await onAvailabilityChange(updatedAvail);
    // Remove their vote
    const updatedVotes = { ...(votes || {}) };
    delete updatedVotes[id];
    await onVotesChange(updatedVotes);
    setMsg("Removed " + p.name + " and all their data");
  }

  async function resetAllData() {
    if (!confirm("RESET ALL DATA? This is permanent.")) return;
    await sset(KEYS.players, []);
    await sset(KEYS.rounds, []);
    await sset(KEYS.pending, []);
    await sset(KEYS.brackets, { locked: false, brackets: [] });
    await sset(KEYS.votes, {});
    onPlayersChange([]);
    onPendingChange([]);
    onBracketsChange({ locked: false, brackets: [] });
    setMsg("All data reset.");
  }

  // ── Pending approvals ──
  async function approvePending(entry) {
    const newPlayer = { id: entry.id, name: entry.name, password: entry.password, handicap: entry.handicap, nickname: entry.nickname || null };
    const updatedPlayers = [...players, newPlayer];
    const updatedPending = pending.filter(p => p.id !== entry.id);
    await sset(KEYS.players, updatedPlayers);
    await sset(KEYS.pending, updatedPending);
    onPlayersChange(updatedPlayers);
    onPendingChange(updatedPending);
  }

  async function rejectPending(id) {
    const updated = pending.filter(p => p.id !== id);
    await sset(KEYS.pending, updated);
    onPendingChange(updated);
  }

  // ── Bracket draw ──
  function autoSplitByHandicap() {
    const sorted = [...players].filter(p => p.handicap != null).sort((a, b) => a.handicap - b.handicap);
    const noHcp = players.filter(p => p.handicap == null);
    const all = [...sorted, ...noHcp];
    const n = all.length;
    const sizes = [Math.ceil(n/4), Math.ceil((n - Math.ceil(n/4))/3), Math.ceil((n - Math.ceil(n/4) - Math.ceil((n - Math.ceil(n/4))/3))/2)];
    sizes.push(n - sizes[0] - sizes[1] - sizes[2]);
    let idx = 0;
    const newBrackets = sizes.map((size, i) => ({
      name: "Bracket " + (i+1),
      playerIds: all.slice(idx, idx += size).map(p => p.id),
      pairs: [],
    }));
    setDrawBrackets(newBrackets);
  }

  function randomisePairs(bIdx) {
    const ids = [...drawBrackets[bIdx].playerIds];
    // Fisher-Yates shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const pairs = [];
    for (let i = 0; i < ids.length - 1; i += 2) pairs.push([ids[i], ids[i+1]]);
    if (ids.length % 2 === 1) pairs.push([ids[ids.length - 1], null]); // bye
    const updated = drawBrackets.map((b, i) => i === bIdx ? { ...b, pairs } : b);
    setDrawBrackets(updated);
  }

  function movePlayer(playerId, fromBIdx, toBIdx) {
    const updated = drawBrackets.map((b, i) => {
      if (i === fromBIdx) return { ...b, playerIds: b.playerIds.filter(id => id !== playerId), pairs: [] };
      if (i === toBIdx) return { ...b, playerIds: [...b.playerIds, playerId], pairs: [] };
      return b;
    });
    setDrawBrackets(updated);
  }

  async function lockDraw() {
    const allPaired = drawBrackets.every(b => b.pairs.length > 0);
    if (!allPaired) { alert("Randomise all 4 brackets before locking."); return; }
    if (!confirm("Lock the draw? This cannot be undone.")) return;
    const data = { locked: true, brackets: drawBrackets };
    await onBracketsChange(data);
    setMsg("Draw locked!");
  }

  // Players not yet in any bracket
  const assignedIds = drawBrackets.flatMap(b => b.playerIds);
  const unassigned = players.filter(p => !assignedIds.includes(p.id));

  const sectionTab = (id, label, badge) => (
    <button onClick={() => setSection(id)} style={{
      flex: 1, padding: "8px 4px", background: section === id ? G.green : G.surface,
      border: `1px solid ${section === id ? G.greenBright : G.border}`,
      color: section === id ? G.cream : G.muted, fontSize: 11, fontFamily: mono,
      cursor: "pointer", borderRadius: 4, position: "relative",
    }}>
      {label}
      {badge > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: G.danger, color: "white", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{badge}</span>}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: G.bg, padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: G.gold, fontFamily: mono, letterSpacing: "0.15em" }}>ADMIN PANEL</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Birdie Board</div>
        </div>
        <Btn variant="ghost" small onClick={onLogout}>Sign Out</Btn>
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {sectionTab("pending", "⏳ Pending", pending.length)}
        {sectionTab("players", "👤 Players")}
        {sectionTab("draw", "⚔️ Match Play")}
      </div>

      {msg && <div style={{ fontSize: 12, color: G.greenGlow, fontFamily: mono, marginBottom: 12, padding: "8px 12px", background: G.surface, borderRadius: 4 }}>{msg}</div>}

      {/* ── Pending Approvals ── */}
      {section === "pending" && (
        <div>
          {/* Vote tally */}
          {Object.keys(votes).length > 0 && (() => {
            const tally = {};
            Object.values(votes).forEach(v => { tally[v.vote] = (tally[v.vote] || 0) + 1; });
            const sorted = Object.entries(tally).sort((a,b) => b[1]-a[1]);
            const SIDE_COMPS_MAP = { hole_hunter: { name: "Hole Hunter", emoji: "🎯" }, hot_hand: { name: "Hot Hand", emoji: "⚡" }, skins_bank: { name: "Skins Bank", emoji: "💰" }, streak_wars: { name: "Streak Wars", emoji: "📈" }, birdie_bingo: { name: "Birdie Bingo", emoji: "🎲" }, the_snake: { name: "The Snake", emoji: "🐍" } };
            return (
              <Card style={{ marginBottom: 16, borderColor: G.gold }}>
                <Label>Side Comp Votes ({Object.keys(votes).length} cast)</Label>
                {sorted.map(([id, count]) => {
                  const comp = SIDE_COMPS_MAP[id] || { name: id, emoji: "?" };
                  const pct = Math.round((count / Object.keys(votes).length) * 100);
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 16, width: 24 }}>{comp.emoji}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 13, color: G.cream }}>{comp.name}</span>
                          <span style={{ fontSize: 12, color: G.gold, fontFamily: mono }}>{count} vote{count !== 1 ? "s" : ""} · {pct}%</span>
                        </div>
                        <div style={{ height: 4, background: G.border, borderRadius: 2 }}>
                          <div style={{ height: "100%", width: pct + "%", background: G.gold, borderRadius: 2, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            );
          })()}
          {pending.length === 0 ? (
            <Card><div style={{ color: G.muted, fontFamily: mono, fontSize: 13, textAlign: "center", padding: 20 }}>No pending sign-ups</div></Card>
          ) : pending.map(p => (
            <Card key={p.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginTop: 2 }}>
                    HCP: {p.handicap != null ? p.handicap : "—"} · Requested: {new Date(p.requestedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={() => approvePending(p)} style={{ flex: 1 }} small>✓ Approve</Btn>
                <Btn variant="danger" onClick={() => rejectPending(p.id)} style={{ flex: 1 }} small>✕ Reject</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Players ── */}
      {section === "players" && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <Label>Add Player Manually</Label>
            <Input label="Name" value={newName} onChange={setNewName} placeholder="Player name" />
            <Input label="Password" value={newPw} onChange={setNewPw} placeholder="Player password" />
            <Input label="Handicap Index" type="number" value={newHcp} onChange={setNewHcp} placeholder="e.g. 8.4" />
            <Btn onClick={addPlayer} style={{ width: "100%" }}>Add Player</Btn>
          </Card>

          <Card>
            <Label>Active Players ({players.length})</Label>
            {players.length === 0 && <div style={{ color: G.muted, fontFamily: mono, fontSize: 13 }}>No players yet</div>}
            {players.sort((a, b) => (a.handicap ?? 99) - (b.handicap ?? 99)).map(p => (
              <div key={p.id} style={{ borderBottom: `1px solid ${G.border}` }}>
                <div style={{ display: "flex", alignItems: "center", padding: "8px 0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{p.name}</div>
                    {p.nickname && <div style={{ fontSize: 11, color: G.gold, fontFamily: mono }}>{p.nickname}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: G.gold, fontFamily: mono, marginRight: 8 }}>
                    {p.handicap != null ? p.handicap : <span style={{ color: G.muted }}>—</span>}
                  </div>
                  <Btn variant="danger" small onClick={() => removePlayer(p.id)}>Remove</Btn>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8 }}>
                  <input type="number" step="0.1" min="0" max="54" placeholder="Update handicap…"
                    value={editHcp[p.id] !== undefined ? editHcp[p.id] : (p.handicap != null ? p.handicap : "")}
                    onChange={e => setEditHcp(prev => ({ ...prev, [p.id]: e.target.value }))}
                    style={{ flex: 1, background: G.surface, border: `1px solid ${G.border}`, borderRadius: 4, padding: "5px 8px", color: G.cream, fontSize: 12, fontFamily: mono, outline: "none" }} />
                  <Btn variant="gold" small onClick={() => { updateHandicap(p.id, editHcp[p.id] !== undefined ? editHcp[p.id] : (p.handicap != null ? p.handicap : "")); setEditHcp(prev => { const n = {...prev}; delete n[p.id]; return n; }); }}>Save</Btn>
                </div>
              </div>
            ))}
          </Card>
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <Btn variant="danger" onClick={resetAllData}>⚠ Reset All Data</Btn>
          </div>
        </div>
      )}

      {/* ── Match Play ── */}
      {section === "draw" && (
        <div>
          <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginBottom: 16, lineHeight: 1.7 }}>
            Match play starts <span style={{ color: G.gold }}>July 15 2025</span>. Seedings are based on birdie count at that date — most birdies = seed 1. Matchups: 1v last, 2v second last, etc. 75% handicap cap applies.
          </div>

          {brackets.locked ? (
            <div style={{ padding: "10px 14px", background: "#1a1a08", border: `1px solid ${G.gold}`, borderRadius: 6, marginBottom: 16, fontSize: 13, color: G.gold, fontFamily: mono, textAlign: "center" }}>
              🔒 Bracket locked — draw is final
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <Card style={{ marginBottom: 12 }}>
                <Label>Current Seedings (live preview)</Label>
                {[...players]
                  .map(p => ({ ...p, count: getCompletion(rounds, p.id) }))
                  .sort((a, b) => b.count - a.count)
                  .map((p, i) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${G.border}` }}>
                      <div style={{ fontSize: 13, color: G.gold, fontFamily: mono, width: 24, fontWeight: 700 }}>#{i+1}</div>
                      <div style={{ flex: 1, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: G.greenGlow, fontFamily: mono }}>{p.count} 🐦</div>
                    </div>
                  ))
                }
              </Card>
              <Btn onClick={async () => {
                if (!confirm("Lock the match play bracket? This uses current birdie standings and cannot be undone.")) return;
                const ranked = [...players]
                  .map(p => ({ ...p, birdies: getCompletion(rounds, p.id) }))
                  .sort((a, b) => b.birdies - a.birdies);
                const n = ranked.length;
                const matchups = [];
                for (let i = 0; i < Math.floor(n / 2); i++) {
                  matchups.push({ p1: { id: ranked[i].id, name: ranked[i].name, nickname: ranked[i].nickname }, seed1: i+1, p2: { id: ranked[n-1-i].id, name: ranked[n-1-i].name, nickname: ranked[n-1-i].nickname }, seed2: n-i });
                }
                if (n % 2 === 1) matchups.push({ p1: { id: ranked[Math.floor(n/2)].id, name: ranked[Math.floor(n/2)].name }, seed1: Math.floor(n/2)+1, p2: null, seed2: null });
                await onBracketsChange({ locked: true, matchups });
                setMsg("Bracket locked!");
              }} style={{ width: "100%" }}>🔒 Lock Bracket Now</Btn>
              <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, textAlign: "center", marginTop: 8 }}>Lock this when you're ready on July 15</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Brackets Tab (player view) ───────────────────────────────────────────
function BracketsTab({ players, rounds, brackets, currentPlayer }) {
  const LOCK_DATE = new Date("2025-07-15T00:00:00");
  const now = new Date();
  const isLocked = brackets.locked;
  const daysToLock = Math.ceil((LOCK_DATE - now) / 86400000);
  const lockPassed = now >= LOCK_DATE;

  // Generate matchups from ranked players
  function getRankedMatchups(playerList, roundList) {
    const ranked = [...playerList]
      .map(p => ({ ...p, birdies: getCompletion(roundList, p.id) }))
      .sort((a, b) => b.birdies - a.birdies);
    const matchups = [];
    const n = ranked.length;
    for (let i = 0; i < Math.floor(n / 2); i++) {
      matchups.push({ p1: ranked[i], p2: ranked[n - 1 - i], seed1: i + 1, seed2: n - i });
    }
    if (n % 2 === 1) matchups.push({ p1: ranked[Math.floor(n / 2)], p2: null, seed1: Math.floor(n / 2) + 1, seed2: null });
    return matchups;
  }

  // Use locked matchups if locked, otherwise generate live preview
  const matchups = isLocked
    ? brackets.matchups || []
    : getRankedMatchups(players, rounds);

  const MatchupCard = ({ m }) => {
    const p1 = isLocked ? players.find(p => p.id === m.p1?.id) || m.p1 : m.p1;
    const p2 = m.p2 ? (isLocked ? players.find(p => p.id === m.p2?.id) || m.p2 : m.p2) : null;
    if (!p1) return null;
    const n1 = getCompletion(rounds, p1.id);
    const n2 = p2 ? getCompletion(rounds, p2.id) : 0;
    const isMe1 = currentPlayer.id === p1.id;
    const isMe2 = p2 && currentPlayer.id === p2.id;
    const isMyMatch = isMe1 || isMe2;
    const myCount = isMe1 ? n1 : isMe2 ? n2 : null;
    const oppCount = isMe1 ? n2 : isMe2 ? n1 : null;
    const gap = myCount !== null && oppCount !== null ? myCount - oppCount : null;

    let countdownMsg = null;
    if (gap !== null && p2 && isLocked) {
      if (gap > 0) countdownMsg = { text: "You're " + gap + " hole" + (gap !== 1 ? "s" : "") + " ahead — keep going 🏌️", color: G.greenGlow };
      else if (gap < 0) countdownMsg = { text: "You're " + Math.abs(gap) + " hole" + (Math.abs(gap) !== 1 ? "s" : "") + " behind — get moving 🔥", color: "#e07030" };
      else countdownMsg = { text: "Dead level — one birdie changes everything ⚡", color: G.gold };
    }

    const PlayerRow = ({ player: pl, count, isMe, seed }) => (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
        background: isMe ? `linear-gradient(90deg, #162e16, ${G.card})` : G.card,
        borderBottom: `1px solid ${G.border}`,
      }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: G.surface, border: `1px solid ${G.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: mono, color: G.muted, flexShrink: 0 }}>{seed}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: isMe ? 700 : 400, color: isMe ? G.greenGlow : G.cream }}>
            {pl.nickname || pl.name}{isMe && <span style={{ fontSize: 10, color: G.muted, fontFamily: mono, marginLeft: 6 }}>(you)</span>}
          </div>
          {pl.nickname && <div style={{ fontSize: 10, color: G.muted, fontFamily: mono }}>{pl.name}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ height: 4, width: 56, background: G.border, borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${(count/18)*100}%`, background: isMe ? G.greenBright : G.muted, borderRadius: 2, transition: "width 0.5s" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: mono, color: isMe ? G.cream : G.muted, minWidth: 32, textAlign: "right" }}>
            {count}<span style={{ fontSize: 10, color: G.muted }}>/18</span>
          </span>
        </div>
      </div>
    );

    return (
      <div style={{ marginBottom: 8, border: `1px solid ${isMyMatch ? G.green : G.border}`, borderRadius: 6, overflow: "hidden" }}>
        <PlayerRow player={p1} count={n1} isMe={isMe1} seed={m.seed1} />
        {p2
          ? <PlayerRow player={p2} count={n2} isMe={isMe2} seed={m.seed2} />
          : <div style={{ padding: "10px 12px", background: G.card, fontSize: 13, color: G.muted, fontFamily: mono }}>BYE</div>
        }
        {countdownMsg && (
          <div style={{ padding: "7px 12px", background: G.surface, borderTop: `1px solid ${G.border}`, fontSize: 11, color: countdownMsg.color, fontFamily: mono, fontStyle: "italic" }}>
            {countdownMsg.text}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* Status banner */}
      {isLocked ? (
        <div style={{ padding: "10px 14px", background: "#1a1a08", border: `1px solid ${G.gold}`, borderRadius: 6, marginBottom: 16, fontSize: 12, color: G.gold, fontFamily: mono, textAlign: "center" }}>
          🔒 Match play bracket locked · July 15 2025 · 75% handicap cap applies
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ padding: "10px 14px", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.cream, marginBottom: 4 }}>
              {lockPassed ? "⏳ Awaiting bracket lock" : "📅 Match play starts July 15"}
            </div>
            <div style={{ fontSize: 12, color: G.muted, fontFamily: mono }}>
              {lockPassed
                ? "The season date has passed — ask admin to lock the bracket."
                : daysToLock + " days to go · Seedings based on birdie count at July 15 · 75% handicap cap"}
            </div>
          </div>
          <div style={{ padding: "8px 12px", background: "#0a1a0a", border: `1px solid ${G.green}`, borderRadius: 4, fontSize: 11, color: G.greenGlow, fontFamily: mono, textAlign: "center" }}>
            👀 Live preview — seedings as of right now
          </div>
        </div>
      )}

      {matchups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: G.muted, fontFamily: mono, fontSize: 13 }}>No players to show yet.</div>
      ) : (
        matchups.map((m, i) => <MatchupCard key={i} m={m} />)
      )}
    </div>
  );
}


// ─── Net Birdie Utilities ─────────────────────────────────────────────────
function getCourseHandicap(handicapIndex, slope = 127) {
  return Math.round(parseFloat(handicapIndex || 0) * slope / 113);
}

function getStrokeHoles(courseHandicap) {
  // Returns set of hole numbers where player receives a stroke
  const strokes = new Set();
  const holes = REVELSTOKE.holes.slice().sort((a, b) => a.hcp - b.hcp);
  const full = Math.min(courseHandicap, 18);
  const extra = Math.max(0, courseHandicap - 18);
  holes.slice(0, full).forEach(h => strokes.add(h.hole));
  // Extra strokes (handicap > 18) go back to hcp index 1 onwards
  if (extra > 0) holes.slice(0, extra).forEach(h => strokes.add(h.hole)); // already in set but harmless
  return strokes;
}

function getNetBirdiedHoles(rounds, playerId, handicap) {
  const holes = new Set();
  const courseHcp = getCourseHandicap(handicap);
  const strokeHoles = getStrokeHoles(courseHcp);
  rounds.filter(r => r.playerId === playerId).forEach(r => {
    // Include stored net birdies
    (r.netBirdies || []).forEach(h => holes.add(h));
    // Also derive from scores — gross birdie on stroke hole = net birdie
    if (r.scores) {
      REVELSTOKE.holes.forEach(h => {
        const s = r.scores[h.hole];
        if (s == null) return;
        const hasStroke = strokeHoles.has(h.hole);
        const netScore = s - (hasStroke ? 1 : 0);
        if (netScore <= h.par - 1) holes.add(h.hole);
      });
    }
    // Also: if no scores stored, check if birdied hole is a stroke hole
    if (!r.scores) {
      (r.birdies || []).forEach(h => {
        if (strokeHoles.has(h)) holes.add(h);
      });
    }
  });
  return holes;
}

function getNetCompletion(rounds, playerId, handicap) {
  return getNetBirdiedHoles(rounds, playerId, handicap).size;
}

// ─── Prizes & Format ──────────────────────────────────────────────────────
function PrizesTab() {
  const prizes = [
    { icon: "⛳", title: "Gross Birdie Board", amount: "$10", desc: "First to birdie all 18 holes at Revelstoke wins the pot. Optional to enter — but if you don't, prepare for daily shame.", tag: "Optional", tagColor: "#e07030" },
    { icon: "🔢", title: "Net Birdie Board", amount: "$10", desc: "Same challenge but handicap-adjusted. A net birdie is a par score on a stroke hole. Any handicap can compete.", tag: "Everyone In", tagColor: G.greenGlow },
    { icon: "⚔️", title: "Match Play", amount: "$10", desc: "Bracket seeded by birdie count on July 15. 75% handicap cap applies. Head-to-head for the season — most birdies wins your match.", tag: "Starts July 15", tagColor: G.gold },
    { icon: "🕳️", title: "Hole in One", amount: "$10", desc: "One pot. One hole in one. If nobody holes out all season, this rolls into the end of season social fund.", tag: "Season Long", tagColor: "#b06ae0" },
  ];

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* Total entry */}
      <div style={{ textAlign: "center", padding: "20px 0 24px" }}>
        <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Total Entry Fee</div>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 56, fontWeight: 900, color: G.gold, lineHeight: 1, animation: "glow 3s infinite" }}>$40</div>
        <div style={{ fontSize: 13, color: G.muted, fontFamily: mono, marginTop: 8 }}>per player · 14 players · $560 total pot</div>
      </div>

      {/* Prize cards */}
      {prizes.map((p, i) => (
        <div key={i} style={{
          padding: "16px", marginBottom: 10,
          background: G.card, border: `1px solid ${G.border}`, borderRadius: 8,
          transition: "border-color 0.2s",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{p.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: G.cream }}>{p.title}</div>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 900, color: G.gold }}>{p.amount}</div>
              </div>
              <div style={{ fontSize: 13, color: G.muted, lineHeight: 1.6, marginBottom: 8 }}>{p.desc}</div>
              <span style={{ fontSize: 10, fontFamily: mono, color: p.tagColor, background: "rgba(0,0,0,0.3)", border: `1px solid ${p.tagColor}`, borderRadius: 3, padding: "2px 8px", letterSpacing: "0.06em" }}>{p.tag}</span>
            </div>
          </div>
        </div>
      ))}

      {/* End of season social */}
      <div style={{ marginTop: 6, padding: "14px 16px", background: "linear-gradient(135deg, #1a1a08, #0a100a)", border: `1px solid ${G.gold}`, borderRadius: 8 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 28 }}>🍺</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: G.gold, marginBottom: 4 }}>End of Season Social</div>
            <div style={{ fontSize: 13, color: G.muted, lineHeight: 1.6 }}>If any pot goes unclaimed, it rolls into the end of season social fund. Nobody loses — worst case everyone gets a round of drinks.</div>
          </div>
        </div>
      </div>

      {/* Match play rules */}
      <div style={{ marginTop: 10, padding: "12px 14px", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 6 }}>
        <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Match Play Rules</div>
        {[
          "Bracket seeded by total birdies at July 15",
          "Highest seed (most birdies) vs lowest seed",
          "75% handicap cap applies throughout",
          "Most birdies at end of season wins the match",
          "Tied matches split the pot equally",
        ].map((rule, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
            <span style={{ color: G.green, flexShrink: 0, marginTop: 2 }}>✓</span>
            <span style={{ fontSize: 13, color: G.muted }}>{rule}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Who's Playing ────────────────────────────────────────────────────────
const TIME_SLOTS = [
  "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM",
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM",
];

function WhosPlaying({ player, availability, onAvailabilityChange }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [timeFrom, setTimeFrom] = useState("7:00 AM");
  const [timeTo, setTimeTo] = useState("10:00 AM");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const active = availability.filter(a => a.date >= today);
  const myEntry = active.find(a => a.playerId === player.id && a.date === date);
  const byDate = active.reduce((acc, a) => {
    if (!acc[a.date]) acc[a.date] = [];
    acc[a.date].push(a);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort();

  async function postAvailability() {
    setSaving(true);
    const entry = {
      id: uid(),
      playerId: player.id,
      playerName: player.name,
      date,
      timeFrom,
      timeTo,
      note: note.trim(),
      postedAt: new Date().toISOString(),
    };
    const updated = [...availability.filter(a => !(a.playerId === player.id && a.date === date)), entry];
    await onAvailabilityChange(updated);
    setNote("");
    setSaving(false);
  }

  async function removeEntry(id) {
    const updated = availability.filter(a => a.id !== id);
    await onAvailabilityChange(updated);
  }

  function dayLabel(d) {
    const today2 = new Date().toISOString().slice(0, 10);
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    const tomStr = tom.toISOString().slice(0, 10);
    if (d === today2) return "TODAY";
    if (d === tomStr) return "TOMORROW";
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: G.cream }}>
          {myEntry ? "\u270F\uFE0F Update your availability" : "\uD83D\uDCC5 I want to play on…"}
        </div>
        <Input label="Date" type="date" value={date} onChange={setDate} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <Label>Available from</Label>
            <select value={timeFrom} onChange={e => setTimeFrom(e.target.value)}
              style={{ width: "100%", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 4, padding: "9px 10px", color: G.cream, fontSize: 13, fontFamily: mono, outline: "none" }}>
              {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Until</Label>
            <select value={timeTo} onChange={e => setTimeTo(e.target.value)}
              style={{ width: "100%", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 4, padding: "9px 10px", color: G.cream, fontSize: 13, fontFamily: mono, outline: "none" }}>
              {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <Input label="Note (optional)" value={note} onChange={setNote} placeholder="e.g. Pitt Meadows, need a 4th" />
        <Btn onClick={postAvailability} style={{ width: "100%" }}>
          {saving ? "Saving…" : myEntry ? "Update" : "Post Availability"}
        </Btn>
        {myEntry && (
          <div style={{ marginTop: 10, textAlign: "center" }}>
            <Btn variant="danger" small onClick={() => removeEntry(myEntry.id)}>Remove my post for this day</Btn>
          </div>
        )}
      </Card>

      {sortedDates.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: G.muted, fontFamily: mono, fontSize: 13 }}>
          No one has posted availability yet. Be the first!
        </div>
      ) : (
        sortedDates.map(d => {
          const entries = byDate[d].sort((a, b) => a.timeFrom.localeCompare(b.timeFrom));
          const isToday = d === new Date().toISOString().slice(0, 10);
          return (
            <div key={d} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? G.greenGlow : G.gold, fontFamily: mono, letterSpacing: "0.06em" }}>
                  {dayLabel(d)}
                </div>
                <div style={{ flex: 1, height: 1, background: G.border }} />
                <div style={{ fontSize: 11, color: G.muted, fontFamily: mono }}>
                  {entries.length} {entries.length === 1 ? "player" : "players"}
                </div>
              </div>
              {entries.map(e => {
                const isMe = e.playerId === player.id;
                return (
                  <div key={e.id} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 6,
                    background: isMe ? `linear-gradient(90deg, #162e16, ${G.card})` : G.card,
                    border: `1px solid ${isMe ? G.green : G.border}`, borderRadius: 6,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: isMe ? G.green : G.surface, border: `1px solid ${isMe ? G.greenBright : G.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 700, color: G.cream,
                    }}>
                      {e.playerName.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: isMe ? G.greenGlow : G.cream }}>
                        {e.playerName}{isMe && <span style={{ fontSize: 11, color: G.muted, marginLeft: 6, fontFamily: mono }}>(you)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginTop: 2 }}>
                        {e.timeFrom} – {e.timeTo}
                        {e.note && <span style={{ color: G.cream, marginLeft: 8 }}>· {e.note}</span>}
                      </div>
                    </div>
                    {isMe && (
                      <button onClick={() => removeEntry(e.id)} style={{ background: "none", border: "none", color: G.muted, fontSize: 16, cursor: "pointer", padding: "4px 6px" }}>
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}


// ─── Net Birdie Board ─────────────────────────────────────────────────────
function NetBirdieBoard({ player, players, rounds }) {
  const courseHcp = getCourseHandicap(player.handicap);
  const strokeHoles = getStrokeHoles(courseHcp);
  const netBirdied = getNetBirdiedHoles(rounds, player.id, player.handicap);
  const count = netBirdied.size;
  const pct = Math.round((count / 18) * 100);

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* Player handicap info */}
      <Card style={{ marginBottom: 20, background: "linear-gradient(135deg, #162616, #1a1a0a)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginBottom: 2 }}>Your Handicap Index</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: G.gold }}>
              {player.handicap != null ? player.handicap : <span style={{ fontSize: 16, color: G.muted }}>Not set</span>}
            </div>
            {player.handicap != null && (
              <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginTop: 2 }}>
                Course HCP at Revelstoke: <span style={{ color: G.cream }}>{courseHcp}</span>
                {" · "}Strokes on <span style={{ color: G.cream }}>{Math.min(courseHcp, 18)}</span> holes
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginBottom: 2 }}>Net Birdies</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: count === 18 ? G.gold : G.cream }}>
              {count}<span style={{ fontSize: 16, color: G.muted }}>/18</span>
            </div>
          </div>
        </div>
        {player.handicap != null && (
          <div style={{ marginTop: 10, height: 4, background: G.border, borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: G.gold, borderRadius: 2, transition: "width 0.5s ease" }} />
          </div>
        )}
      </Card>

      {player.handicap == null ? (
        <div style={{ textAlign: "center", padding: "30px 20px", color: G.muted, fontFamily: mono, fontSize: 13, background: G.card, borderRadius: 8, border: `1px solid ${G.border}` }}>
          No handicap set yet.<br />
          <span style={{ color: G.cream }}>Ask your admin to add your handicap index.</span>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: G.muted, fontFamily: mono, marginBottom: 12 }}>
            <span style={{ color: G.gold }}>●</span> Gold border = you get a stroke · <span style={{ color: G.greenGlow }}>🐦</span> = net birdie recorded
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 20 }}>
            {REVELSTOKE.holes.map(h => {
              const hasStroke = strokeHoles.has(h.hole);
              const done = netBirdied.has(h.hole);
              return (
                <div key={h.hole} style={{
                  aspectRatio: "1", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: done ? "#1a2e0a" : G.surface,
                  border: `2px solid ${done ? G.greenBright : hasStroke ? G.gold : G.border}`,
                  borderRadius: 6,
                  boxShadow: done ? "0 0 10px rgba(77,170,61,0.25)" : hasStroke ? "0 0 6px rgba(201,168,76,0.15)" : "none",
                  transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: 10, color: done ? G.greenGlow : hasStroke ? G.gold : G.muted, fontFamily: mono }}>H{h.hole}</div>
                  <div style={{ fontSize: 9, color: hasStroke ? G.gold : G.muted, fontFamily: mono }}>P{h.par}{hasStroke ? "+1" : ""}</div>
                  <div style={{ fontSize: 16, marginTop: 2 }}>{done ? "🐦" : ""}</div>
                  {!done && <div style={{ fontSize: 14, color: G.border }}>○</div>}
                </div>
              );
            })}
          </div>

          {/* Net Birdie Leaderboard */}
          <Label style={{ marginTop: 4 }}>Net Birdie Standings</Label>
          {players
            .map(p => {
              const ch = getCourseHandicap(p.handicap);
              const nb = getNetCompletion(rounds, p.id, p.handicap);
              return { ...p, courseHcp: ch, netCount: nb };
            })
            .sort((a, b) => b.netCount - a.netCount)
            .map((p, i) => {
              const isMe = p.id === player.id;
              const medals = ["🥇","🥈","🥉"];
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 5,
                  background: isMe ? `linear-gradient(90deg, #162e16, ${G.card})` : G.card,
                  border: `1px solid ${isMe ? G.green : G.border}`, borderRadius: 6,
                }}>
                  <div style={{ width: 28, textAlign: "center", fontSize: i < 3 ? 18 : 13, color: G.muted, fontFamily: mono }}>
                    {i < 3 ? medals[i] : `${i+1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isMe ? G.greenGlow : G.cream }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: G.muted, fontFamily: mono }}>
                      {p.handicap != null ? `HCP ${p.handicap} → Course ${p.courseHcp}` : "No handicap set"}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: G.cream, fontFamily: mono }}>
                    {p.netCount}<span style={{ fontSize: 12, color: G.muted }}>/18</span>
                  </div>
                </div>
              );
            })
          }
        </>
      )}
    </div>
  );
}

// ─── Nickname Reveal ──────────────────────────────────────────────────────
function NicknameReveal({ player, onNicknameGenerated }) {
  const [phase, setPhase] = useState("prompt"); // prompt | generating | reveal
  const [nickname, setNickname] = useState(null);
  const [reason, setReason] = useState(null);
  const [error, setError] = useState(null);

  async function generate() {
    setPhase("generating");
    try {
      const hcpStr = player.handicap != null
        ? "Their handicap index is " + player.handicap + "."
        : "They have not set a handicap yet.";
      const prompt = "You are generating a ridiculous golf nickname for a player joining a season-long birdie challenge competition called the Birdie Board at Revelstoke Golf Club in BC, Canada.\n\nPlayer name: " + player.name + "\n" + hcpStr + "\n\nGenerate:\n1. A single ridiculous, funny golf nickname (2-5 words max, can include puns, alliteration, absurd imagery, golf references)\n2. A short 1-2 sentence private explanation of exactly why you chose that nickname for THIS specific person — be specific to their name or handicap, make it feel personal and a bit roast-y\n\nRespond ONLY with valid JSON in this exact format, no markdown, no extra text:\n{\"nickname\":\"The nickname here\",\"reason\":\"The private reason here\"}";

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setNickname(parsed.nickname);
      setReason(parsed.reason);
      setPhase("reveal");
    } catch (e) {
      const fallbacks = ["The Bogey Banisher", "Captain Three-Putt", "The Fairway Phantom", "El Condor Grande", "The Green Reaper"];
      setNickname(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
      setReason("Our nickname oracle had a wobble — but this one suits you perfectly.");
      setPhase("reveal");
    }
  }

  function accept() {
    onNicknameGenerated(nickname, reason);
  }

  // ── Prompt screen ──────────────────────────────────────────────────────────
  if (phase === "prompt") return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: G.bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 32, textAlign: "center",
      animation: "fadeIn 0.4s ease",
    }}>
      <div style={{ fontSize: 72, marginBottom: 24 }}>🎲</div>
      <div style={{ fontSize: 11, color: G.gold, fontFamily: mono, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>One Time Only</div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 900, color: G.cream, marginBottom: 16, lineHeight: 1.1 }}>
        Your nickname<br/>awaits.
      </div>
      <p style={{ fontSize: 16, color: G.muted, lineHeight: 1.7, maxWidth: 320, marginBottom: 40, fontStyle: "italic" }}>
        Claude is going to generate you a ridiculous golf nickname. You only get one shot at this. There are no re-rolls. Choose wisely.
      </p>
      <div style={{ fontSize: 13, color: G.muted, fontFamily: mono, marginBottom: 32, padding: "10px 20px", border: `1px solid ${G.border}`, borderRadius: 4 }}>
        Warning: may contain truths you are not ready for.
      </div>
      <Btn onClick={generate} style={{ fontSize: 16, padding: "16px 48px" }}>
        🎲 Reveal My Nickname
      </Btn>
    </div>
  );

  // ── Generating screen ──────────────────────────────────────────────────────
  if (phase === "generating") return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: G.bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 32, textAlign: "center",
    }}>
      <div style={{ fontSize: 64, marginBottom: 32, animation: "spin 1s linear infinite" }}>⛳</div>
      <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 700, color: G.cream, marginBottom: 12 }}>
        Consulting the oracle...
      </div>
      <p style={{ fontSize: 14, color: G.muted, fontFamily: mono }}>Analysing your name. Judging your handicap.</p>
    </div>
  );

  // ── Reveal screen ──────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: `radial-gradient(ellipse at 50% 30%, #1a1400 0%, ${G.bg} 70%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 32, textAlign: "center",
      animation: "fadeIn 0.5s ease",
    }}>
      {/* Glow effect */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 40% at 50% 40%, rgba(201,168,76,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 20, position: "relative" }}>
        {player.name}, your nickname is...
      </div>

      {/* The big reveal */}
      <div style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: "clamp(32px, 8vw, 56px)",
        fontWeight: 900,
        color: G.gold,
        lineHeight: 1.1,
        marginBottom: 32,
        maxWidth: 400,
        position: "relative",
        animation: "glow 2s infinite",
      }}>
        {nickname}
      </div>

      {/* Divider */}
      <div style={{ width: 200, height: 1, background: `linear-gradient(90deg, transparent, ${G.gold}, transparent)`, marginBottom: 28 }} />

      {/* Private reason */}
      <div style={{ marginBottom: 8, fontSize: 10, color: G.muted, fontFamily: mono, letterSpacing: "0.15em", textTransform: "uppercase" }}>
        🔒 Only you can see this
      </div>
      <p style={{
        fontSize: 15, fontStyle: "italic", color: G.text || G.cream,
        lineHeight: 1.7, maxWidth: 340, marginBottom: 48,
        background: G.card, border: `1px solid ${G.border}`,
        borderRadius: 6, padding: "16px 20px",
        position: "relative",
      }}>
        {reason}
      </p>

      <Btn onClick={accept} style={{ fontSize: 15, padding: "14px 44px" }}>
        I accept my fate ✓
      </Btn>
      <div style={{ marginTop: 14, fontSize: 11, color: G.muted, fontFamily: mono }}>
        This nickname is now permanent and visible to the group.
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────
// ─── Share Button ─────────────────────────────────────────────────────────
function ShareButton({ msg }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {
      const el = document.createElement("textarea");
      el.value = msg;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  return (
    <button onClick={copy} style={{
      marginTop: 10, width: "100%", padding: "8px 0",
      background: copied ? G.green : "transparent",
      border: `1px solid ${copied ? G.greenBright : "#1877F2"}`,
      borderRadius: 5, color: copied ? G.cream : "#1877F2",
      fontSize: 12, fontFamily: mono, cursor: "pointer",
      transition: "all 0.2s", letterSpacing: "0.02em",
    }}>
      {copied ? "✓ Copied — paste into Messenger!" : "📋 Copy to share in Messenger"}
    </button>
  );
}

// ─── Group Feed ───────────────────────────────────────────────────────────
function GroupFeed({ players, rounds, currentPlayer }) {
  const sorted = [...rounds].sort((a, b) => {
    // Sort by date desc, then by saved order (id) desc
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.id.localeCompare(a.id);
  });

  function timeAgo(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    const now = new Date();
    const days = Math.floor((now - d) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  }

  if (sorted.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 20px", animation: "fadeIn 0.3s ease" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🏌️</div>
      <div style={{ color: G.muted, fontFamily: mono, fontSize: 13 }}>No rounds logged yet — get out there!</div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ fontSize: 13, color: G.muted, fontFamily: mono, marginBottom: 16 }}>
        Every round logged by the group, most recent first.
      </div>
      {sorted.map(r => {
        const isMe = r.playerId === currentPlayer.id;
        const birdieCount = r.birdies?.length || 0;
        const netCount = r.netBirdies?.length || 0;
        const eagleCount = Object.values(r.scores || {}).filter((s, i) => {
          const holeNum = parseInt(Object.keys(r.scores || {})[i]);
          const hole = REVELSTOKE.holes.find(h => h.hole === holeNum);
          return hole && s <= hole.par - 2;
        }).length;

        // Score summary
        const totalScore = Object.values(r.scores || {}).reduce((s, v) => s + v, 0);
        const holesPlayed = Object.keys(r.scores || {}).length;
        const parForHoles = Object.keys(r.scores || {}).reduce((s, k) => {
          const h = REVELSTOKE.holes.find(h => h.hole === parseInt(k));
          return s + (h ? h.par : 0);
        }, 0);
        const toPar = totalScore - parForHoles;
        const hasScores = holesPlayed > 0;

        return (
          <div key={r.id} style={{
            padding: "14px 16px", marginBottom: 10,
            background: isMe ? `linear-gradient(90deg, #162e16, ${G.card})` : G.card,
            border: `1px solid ${isMe ? G.green : G.border}`,
            borderRadius: 8, animation: "fadeIn 0.3s ease",
          }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: isMe ? G.green : G.surface,
                border: `1px solid ${isMe ? G.greenBright : G.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700, color: G.cream,
              }}>
                {r.playerName?.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isMe ? G.greenGlow : G.cream }}>
                    {(() => {
                      const pl = players.find(p => p.id === r.playerId);
                      return pl?.nickname || r.playerName;
                    })()}
                    {isMe && <span style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginLeft: 4 }}>(you)</span>}
                  </span>
                  <span style={{ fontSize: 11, color: G.muted, fontFamily: mono }}>
                    {(() => { const pl = players.find(p => p.id === r.playerId); return pl?.nickname ? r.playerName : ""; })()}
                  </span>
                  <span style={{ fontSize: 12, color: G.muted, fontFamily: mono }}>· {r.course}</span>
                </div>
                <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginTop: 2 }}>
                  {timeAgo(r.date)} · {r.date}
                </div>
              </div>
              {/* Score to par badge */}
              {hasScores && (
                <div style={{
                  padding: "3px 10px", borderRadius: 12, flexShrink: 0,
                  background: toPar < 0 ? G.green : toPar === 0 ? G.surface : "#2a1010",
                  border: `1px solid ${toPar < 0 ? G.greenBright : toPar === 0 ? G.border : "#6a2020"}`,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: mono, color: toPar < 0 ? G.cream : toPar === 0 ? G.muted : "#d08080" }}>
                    {toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : toPar}
                  </span>
                  <span style={{ fontSize: 10, color: G.muted, fontFamily: mono, marginLeft: 3 }}>{holesPlayed}H</span>
                </div>
              )}
            </div>

            {/* Birdie highlights */}
            {(birdieCount > 0 || netCount > 0 || eagleCount > 0) ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {eagleCount > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#1a0a3a", border: "1px solid #a06ee0", borderRadius: 12 }}>
                    <span style={{ fontSize: 13 }}>🦅</span>
                    <span style={{ fontSize: 12, color: "#c08af0", fontFamily: mono }}>{eagleCount} eagle{eagleCount > 1 ? "s" : ""}</span>
                  </div>
                )}
                {birdieCount > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: G.green, border: `1px solid ${G.greenBright}`, borderRadius: 12 }}>
                    <span style={{ fontSize: 13 }}>🐦</span>
                    <span style={{ fontSize: 12, color: G.cream, fontFamily: mono }}>{birdieCount} birdie{birdieCount > 1 ? "s" : ""}</span>
                  </div>
                )}
                {netCount > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "#2a1f00", border: `1px solid ${G.gold}`, borderRadius: 12 }}>
                    <span style={{ fontSize: 12, color: G.gold, fontFamily: mono }}>★ {netCount} net</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: G.muted, fontFamily: mono }}>No birdies this round — next time 💪</div>
            )}

            {/* Hole numbers */}
            {r.birdies?.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {r.birdies.sort((a,b) => a-b).map(h => (
                  <span key={h} style={{ fontSize: 10, background: G.green, color: G.cream, borderRadius: 3, padding: "2px 6px", fontFamily: mono }}>H{h}</span>
                ))}
                {r.netBirdies?.sort((a,b) => a-b).map(h => (
                  <span key={"n"+h} style={{ fontSize: 10, background: "#2a1f00", color: G.gold, border: `1px solid ${G.gold}`, borderRadius: 3, padding: "2px 6px", fontFamily: mono }}>H{h}★</span>
                ))}
              </div>
            )}

            {/* Share button on rounds with birdies */}
            {r.birdies?.length > 0 && (() => {
              const pl = players.find(p => p.id === r.playerId);
              const nickname = pl?.nickname || r.playerName;
              const birdies = [...(r.birdies || [])].sort((a,b) => a-b);
              const nets = [...(r.netBirdies || [])].sort((a,b) => a-b);
              const birdieTotal = getCompletion(rounds, r.playerId);

              let msg = "";
              if (birdies.length === 1) {
                msg = `🐦 ${nickname} just birdied Hole ${birdies[0]} at ${r.course} — ${birdieTotal}/18 holes on the board!`;
              } else if (birdies.length >= 3) {
                msg = `🔥 ${nickname} is ON FIRE — ${birdies.length} birdies in one round at ${r.course} (H${birdies.join(", H")})! ${birdieTotal}/18 on the board.`;
              } else {
                msg = `🐦 ${nickname} birdied H${birdies.join(" & H")} at ${r.course} — ${birdieTotal}/18 on the board!`;
              }
              if (nets.length > 0) msg += ` Also ${nets.length} net birdie${nets.length > 1 ? "s" : ""} ⭐`;

              return (
                <ShareButton msg={msg} />
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

const TABS = [
  { id: "board", label: "My Board", icon: "⛳" },
  { id: "net", label: "Net Birdies", icon: "🔢" },
  { id: "prizes", label: "Prizes", icon: "💰" },
  { id: "brackets", label: "Brackets", icon: "⚔️" },
  { id: "log", label: "Log Round", icon: "✏️" },
  { id: "feed", label: "Group Feed", icon: "📋" },
  { id: "playing", label: "Who's Playing", icon: "🗓" },
  { id: "leaderboard", label: "Standings", icon: "🏆" },
  { id: "heatmap", label: "Heatmap", icon: "🌡" },
  { id: "streaks", label: "Hot Streaks", icon: "🔥" },
];

function MainApp({ player, players, rounds, availability, brackets, onLogout, onRoundSave, onRoundDelete, onRoundEdit, onAvailabilityChange, onHandicapUpdate, onNicknameUpdate }) {
  const [tab, setTab] = useState("board");
  const [showNicknameReveal, setShowNicknameReveal] = useState(!player.nickname);

  const content = {
    board: <MyBoard player={player} rounds={rounds} onHandicapUpdate={onHandicapUpdate} />,
    net: <NetBirdieBoard player={player} players={players} rounds={rounds} />,
    prizes: <PrizesTab />,
    brackets: <BracketsTab players={players} rounds={rounds} brackets={brackets} currentPlayer={player} />,
    log: <LogRound player={player} rounds={rounds} onSave={onRoundSave} onDelete={onRoundDelete} onEdit={onRoundEdit} />,
    feed: <GroupFeed players={players} rounds={rounds} currentPlayer={player} />,
    playing: <WhosPlaying player={player} availability={availability} onAvailabilityChange={onAvailabilityChange} />,
    leaderboard: <Leaderboard players={players} rounds={rounds} currentPlayer={player} />,
    heatmap: <Heatmap players={players} rounds={rounds} />,
    streaks: <HotStreaks players={players} rounds={rounds} currentPlayer={player} />,
  };

  return (
    <div style={{ minHeight: "100vh", background: G.bg, display: "flex", flexDirection: "column" }}>
      {/* Nickname reveal overlay */}
      {showNicknameReveal && (
        <NicknameReveal
          player={player}
          onNicknameGenerated={(nick, reason) => {
            onNicknameUpdate(nick, reason);
            setShowNicknameReveal(false);
          }}
        />
      )}
      {/* Header */}
      <div style={{ background: `linear-gradient(180deg, #0d2a0d, ${G.bg})`, borderBottom: `1px solid ${G.border}`, padding: "12px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: G.cream, lineHeight: 1 }}>Birdie Board</div>
          <div style={{ fontSize: 11, color: G.muted, fontFamily: mono, marginTop: 2 }}>Season 2026</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: G.muted, fontFamily: mono }}>{player.name}</div>
            {player.nickname && <div style={{ fontSize: 11, color: G.gold, fontFamily: mono }}>{player.nickname}</div>}
          </div>
          <Btn variant="ghost" small onClick={onLogout}>Out</Btn>
        </div>
      </div>

      {/* Scrollable tabs */}
      <div style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid ${G.border}`, background: G.surface }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: "0 0 auto", padding: "10px 14px", background: "none", border: "none",
            borderBottom: tab === t.id ? `2px solid ${G.greenBright}` : "2px solid transparent",
            color: tab === t.id ? G.greenGlow : G.muted,
            fontSize: 12, fontFamily: mono, whiteSpace: "nowrap", cursor: "pointer",
            transition: "all 0.15s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "20px 16px", maxWidth: 600, width: "100%", margin: "0 auto" }}>
        {content[tab]}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [players, setPlayers] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [pending, setPending] = useState([]);
  const [brackets, setBrackets] = useState({ locked: false, brackets: [] });
  const [votes, setVotes] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = globalStyle;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    async function load() {
      const p = await sget(KEYS.players) || [];
      const initialized = await sget(KEYS.initialized);
      if (!initialized) {
        await sset(KEYS.initialized, true);
      }
      const r = await sget(KEYS.rounds) || [];
      const a = await sget(KEYS.availability) || [];
      const pend = await sget(KEYS.pending) || [];
      const brak = await sget(KEYS.brackets) || { locked: false, brackets: [] };
      const vts = await sget(KEYS.votes) || {};
      setPlayers(p);
      setRounds(r);
      setAvailability(a);
      setPending(pend);
      setBrackets(brak);
      setVotes(vts);
      setLoading(false);
    }
    load();
  }, []);

  // Poll for updates every 30s
  useEffect(() => {
    const iv = setInterval(async () => {
      const p = await sget(KEYS.players) || [];
      const r = await sget(KEYS.rounds) || [];
      const a = await sget(KEYS.availability) || [];
      const pend = await sget(KEYS.pending) || [];
      const brak = await sget(KEYS.brackets) || { locked: false, brackets: [] };
      const vts = await sget(KEYS.votes) || {};
      setPlayers(p);
      setRounds(r);
      setAvailability(a);
      setPending(pend);
      setBrackets(brak);
      setVotes(vts);
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const handleLogin = useCallback((player) => {
    setCurrentPlayer(player);
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentPlayer(null);
  }, []);

  const handleRoundSave = useCallback(async (round) => {
    const updated = [...rounds, round];
    await sset(KEYS.rounds, updated);
    setRounds(updated);
  }, [rounds]);

  const handleRoundDelete = useCallback(async (roundId) => {
    const updated = rounds.filter(r => r.id !== roundId);
    await sset(KEYS.rounds, updated);
    setRounds(updated);
  }, [rounds]);

  const handleRoundEdit = useCallback(async (updatedRound) => {
    const updated = rounds.map(r => r.id === updatedRound.id ? updatedRound : r);
    await sset(KEYS.rounds, updated);
    setRounds(updated);
  }, [rounds]);

  const handleAvailabilityChange = useCallback(async (updated) => {
    await sset(KEYS.availability, updated);
    setAvailability(updated);
  }, []);

  const handlePlayersChange = useCallback(async (updated) => {
    await sset(KEYS.players, updated);
    setPlayers(updated);
  }, []);

  const handlePendingChange = useCallback(async (updated) => {
    await sset(KEYS.pending, updated);
    setPending(updated);
  }, []);

  const handleBracketsChange = useCallback(async (updated) => {
    await sset(KEYS.brackets, updated);
    setBrackets(updated);
  }, []);

  const handleVotesChange = useCallback(async (updated) => {
    await sset(KEYS.votes, updated);
    setVotes(updated);
  }, []);

  const handleHandicapUpdate = useCallback(async (newHandicap) => {
    const updated = players.map(p =>
      p.id === currentPlayer.id ? { ...p, handicap: newHandicap } : p
    );
    await sset(KEYS.players, updated);
    setPlayers(updated);
    setCurrentPlayer(prev => ({ ...prev, handicap: newHandicap }));
  }, [players, currentPlayer]);

  const handleNicknameUpdate = useCallback(async (nickname, reason) => {
    const updated = players.map(p =>
      p.id === currentPlayer.id ? { ...p, nickname, nicknameReason: reason } : p
    );
    await sset(KEYS.players, updated);
    setPlayers(updated);
    setCurrentPlayer(prev => ({ ...prev, nickname, nicknameReason: reason }));
  }, [players, currentPlayer]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: G.muted, fontFamily: mono, fontSize: 13 }}>Loading Birdie Board…</div>
      </div>
    );
  }

  if (!currentPlayer) {
    return <LoginScreen players={players} onLogin={handleLogin} pending={pending} onPendingChange={handlePendingChange} votes={votes} onVotesChange={handleVotesChange} />;
  }

  if (currentPlayer.name === "Admin") {
    return <AdminPanel players={players} onPlayersChange={handlePlayersChange} rounds={rounds} onRoundsChange={async (u) => { await sset(KEYS.rounds, u); setRounds(u); }} availability={availability} onAvailabilityChange={handleAvailabilityChange} pending={pending} onPendingChange={handlePendingChange} brackets={brackets} onBracketsChange={handleBracketsChange} votes={votes} onVotesChange={handleVotesChange} onLogout={handleLogout} />;
  }

  return (
    <MainApp
      player={currentPlayer}
      players={players}
      rounds={rounds}
      availability={availability}
      onLogout={handleLogout}
      onRoundSave={handleRoundSave}
      onRoundDelete={handleRoundDelete}
      onRoundEdit={handleRoundEdit}
      onAvailabilityChange={handleAvailabilityChange}
      onHandicapUpdate={handleHandicapUpdate}
      onNicknameUpdate={handleNicknameUpdate}
      brackets={brackets}
    />
  );
}
