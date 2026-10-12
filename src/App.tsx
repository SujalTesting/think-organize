import { useEffect, useMemo, useState } from "react";
import "./genai.css";
import { glossary, projects, readinessChecks, resources, topics, weeklyPlan } from "./genaiCurriculum";
import { useAuth } from "./auth/AuthContext";
import { getSupabaseClient } from "./lib/supabase";
import { loadLearningData, saveLearningData } from "./lib/learningDataSync";

type TopicStatus = "Not started" | "In progress" | "Practicing" | "Needs review" | "Mastered";
type WorkStatus = "Not started" | "In progress" | "Blocked" | "Completed";
type TimeEntry = { id: string; date: string; minutes: number; note: string };
type TopicProgress = { status: TopicStatus; confidence: number; notes: string; timeEntries: TimeEntry[] };
type LearningData = {
  moduleId: "genai-agentic-ai";
  schemaVersion: 1;
  topics: Record<string, TopicProgress>;
  projects: Record<string, WorkStatus>;
  weeks: Record<string, WorkStatus>;
  completedResources: string[];
  readiness: Record<string, { passed: boolean; evidence: string }>;
  journal: string;
};
const STORAGE_KEY = "genai-agentic-lab-v1";
const OWNER_KEY = "genai-agentic-cloud-owner";
const topicStatuses: TopicStatus[] = ["Not started", "In progress", "Practicing", "Needs review", "Mastered"];
const workStatuses: WorkStatus[] = ["Not started", "In progress", "Blocked", "Completed"];
const emptyData = (): LearningData => ({ moduleId: "genai-agentic-ai", schemaVersion: 1, topics: {}, projects: {}, weeks: {}, completedResources: [], readiness: {}, journal: "" });
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function normalizeData(value: unknown): LearningData {
  if (!isRecord(value) || value.moduleId !== "genai-agentic-ai" || value.schemaVersion !== 1) return emptyData();
  const next = emptyData();
  if (isRecord(value.topics)) Object.entries(value.topics).forEach(([id, raw]) => {
    if (!isRecord(raw)) return;
    const status = topicStatuses.includes(raw.status as TopicStatus) ? raw.status as TopicStatus : "Not started";
    next.topics[id] = { status, confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(5, Math.round(raw.confidence))) : 0, notes: typeof raw.notes === "string" ? raw.notes : "", timeEntries: Array.isArray(raw.timeEntries) ? raw.timeEntries.filter(isRecord).map((entry, index) => ({ id: typeof entry.id === "string" ? entry.id : "legacy-" + id + "-" + index, date: typeof entry.date === "string" ? entry.date : new Date().toISOString(), minutes: typeof entry.minutes === "number" && Number.isFinite(entry.minutes) ? Math.max(1, Math.min(1440, Math.round(entry.minutes))) : 1, note: typeof entry.note === "string" ? entry.note : "" })) : [] };
  });
  if (isRecord(value.projects)) Object.entries(value.projects).forEach(([id, status]) => { if (workStatuses.includes(status as WorkStatus)) next.projects[id] = status as WorkStatus; });
  if (isRecord(value.weeks)) Object.entries(value.weeks).forEach(([id, status]) => { if (workStatuses.includes(status as WorkStatus)) next.weeks[id] = status as WorkStatus; });
  next.completedResources = Array.isArray(value.completedResources) ? value.completedResources.filter((x): x is string => typeof x === "string") : [];
  if (isRecord(value.readiness)) Object.entries(value.readiness).forEach(([id, raw]) => {
    if (isRecord(raw)) next.readiness[id] = { passed: raw.passed === true, evidence: typeof raw.evidence === "string" ? raw.evidence : "" };
  });
  next.journal = typeof value.journal === "string" ? value.journal : "";
  return next;
}
function readLocal(): LearningData {
  try { return normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); } catch { return emptyData(); }
}
function statusOf<T extends string>(record: Record<string, T>, id: string, fallback: T): T { return record[id] || fallback; }
function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? (remainder ? hours + "h " + remainder + "m" : hours + "h") : remainder + "m";
}
function guideForArea(area: string) {
  const guides: Record<string, { learn: string; practice: string; proof: string }> = {
    "1. AI & LLM Fundamentals": { learn: "Build a mental model of what the model receives, how it generates a response, and why output can be incomplete or incorrect.", practice: "Run the same task with different prompts or models and compare correctness, consistency, and limitations.", proof: "A short experiment log comparing outputs, plus a plain-language explanation of the model behavior you observed." },
    "2. Prompt & Context Engineering": { learn: "Understand how instructions, examples, constraints, and selected context influence the output.", practice: "Create a small prompt test set and compare a baseline prompt against one deliberate improvement.", proof: "A versioned prompt set, representative test cases, and a before/after result table." },
    "3. LLM API Engineering": { learn: "Understand request/response structure, typed inputs, streaming, errors, retries, limits, and usage costs.", practice: "Build a small TypeScript client with input validation and explicit handling for timeout, rate-limit, and provider errors.", proof: "Runnable API example with tests for success and failure paths; keep credentials out of source control." },
    "4. Tool / Function Calling": { learn: "Understand the model's tool request separately from your application's actual execution and authorization.", practice: "Connect a model to one or two harmless tools and validate every argument before execution.", proof: "Tool schemas, validation tests, tool-error handling, and a bounded stop condition." },
    "5. Agent Architecture & Orchestration": { learn: "Compare fixed workflows with agent loops, state transitions, planning, stop conditions, and recovery.", practice: "Build a small workflow first, then identify whether a model-selected action genuinely adds value.", proof: "A workflow diagram, runnable example, and tests for completion, failure, retries, and stopping." },
    "6. RAG & Knowledge Systems": { learn: "Understand ingestion, chunking, retrieval, grounding, citations, freshness, and evaluation.", practice: "Ask questions against a small document set and inspect both retrieved passages and the final answer.", proof: "A document Q&A demo, cited answers, unsupported-question behavior, and a small retrieval/answer test set." },
    "7. Memory & State": { learn: "Separate transient conversation context from durable user memory and workflow state.", practice: "Save a small session, resume it, and verify what should and should not persist.", proof: "A restart/resume test plus documented retention, deletion, and privacy behavior." },
    "8. Protocols & Integrations": { learn: "Understand how an AI application discovers and invokes external capabilities across a trust boundary.", practice: "Connect a local test client to a small integration with narrowly scoped, non-destructive tools.", proof: "An integration demo, permission rules, and tests for invalid inputs and denied actions." },
    "9. Advanced GenAI Capabilities": { learn: "Understand the selected capability's prerequisites, supported inputs/outputs, limitations, and cost.", practice: "Build one small controlled experiment and compare results against a simpler baseline.", proof: "A reproducible demo with input/output examples, limitations, and an evaluation note." },
    "10. Security & Guardrails": { learn: "Identify trust boundaries, prompt injection, sensitive data, tool permissions, unsafe output, and excessive agency.", practice: "Create adversarial test cases and verify that untrusted instructions cannot bypass application-side controls.", proof: "A threat model and regression tests for injection, authorization, secret exposure, and unsafe actions." },
    "11. Evaluation & Observability": { learn: "Define quality measures such as task success, groundedness, tool correctness, latency, and cost.", practice: "Run a repeatable test set, inspect traces, and compare results after a controlled change.", proof: "An evaluation dataset, metric definitions, trace examples, and a short failure-analysis report." },
    "12. Production AI Engineering": { learn: "Understand reliability, durable jobs, idempotency, tenant isolation, deployment, monitoring, and recovery.", practice: "Simulate a timeout or repeated request and verify the system can recover without duplicating side effects.", proof: "A deployed or runnable service with health checks, failure tests, a runbook, and resource limits." },
    "13. Optimization & Advanced Systems": { learn: "Understand trade-offs among model quality, latency, cost, reliability, and architectural complexity.", practice: "Measure a baseline, change one optimization, and compare quality and operational cost.", proof: "A reproducible benchmark and an architecture decision note explaining trade-offs." }
  };
  return guides[area] || { learn: "Understand the core concept, its purpose, assumptions, limitations, and relationship to the rest of the system.", practice: "Build a minimal example, test one normal case and one failure case, and record what you observe.", proof: "A runnable example, a small test set, and concise notes explaining the result and its limitations." };
}

