import { useEffect, useMemo, useState } from "react";
import "./genai.css";
import { sdetLessons } from "./sdetCurriculum";
import { useAuth } from "./auth/AuthContext";
import { getSupabaseClient } from "./lib/supabase";

type Status = "Not started" | "In progress" | "Needs review" | "Completed";
type Entry = { status: Status; score: number | null; confidence: number; notes: string; evidence: string };
type Progress = Record<string, Entry>;
const KEY = "sdet-ai-progress-v1";
const blank = (): Entry => ({ status: "Not started", score: null, confidence: 3, notes: "", evidence: "" });
const validStatuses: Status[] = ["Not started", "In progress", "Needs review", "Completed"];
function normalize(value: unknown): Progress {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Progress = {};
  Object.entries(value as Record<string, unknown>).forEach(([id, raw]) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const x = raw as Record<string, unknown>;
    out[id] = {
      status: validStatuses.includes(x.status as Status) ? x.status as Status : "Not started",
      score: typeof x.score === "number" && x.score >= 0 && x.score <= 3 ? x.score : null,
      confidence: typeof x.confidence === "number" ? Math.max(1, Math.min(5, x.confidence)) : 3,
      notes: typeof x.notes === "string" ? x.notes : "",
      evidence: typeof x.evidence === "string" ? x.evidence : ""
    };
  });
  return out;
}
export default function SdetApp() {
  const { user, profile, refreshProfile } = useAuth();
  const supabase = getSupabaseClient();
  const [progress, setProgress] = useState<Progress>({});
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<number | null>(1);
  const [query, setQuery] = useState("");
  const [week, setWeek] = useState("all");
  const [filter, setFilter] = useState("all");
  const [saveState, setSaveState] = useState("Loading your learning progress…");

  useEffect(() => {
    let active = true;
    async function load() {
      const local = normalize(JSON.parse(window.localStorage.getItem(KEY + ":" + (user?.id || "guest")) || "{}"));
      if (supabase && user?.id) {
        try {
          const { data, error } = await supabase.from("sdet_learning_data").select("data").eq("user_id", user.id).maybeSingle();
          if (error) throw error;
          if (data?.data && typeof data.data === "object") {
            const cloud = normalize((data.data as Record<string, unknown>).progress);
            if (active) { setProgress(Object.keys(cloud).length ? cloud : local); setSaveState("Progress synced to your account"); }
          } else if (active) { setProgress(local); setSaveState("Ready to learn"); }
        } catch (error) {
          console.error("Unable to load SDET progress:", error);
          if (active) { setProgress(local); setSaveState("Using this browser's saved progress"); }
        }
      } else if (active) { setProgress(local); setSaveState("Saved in this browser"); }
      if (active) setLoaded(true);
    }
    void load();
    return () => { active = false; };
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!loaded) return;
    const localKey = KEY + ":" + (user?.id || "guest");
    window.localStorage.setItem(localKey, JSON.stringify(progress));
    if (!supabase || !user?.id) { setSaveState("Saved in this browser"); return; }
    const timer = window.setTimeout(() => {
      void supabase.from("sdet_learning_data").upsert({ user_id: user.id, data: { progress }, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .then(({ error }) => setSaveState(error ? "Saved locally; cloud sync needs attention" : "All changes saved to your account"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [progress, loaded, supabase, user?.id]);

  const completed = Object.values(progress).filter(x => x.status === "Completed").length;
  const filtered = useMemo(() => sdetLessons.filter(x => (week === "all" || String(x.week) === week) && (filter === "all" || (progress[String(x.day)]?.status || "Not started") === filter) && (x.title + " " + x.phase + " " + x.learn).toLowerCase().includes(query.toLowerCase())), [week, filter, query, progress]);
  const active = selected ? sdetLessons.find(x => x.day === selected) : null;
  function update(day: number, patch: Partial<Entry>) {
    setProgress(prev => ({ ...prev, [String(day)]: { ...blank(), ...prev[String(day)], ...patch } }));
  }
  const weekNames = Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: "Week " + (i + 1) + " · " + sdetLessons[i * 5].phase }));
  return <div className="sdet-workspace">
    <header className="sdet-hero">
      <div className="sdet-hero-copy"><p className="eyebrow">LEARNING PATH A · 10-WEEK JOURNEY</p><h1>QA / SDET <em>+ AI</em></h1><p>Build the engineering foundations behind reliable testing, then apply them to Playwright, APIs, CI/CD and responsible AI-assisted QA. Learn a concept, practise it, prove it, and record what you can actually do.</p><div className="sdet-hero-tags"><span>50 learning sessions</span><span>Practice-first</span><span>Evidence-based progress</span></div></div>
      <div className="sdet-hero-stat"><strong>{Math.round(completed / sdetLessons.length * 100)}%</strong><span>journey completed</span><div className="progress-track"><i style={{ width: (completed / sdetLessons.length * 100) + "%" }} /></div><small>{completed} of {sdetLessons.length} sessions completed</small></div>
    </header>
    <div className="sdet-notice"><span aria-hidden="true">✦</span><div><strong>How to use this journey</strong><p>Do not mark a session complete just because you watched a video or copied code. Save evidence, explain the idea, and assess yourself honestly. If a topic takes more than one sitting, take the time you need.</p></div></div>
    <section className="sdet-summary-grid">
      <div><span>IN PROGRESS</span><strong>{Object.values(progress).filter(x => x.status === "In progress").length}</strong></div>
      <div><span>NEEDS REVIEW</span><strong>{Object.values(progress).filter(x => x.status === "Needs review").length}</strong></div>
      <div><span>UNDERSTANDING ≥ 2</span><strong>{Object.values(progress).filter(x => x.score !== null && x.score >= 2).length}</strong></div>
      <div><span>SYNC STATUS</span><strong className="sdet-sync">{saveState}</strong></div>
    </section>
    <section className="sdet-content">
      <div className="sdet-list-column">
        <div className="sdet-list-heading"><div><p className="eyebrow">YOUR ROADMAP</p><h2>Daily learning sessions</h2></div><span>01 — 50</span></div>
        <div className="sdet-filters"><input aria-label="Search lessons" placeholder="Search concepts…" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter by week" value={week} onChange={e => setWeek(e.target.value)}><option value="all">All 10 weeks</option>{weekNames.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}</select><select aria-label="Filter by status" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>{validStatuses.map(s => <option key={s}>{s}</option>)}</select></div>
        <div className="sdet-lesson-list">{filtered.map(lesson => { const p = progress[String(lesson.day)] || blank(); return <button key={lesson.day} type="button" className={"sdet-lesson-row " + (selected === lesson.day ? "active" : "")} onClick={() => setSelected(lesson.day)}><span className="sdet-day">D{String(lesson.day).padStart(2,"0")}</span><span className="sdet-lesson-info"><small>WEEK {lesson.week} · {lesson.phase}</small><strong>{lesson.title}</strong><span>{p.status}{p.score !== null ? " · Understanding " + p.score + "/3" : ""}</span></span><span className={"sdet-status sdet-status-" + p.status.toLowerCase().replaceAll(" ","-")}>{p.status === "Completed" ? "✓" : p.status === "In progress" ? "↗" : p.status === "Needs review" ? "!" : "○"}</span></button>; })}{filtered.length === 0 && <p className="sdet-empty">No sessions match these filters.</p>}</div>
      </div>
      <div className="sdet-detail-column">{active ? <article className="sdet-detail-card">
        <button type="button" className="sdet-back-to-list" onClick={() => setSelected(null)}>↙ Choose another session</button>
        <p className="eyebrow">DAY {String(active.day).padStart(2,"0")} · WEEK {active.week}</p><h2>{active.title}</h2><p className="sdet-phase">{active.phase}</p>
        <section><h3>01 · Understand the concept</h3><p>{active.learn}</p></section>
        <section><h3>02 · See a practical example</h3><p>{active.example}</p></section>
        <section><h3>03 · Practise it</h3><p>{active.practice}</p></section>
        <section><h3>04 · Your proof of work</h3><p>{active.proof}</p></section>
        <section className="sdet-assessment"><h3>05 · Check your understanding</h3><p>{active.assess}</p><div className="sdet-score-buttons">{[0,1,2,3].map(score => <button type="button" key={score} className={(progress[String(active.day)]?.score === score ? "selected" : "")} onClick={() => update(active.day,{score})}><strong>{score}</strong><small>{["Not yet","Guided","With help","Independent"][score]}</small></button>)}</div></section>
        <section><h3>06 · Learning resource</h3><a className="sdet-resource-link" href={active.url} target="_blank" rel="noreferrer">{active.resource} <span>↗</span></a><p className="sdet-resource-note">Read the relevant section, then return and apply it. Documentation may evolve; follow the current page.</p></section>
        <section className="sdet-tracking"><h3>07 · Record your progress</h3><label>Session status<select value={progress[String(active.day)]?.status || "Not started"} onChange={e => update(active.day,{status:e.target.value as Status})}>{validStatuses.map(s => <option key={s}>{s}</option>)}</select></label><label>Confidence (1 = low, 5 = high)<select value={progress[String(active.day)]?.confidence || 3} onChange={e => update(active.day,{confidence:Number(e.target.value)})}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}</select></label><label>Evidence link or local file path<input placeholder="e.g. GitHub commit, test report, notes…" value={progress[String(active.day)]?.evidence || ""} onChange={e => update(active.day,{evidence:e.target.value})} /></label><label>What did you learn? What is still unclear?<textarea rows={3} placeholder="Record your explanation, blockers and next action…" value={progress[String(active.day)]?.notes || ""} onChange={e => update(active.day,{notes:e.target.value})} /></label><p className="sdet-save-hint">Your changes save automatically. Scores are self-assessments—use your evidence to support them.</p></section>
        <div className="sdet-detail-actions"><button type="button" disabled={active.day === 1} onClick={() => setSelected(active.day - 1)}>Previous</button><button type="button" onClick={() => update(active.day,{status:"Completed"})}>Mark session complete</button><button type="button" disabled={active.day === 50} onClick={() => setSelected(active.day + 1)}>Next session →</button></div>
      </article> : <article className="sdet-detail-card sdet-select-prompt"><span>✦</span><h2>Select a learning session</h2><p>Choose any day in the roadmap to view its explanation, example, practice task, resource and assessment.</p></article>}</div>
    </section>
    <footer className="sdet-footer"><span>LEARNING IT LAB · SDET + AI</span><span>Progress measures demonstrated learning—not time spent or videos watched.</span>{profile?.learning_path !== "sdet-ai" && <button type="button" onClick={() => void refreshProfile()}>Refresh profile</button>}</footer>
  </div>;
}