const navItems = [
  ["dashboard", "⌂", "Overview"], ["roadmap", "▦", "Roadmap"], ["resources", "↗", "Resources"],
  ["projects", "◇", "Projects"], ["weekly", "◷", "Weekly plan"], ["glossary", "Aa", "Glossary"], ["readiness", "✓", "Readiness"]
] as const;
type Tab = typeof navItems[number][0];
export default function App() {
  const { user, loading: authLoading } = useAuth();
  const supabase = getSupabaseClient();
  const [data, setData] = useState<LearningData>(readLocal);
  const [tab, setTabState] = useState<Tab>(() => {
    const hash = window.location.hash.replace(/^#\/?/, "");
    const route = hash.startsWith("topic/") ? "roadmap" : hash;
    return navItems.some(([id]) => id === route) ? route as Tab : "dashboard";
  });
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(() => {
    const match = window.location.hash.replace(/^#\/?/, "").match(/^topic\/(.+)$/);
    return match?.[1] || null;
  });
  const [syncStatus, setSyncStatus] = useState<"local" | "loading" | "synced" | "error">("local");
  const [cloudReady, setCloudReady] = useState(false);
  const [query, setQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState("All areas");
  const [priorityFilter, setPriorityFilter] = useState("All priorities");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [resourceQuery, setResourceQuery] = useState("");
  const [glossaryQuery, setGlossaryQuery] = useState("");

  function setTab(next: Tab) {
    setTabState(next);
    setSelectedTopicId(null);
    window.history.pushState({ tab: next }, "", `${window.location.pathname}${window.location.search}#${next}`);
  }
  function openTopic(id: string) {
    setSelectedTopicId(id);
    setTabState("roadmap");
    window.history.pushState({ tab: "roadmap", topicId: id }, "", `${window.location.pathname}${window.location.search}#topic/${id}`);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function updateTopic(id: string, patch: Partial<TopicProgress>) {
    setData(current => {
      const old = current.topics[id] || { status: "Not started" as TopicStatus, confidence: 0, notes: "", timeEntries: [] };
      return { ...current, topics: { ...current.topics, [id]: { ...old, ...patch } } };
    });
  }
  function recordTopicTime(id: string, minutes: number, note: string) {
    const entry: TimeEntry = { id: crypto.randomUUID(), date: new Date().toISOString(), minutes, note };
    setData(current => {
      const old = current.topics[id] || { status: "Not started" as TopicStatus, confidence: 0, notes: "", timeEntries: [] };
      return { ...current, topics: { ...current.topics, [id]: { ...old, timeEntries: [...old.timeEntries, entry] } } };
    });
  }
  useEffect(() => {
    const syncRoute = () => {
      const hash = window.location.hash.replace(/^#\/?/, "");
      const match = hash.match(/^topic\/(.+)$/);
      setSelectedTopicId(match?.[1] || null);
      const route = match ? "roadmap" : hash;
      setTabState(navItems.some(([id]) => id === route) ? route as Tab : "dashboard");
    };
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => { window.removeEventListener("hashchange", syncRoute); window.removeEventListener("popstate", syncRoute); };
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);

  useEffect(() => {
    let active = true;
    if (authLoading) return () => { active = false; };
    if (!user || !supabase) { setCloudReady(false); setSyncStatus("local"); return () => { active = false; }; }
    setCloudReady(false);
    setSyncStatus("loading");
    void (async () => {
      try {
        const local = readLocal();
        const owner = localStorage.getItem(OWNER_KEY);
        const safeLocal = !owner || owner === user.id ? local : emptyData();
        const remote = await loadLearningData(supabase, user.id);
        if (!active) return;
        // Old Communication Skills payloads are intentionally not imported into this module.
        const normalizedRemote = normalizeData(remote);
        const next = remote === null ? safeLocal : normalizedRemote;
        setData(next);
        localStorage.setItem(OWNER_KEY, user.id);
        setCloudReady(true);
        setSyncStatus("synced");
      } catch (error) {
        console.error("Unable to load GenAI learning data:", error);
        if (active) { setCloudReady(false); setSyncStatus("error"); }
      }
    })();
    return () => { active = false; };
  }, [user?.id, authLoading, supabase]);

  useEffect(() => {
    if (!user || !supabase || !cloudReady || authLoading) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void saveLearningData(supabase, user.id, data).then(() => {
        if (!active) return;
        setSyncStatus("synced");
        // After the new module has successfully replaced the old cloud payload, remove retired local-only keys.
        localStorage.removeItem("communication-lab-v1");
        localStorage.removeItem("communication-lab-last-category");
        localStorage.removeItem("communication-lab-cloud-owner");
      }).catch(error => {
        console.error("Unable to save GenAI learning data:", error);
        if (active) setSyncStatus("error");
      });
    }, 500);
    return () => { active = false; window.clearTimeout(timer); };
  }, [data, user?.id, authLoading, cloudReady, supabase]);

  const areas = useMemo(() => ["All areas", ...Array.from(new Set(topics.map(t => t.area)))], []);
  const filteredTopics = useMemo(() => topics.filter(t =>
    (areaFilter === "All areas" || t.area === areaFilter) &&
    (priorityFilter === "All priorities" || t.priority === priorityFilter) &&
    (statusFilter === "All statuses" || topicStatus(t.id) === statusFilter) &&
    (t.title.toLowerCase().includes(query.toLowerCase()) || t.area.toLowerCase().includes(query.toLowerCase()))
  ), [areaFilter, priorityFilter, statusFilter, query, data.topics]);
  const topicStatus = (id: string): TopicStatus => data.topics[id]?.status || "Not started";
  const completedTopics = topics.filter(t => topicStatus(t.id) === "Mastered").length;
  const startedTopics = topics.filter(t => topicStatus(t.id) !== "Not started").length;
  const estimatedHours = topics.reduce((sum, t) => sum + t.hours, 0);
  const masteredHours = topics.filter(t => topicStatus(t.id) === "Mastered").reduce((sum, t) => sum + t.hours, 0);
  const projectCount = projects.filter(p => statusOf(data.projects, p.id, "Not started") === "Completed").length;
  const weekCount = weeklyPlan.filter(w => statusOf(data.weeks, w.week, "Not started") === "Completed").length;
  const readinessCount = readinessChecks.filter(c => data.readiness[c.id]?.passed).length;
  const progressPercent = Math.round(completedTopics / topics.length * 100);
  const nextTopic = topics.find(t => topicStatus(t.id) !== "Mastered");
  const selectedTopic = topics.find(t => t.id === selectedTopicId);
  const filteredResources = resources.filter(r => `${r.title} ${r.type} ${r.coverage} ${r.id}`.toLowerCase().includes(resourceQuery.toLowerCase()));
  const filteredGlossary = glossary.filter(g => `${g.term} ${g.meaning}`.toLowerCase().includes(glossaryQuery.toLowerCase()));

  function updateProject(id: string, status: WorkStatus) { setData(current => ({ ...current, projects: { ...current.projects, [id]: status } })); }
  function updateWeek(id: string, status: WorkStatus) { setData(current => ({ ...current, weeks: { ...current.weeks, [id]: status } })); }
  function toggleResource(id: string) { setData(current => ({ ...current, completedResources: current.completedResources.includes(id) ? current.completedResources.filter(x => x !== id) : [...current.completedResources, id] })); }
  function updateReadiness(id: string, patch: Partial<{ passed: boolean; evidence: string }>) {
    setData(current => ({ ...current, readiness: { ...current.readiness, [id]: { passed: current.readiness[id]?.passed || false, evidence: current.readiness[id]?.evidence || "", ...patch } } }));
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup"><div className="brand-mark" aria-label="AI learning mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4.5 25.5 10v12L16 27.5 6.5 22V10z" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="16" cy="16" r="3.2" fill="currentColor"/><circle cx="16" cy="7.5" r="1.5" fill="#b8d4a9"/><circle cx="23.3" cy="20.2" r="1.5" fill="#b8d4a9"/><circle cx="8.7" cy="20.2" r="1.5" fill="#b8d4a9"/></svg></div><div className="brand-copy"><b>GenAI Learning Lab</b><small>Learn · Build · Evaluate</small></div></div>
      <div className="sidebar-account"><span>YOUR ACCOUNT</span><strong>{user ? (user.user_metadata?.username || user.email?.split("@")[0] || "Learner") : "Personal workspace"}</strong></div>
      <p className="nav-label">LEARNING WORKSPACE</p>
      <nav>{navItems.map(([id, icon, label]) => <button key={id} className={`nav-link ${tab === id ? "selected" : ""}`} onClick={() => setTab(id)}><span className="nav-icon">{icon}</span>{label}{id === "readiness" && <small>{readinessCount}/{readinessChecks.length}</small>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="mini-progress-head"><span>TOPIC MASTERY</span><b>{progressPercent}%</b></div>
        <div className="progress-track"><i style={{ width: `${progressPercent}%` }} /></div>
        <small>{completedTopics} of {topics.length} topics mastered</small>
        <div className={`sync-indicator ${syncStatus}`}><i />{!user ? "Saved on this device" : syncStatus === "loading" ? "Loading cloud progress…" : syncStatus === "synced" ? "Cloud sync active" : "Sync issue · local save active"}</div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div><span className="breadcrumb">WORKSPACE</span><span className="breadcrumb-divider">/</span><b>{navItems.find(([id]) => id === tab)?.[2]}</b></div>
        <div className="topbar-right"><span className="page-context">Learn · Build · Evaluate</span></div>
      </header>
      <div className="page-content">
        {tab === "dashboard" && <section>
          <div className="hero-panel">
            <div className="hero-copy"><p className="eyebrow">YOUR DOMAIN-INDEPENDENT AI LEARNING PATH</p><h1>Learn the systems.<br /><em>Build the intelligence.</em></h1><p>Move from LLM fundamentals to reliable agents through practical evidence, deliberate practice, and projects you can demonstrate.</p><div className="hero-actions"><button className="button-primary" onClick={() => setTab("roadmap")}>Continue learning <span>↗</span></button><button className="button-quiet" onClick={() => setTab("projects")}>Explore project labs</button></div></div>
            <div className="hero-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core">AI<span>+</span></div><span className="orbit-tag tag-llm">LLMs</span><span className="orbit-tag tag-rag">RAG</span><span className="orbit-tag tag-agent">Agents</span><span className="orbit-tag tag-eval">Evals</span></div>
          </div>
          <div className="stat-grid">
            <article className="stat-card"><span className="stat-icon">▦</span><small>TOPICS STARTED</small><strong>{startedTopics}<span> / {topics.length}</span></strong><div className="progress-track"><i style={{width:`${startedTopics/topics.length*100}%`}} /></div></article>
            <article className="stat-card"><span className="stat-icon">✦</span><small>TOPICS MASTERED</small><strong>{completedTopics}<span> / {topics.length}</span></strong><div className="progress-track"><i style={{width:`${progressPercent}%`}} /></div></article>
            <article className="stat-card"><span className="stat-icon">⌘</span><small>PROJECT LABS</small><strong>{projectCount}<span> / {projects.length} complete</span></strong><div className="progress-track"><i style={{width:`${projectCount/projects.length*100}%`}} /></div></article>
            <article className="stat-card"><span className="stat-icon">◷</span><small>ESTIMATED ROADMAP</small><strong>{estimatedHours}<span> learning hours</span></strong><small className="stat-foot">{masteredHours} hours represented by mastered topics</small></article>
          </div>
          <div className="section-heading"><div><p className="eyebrow">YOUR NEXT STEP</p><h2>Pick up where you left off</h2></div><button className="text-button" onClick={() => setTab("roadmap")}>View full roadmap ↗</button></div>
          {nextTopic ? <article className="continue-card"><div className="continue-number">{nextTopic.id.slice(1,3)}</div><div className="continue-copy"><span>{nextTopic.area} · {nextTopic.level}</span><h3>{nextTopic.title}</h3><p>{nextTopic.hours} estimated hours · {nextTopic.priority} priority</p></div><button className="button-primary" onClick={() => {setQuery(nextTopic.title);setAreaFilter("All areas");setStatusFilter("All statuses");setPriorityFilter("All priorities");setTab("roadmap");}}>Open topic →</button></article> : <article className="empty-state"><h3>Roadmap mastered — now prove it in your projects.</h3><button className="button-primary" onClick={() => setTab("projects")}>Open project labs</button></article>}
          <div className="two-column-panels"><article className="panel"><div className="section-heading compact"><div><p className="eyebrow">SUGGESTED FIRST PASS</p><h2>12-week learning sequence</h2></div><button className="text-button" onClick={() => setTab("weekly")}>Open plan ↗</button></div>{weeklyPlan.slice(0,4).map(w=><div className="mini-row" key={w.week}><span className="mini-index">{w.week.padStart(2,"0")}</span><div><b>{w.focus}</b><small>{w.output}</small></div><span className="row-status">{statusOf(data.weeks,w.week,"Not started") === "Completed" ? "✓" : "→"}</span></div>)}</article><article className="panel"><div className="section-heading compact"><div><p className="eyebrow">BUILD PROOF, NOT JUST NOTES</p><h2>Portfolio project labs</h2></div><button className="text-button" onClick={() => setTab("projects")}>All projects ↗</button></div>{projects.slice(0,3).map(p=><div className="mini-row" key={p.id}><span className="project-token">{p.id}</span><div><b>{p.title}</b><small>{p.topics}</small></div><span className="row-status">{statusOf(data.projects,p.id,"Not started") === "Completed" ? "✓" : "→"}</span></div>)}</article></div>
          <div className="note-banner"><span>✦</span><div><b>Progress is evidence, not time spent.</b><p>Mark a topic as mastered only when you can explain it, implement it, and show the practical proof. The 12-week plan is a first pass, not a promise of mastery.</p></div><button className="button-quiet" onClick={() => setTab("readiness")}>Check readiness</button></div>
        </section>}

        {tab === "roadmap" && !selectedTopic && <section><div className="page-intro"><p className="eyebrow">89 TOPICS · 13 LEARNING AREAS</p><h1>The master <em>roadmap.</em></h1><p>Track status, confidence, and personal questions. Use practical projects to turn each topic into demonstrable skill.</p></div>
          <div className="roadmap-summary"><div><b>{completedTopics}</b><span>Mastered</span></div><div><b>{startedTopics}</b><span>Started</span></div><div><b>{estimatedHours}</b><span>Estimated hours</span></div><div><b>{progressPercent}%</b><span>Mastery progress</span></div></div>
          <div className="filters"><label className="search-box"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search topics or areas…" /></label><select value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}>{areas.map(a=><option key={a}>{a}</option>)}</select><select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>{["All priorities","Core","Important","Optional","Core for RAG","Core for production RAG","Core for long-running agents","Core for production MCP"].map(s=><option key={s}>{s}</option>)}</select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{["All statuses",...topicStatuses].map(s=><option key={s}>{s}</option>)}</select></div>
          <div className="result-label">Showing {filteredTopics.length} of {topics.length} topics</div>
          <div className="topic-list">{filteredTopics.map(t=>{const p=data.topics[t.id]||{status:"Not started" as TopicStatus,confidence:0,notes:"",timeEntries:[]};return <article className="topic-card topic-card-clickable" key={t.id} role="link" tabIndex={0} onClick={()=>openTopic(t.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openTopic(t.id);}}}><div className="topic-marker">{p.status==="Mastered"?"✓":t.id.slice(-2)}</div><div className="topic-main"><div className="topic-tags"><span>{t.area}</span><span className={t.priority.startsWith("Core")?"priority-core":t.priority==="Optional"?"priority-optional":"priority-important"}>{t.priority}</span><span>{t.level}</span><span>{t.hours}h</span></div><h3>{t.title}</h3>{p.notes.trim()&&<p className="topic-note-preview">{p.notes}</p>}</div><div className="topic-card-meta"><span className={"topic-status-badge status-"+p.status.toLowerCase().replaceAll(" ","-")}>{p.status}</span><span className="confidence-rate">{p.confidence?"Confidence "+p.confidence+"/5":"Confidence not rated"}</span><span className="topic-open-hint">Open topic ↗</span></div></article>})}</div>
        </section>}


        {tab === "roadmap" && selectedTopic && <section className="topic-detail-page">
          <button className="back-link" onClick={() => setTab("roadmap")}>← Back to roadmap</button>
          {selectedTopic ? (() => {
            const p = data.topics[selectedTopic.id] || { status: "Not started" as TopicStatus, confidence: 0, notes: "", timeEntries: [] };
            const totalMinutes = p.timeEntries.reduce((sum, entry) => sum + entry.minutes, 0);
            const guide = guideForArea(selectedTopic.area);
            return <>
              <div className="topic-detail-hero">
                <div className="topic-tags"><span>{selectedTopic.area}</span><span>{selectedTopic.level}</span><span>{selectedTopic.hours} estimated hours</span></div>
                <h1>{selectedTopic.title}</h1>
                <p>Understand the concept, apply it in a small experiment, and keep evidence of what you can demonstrate.</p>
                <div className="topic-detail-stats"><div><span>TIME INVESTED</span><b>{formatMinutes(totalMinutes)}</b></div><div><span>STATUS</span><b>{p.status}</b></div><div><span>CONFIDENCE</span><b>{p.confidence ? p.confidence + "/5" : "Not rated"}</b></div></div>
              </div>
              <div className="topic-detail-grid">
                <div className="topic-learning-column">
                  <article className="detail-panel"><span className="detail-step">01 · UNDERSTAND</span><h2>What to learn</h2><p>{guide.learn}</p><ul><li>Explain <strong>{selectedTopic.title}</strong> in your own words.</li><li>Understand when it is useful, its limitations, and common failure cases.</li><li>Connect it to the broader area of {selectedTopic.area.toLowerCase()}.</li></ul></article>
                  <article className="detail-panel"><span className="detail-step">02 · PRACTICE</span><h2>How to learn</h2><ol><li>Start with one relevant official resource from the Resources tab.</li><li>{guide.practice}</li><li>Change one variable at a time, observe the result, and write down what changed.</li><li>Explain the concept without copying your notes.</li></ol></article>
                  <article className="detail-panel"><span className="detail-step">03 · SHOW YOUR WORK</span><h2>Practical proof / deliverables</h2><p>{guide.proof}</p><ul><li>A small working example or reproducible experiment.</li><li>At least one test or comparison that demonstrates expected and failure behavior.</li><li>A short README or note with results, limitations, and next steps.</li></ul></article>
                </div>
                <aside className="topic-detail-sidebar">
                  <article className="detail-panel tracking-panel"><span className="detail-step">YOUR PROGRESS</span><h2>Learning record</h2><label>Status<select value={p.status} onChange={e => updateTopic(selectedTopic.id, { status: e.target.value as TopicStatus })}>{topicStatuses.map(s => <option key={s}>{s}</option>)}</select></label><label>Confidence<select value={p.confidence} onChange={e => updateTopic(selectedTopic.id, { confidence: Number(e.target.value) })}><option value={0}>Not rated</option>{[1,2,3,4,5].map(n => <option value={n} key={n}>{n} / 5</option>)}</select></label><div className="total-time"><span>TOTAL TIME SPENT</span><strong>{formatMinutes(totalMinutes)}</strong><small>{p.timeEntries.length} recorded {p.timeEntries.length === 1 ? "session" : "sessions"}</small></div></article>
                  <article className="detail-panel"><span className="detail-step">TIME TRACKER</span><h2>Record a session</h2><form className="time-entry-form" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const values = new FormData(form); const minutes = Number(values.get("minutes")); if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return; recordTopicTime(selectedTopic.id, minutes, String(values.get("note") || "").trim()); form.reset(); }}><label>Duration (minutes)<input name="minutes" type="number" min="1" max="1440" defaultValue="30" required /></label><label>Session note<textarea name="note" rows={2} placeholder="What did you work on? (optional)" /></label><button className="button-primary" type="submit">+ Record time</button></form><p className="time-hint">Record the actual time spent learning or practicing this topic.</p></article>
                  <article className="detail-panel"><span className="detail-step">REFLECT</span><h2>Learning notes</h2><textarea className="topic-notes-editor" value={p.notes} onChange={e => updateTopic(selectedTopic.id, { notes: e.target.value })} rows={7} placeholder="Key takeaways, questions, experiments, links to evidence, or what you want to revisit…" /><small className="autosave-hint">Saved automatically to your learning progress.</small></article>
                  {p.timeEntries.length > 0 && <article className="detail-panel"><span className="detail-step">SESSION HISTORY</span><h2>Recorded sessions</h2><div className="time-history">{[...p.timeEntries].reverse().map(entry => <div className="time-history-row" key={entry.id}><b>{formatMinutes(entry.minutes)}</b><small>{new Date(entry.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</small>{entry.note && <p>{entry.note}</p>}</div>)}</div></article>}
                </aside>
              </div>
            </>;
          })() : <div className="empty-state">Topic not found. <button className="button-quiet" onClick={() => setTab("roadmap")}>Return to roadmap</button></div>}
        </section>}

        {tab === "resources" && <section><div className="page-intro"><p className="eyebrow">20 CURATED LEARNING RESOURCES</p><h1>Learn from <em>the source.</em></h1><p>Prioritize official documentation for exact API behavior; use courses and videos to build intuition. API and model usage may have separate costs.</p></div><label className="search-box resource-search"><span>⌕</span><input value={resourceQuery} onChange={e=>setResourceQuery(e.target.value)} placeholder="Search courses, docs, or topics…" /></label><div className="resource-grid">{filteredResources.map(r=><article className="resource-card" key={r.id}><div className="resource-top"><span className="resource-id">{r.id}</span><label className="check-label"><input type="checkbox" checked={data.completedResources.includes(r.id)} onChange={()=>toggleResource(r.id)}/> Reviewed</label></div><p className="resource-type">{r.type}</p><h3>{r.title}</h3><p>{r.coverage}</p><div className="resource-meta"><span>{r.difficulty}</span><span>{r.cost}</span></div><div className="resource-actions"><a href={r.url} target="_blank" rel="noreferrer">Open resource ↗</a><a href={r.video} target="_blank" rel="noreferrer">Video ↗</a></div></article>)}</div></section>}

        {tab === "projects" && <section><div className="page-intro"><p className="eyebrow">10 PROGRESSIVE PROJECT LABS</p><h1>Build your <em>portfolio.</em></h1><p>A project is complete only when the behavior is tested, documented, and demonstrable. Track status here; store the actual code and evidence in your project repository.</p></div><div className="project-progress"><div><b>{projectCount}/{projects.length}</b><span>labs completed</span></div><div className="progress-track"><i style={{width:`${projectCount/projects.length*100}%`}} /></div></div><div className="project-grid">{projects.map((p,i)=>{const status=statusOf(data.projects,p.id,"Not started");return <article className="project-card" key={p.id}><div className="project-card-top"><span className="project-token">{p.id}</span><span className={`priority-pill ${p.priority==="Core"?"priority-core":p.priority==="Capstone"?"priority-capstone":"priority-important"}`}>{p.priority}</span></div><div className="project-step">PROJECT {String(i+1).padStart(2,"0")}</div><h3>{p.title}</h3><p>{p.description}</p><div className="project-detail"><b>Topics demonstrated</b><span>{p.topics}</span></div><div className="project-detail"><b>Definition of done</b><span>{p.done}</span></div><label className="status-field"><span>Project status</span><select value={status} onChange={e=>updateProject(p.id,e.target.value as WorkStatus)}>{workStatuses.map(s=><option key={s}>{s}</option>)}</select></label></article>})}</div></section>}

        {tab === "weekly" && <section><div className="page-intro"><p className="eyebrow">SUGGESTED 12-WEEK FIRST PASS</p><h1>Learn in <em>sequence.</em></h1><p>This is a practical first pass, not the full mastery timeline. Extend any week until you can build and test the deliverable.</p></div><div className="weekly-banner"><b>{weekCount} of 12 weeks completed</b><div className="progress-track"><i style={{width:`${weekCount/12*100}%`}} /></div></div><div className="week-list">{weeklyPlan.map(w=>{const status=statusOf(data.weeks,w.week,"Not started");return <article className="week-card" key={w.week}><div className="week-number">WEEK <b>{w.week.padStart(2,"0")}</b></div><div className="week-copy"><h3>{w.focus}</h3><p>{w.output}</p><div className="week-resource"><span>Suggested resources</span><b>{w.resources}</b></div><small>{w.duration}</small></div><label className="status-field"><span>Status</span><select value={status} onChange={e=>updateWeek(w.week,e.target.value as WorkStatus)}>{workStatuses.map(s=><option key={s}>{s}</option>)}</select></label></article>})}</div></section>}

        {tab === "glossary" && <section><div className="page-intro"><p className="eyebrow">16 KEY TERMS</p><h1>Speak the <em>language.</em></h1><p>Build technical fluency one concept at a time. Search for a term or phrase to find its plain-English meaning.</p></div><label className="search-box resource-search"><span>⌕</span><input value={glossaryQuery} onChange={e=>setGlossaryQuery(e.target.value)} placeholder="Search glossary…" /></label><div className="glossary-list">{filteredGlossary.map((g,i)=><article className="glossary-card" key={g.term}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{g.term}</h3><p>{g.meaning}</p></div></article>)}</div></section>}

        {tab === "readiness" && <section><div className="page-intro"><p className="eyebrow">EVIDENCE BEFORE CONFIDENCE</p><h1>Check your <em>readiness.</em></h1><p>Use this checklist when you have evidence to show. Course completion alone does not establish job readiness.</p></div><div className="readiness-summary"><b>{readinessCount} / {readinessChecks.length}</b><span>capabilities evidenced</span><div className="progress-track"><i style={{width:`${readinessCount/readinessChecks.length*100}%`}} /></div></div><div className="readiness-list">{readinessChecks.map((c,i)=><article className={`readiness-card ${data.readiness[c.id]?.passed?"passed":""}`} key={c.id}><label className="readiness-check"><input type="checkbox" checked={data.readiness[c.id]?.passed||false} onChange={e=>updateReadiness(c.id,{passed:e.target.checked})}/><span>{String(i+1).padStart(2,"0")}</span></label><div className="readiness-copy"><h3>{c.title}</h3><p>{c.evidence}</p><textarea value={data.readiness[c.id]?.evidence||""} onChange={e=>updateReadiness(c.id,{evidence:e.target.value})} placeholder="Evidence link, project, test report, or notes…" rows={2}/></div></article>)}</div><div className="note-banner"><span>✦</span><div><b>Use proof to guide the next step.</b><p>A checked item means you have evidence you can demonstrate, not simply that you have read about it.</p></div></div></section>}

        <section className="journal-panel"><div><p className="eyebrow">PERSONAL LEARNING LOG</p><h2>Questions, insights, next actions</h2><p>Keep a lightweight running note for ideas that do not belong to a single topic.</p></div><textarea value={data.journal} onChange={e=>setData(current=>({...current,journal:e.target.value}))} rows={4} placeholder="What confused you? What will you test next? What did you learn by building?" /></section>
      </div>
      <footer><span>GENAI LEARNING LAB</span><span>Learn deliberately. Build responsibly. Verify with evidence.</span><span>{syncStatus === "synced" ? "All changes synced" : syncStatus === "error" ? "Cloud sync needs attention" : "Progress saves automatically"}</span></footer>
    </main>
  </div>;
}
