import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "/api/v1";

const DEMO_DASHBOARD = {
  total_roads: 12,
  total_segments: 48,
  total_defects: 41,
  defect_type_count: { Pothole: 14, Crack: 22, Rutting: 5 },
  severity_wise_count: { High: 8, Medium: 18, Low: 15 },
  healthy_segments: 30,
  damaged_segments: 18,
  overall_health_score: 74.2,
};

const MAP_ROADS = [
  {
    road_id: "RD-001",
    road_name: "NH-9 Civil Lines Road",
    segment_id: "SEG-101",
    chainage_start_km: 0,
    chainage_end_km: 2.5,
    coordinates: [
      { lat: 28.9845, lng: 77.7064 },
      { lat: 28.9852, lng: 77.7081 },
    ],
  },
  {
    road_id: "RD-002",
    road_name: "Garh Road Link",
    segment_id: "SEG-102",
    chainage_start_km: 2.5,
    chainage_end_km: 5,
    coordinates: [
      { lat: 28.986, lng: 77.71 },
      { lat: 28.9875, lng: 77.7125 },
    ],
  },
];

const MENU = [
  ["Dashboard", "⌂"],
  ["Roads", "▰"],
  ["Inspections", "↑"],
  ["AI Results", "✦"],
  ["History", "◷"],
  ["Comparison", "⇄"],
  ["Drafts", "▤"],
  ["Changes", "↻"],
  ["Map / GIS", "⌖"],
  ["Reports", "▧"],
];

const DEFECTS = [
  ["D00", "Longitudinal Crack"],
  ["D10", "Transverse Crack"],
  ["D20", "Alligator / Block Crack"],
  ["D40", "Pothole"],
];

function firstDefined(...values) {
  return values.find((v) => v !== undefined && v !== null);
}

function normalizeInspection(raw) {
  if (!raw) return null;

  const ai = raw.ai_detection || raw.aiDetection || {};
  const nested =
    ai.metrics ||
    ai.analysis ||
    ai.result ||
    raw.metrics ||
    raw.analysis ||
    raw.result ||
    {};

  const source = { ...raw, ...nested };

  let counts = firstDefined(
    source.defect_counts,
    ai.defect_counts,
    source.defectCounts,
    {}
  ) || {};

  // Some backend responses expose raw detections instead of defect_counts.
  // Build the four RoadLens classes from those detections as a frontend-safe fallback.
  const detections = firstDefined(
    ai.ai_detections,
    ai.aiDetections,
    raw.ai_detections,
    raw.aiDetections,
    source.ai_detections,
    source.aiDetections,
    []
  );

  const aliases = {
    d00: "D00", "longitudinal crack": "D00",
    d10: "D10", "transverse crack": "D10",
    d20: "D20", "alligator crack": "D20", "block crack": "D20", "alligator / block crack": "D20",
    d40: "D40", pothole: "D40"
  };

  // Backend currently returns defect_counts such as {"pothole": 5}.
  // Convert those backend labels to the RoadLens D00/D10/D20/D40 display codes.
  const normalizedCounts = { D00: 0, D10: 0, D20: 0, D40: 0 };
  for (const [label, value] of Object.entries(counts || {})) {
    const key = String(label).trim().toLowerCase();
    const code = aliases[key] || String(label).trim().toUpperCase();
    if (normalizedCounts[code] !== undefined) {
      normalizedCounts[code] += Number(value) || 0;
    }
  }
  counts = normalizedCounts;

  if (Object.values(counts).every((value) => value === 0) && Array.isArray(detections)) {
    for (const detection of detections) {
      const rawLabel =
        detection?.class_name ??
        detection?.class ??
        detection?.label ??
        detection?.name ??
        detection?.defect_type ??
        detection?.defect ??
        "";
      const key = String(rawLabel).trim().toLowerCase();
      const code = aliases[key] || String(rawLabel).trim().toUpperCase();
      if (counts[code] !== undefined) counts[code] += 1;
    }
  }

  return {
    ...raw,
    ai_detection: {
      ...ai,
      ...nested,
      metrics: {
        ...nested,
        ...ai.metrics,
        health_score: firstDefined(
          nested.health_score,
          ai.metrics?.health_score,
          raw.health_score,
          source.health_score
        ),
        severity_score: firstDefined(
          nested.severity_score,
          ai.metrics?.severity_score,
          raw.severity_score,
          source.severity_score
        ),
        priority: firstDefined(
          nested.priority,
          ai.metrics?.priority,
          raw.priority,
          source.priority
        ),
        defect_counts: counts || {},
      },
    },
    image_name: firstDefined(
      raw.image_name,
      nested.image_name,
      ai.inspection_info?.image_name
    ),
  };
}

function getMetrics(item) {
  return normalizeInspection(item)?.ai_detection?.metrics || {};
}

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [dashboard, setDashboard] = useState(DEMO_DASHBOARD);
  const [history, setHistory] = useState([]);
  const [roads, setRoads] = useState([]);
  const [mapDefects, setMapDefects] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [changes, setChanges] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);
  const [reportLink, setReportLink] = useState("");

  const apiGet = async (path, fallback) => {
    try {
      const response = await fetch(`${API}${path}`);
      if (!response.ok) throw new Error("API error");
      const data = await response.json();
      setBackendOnline(true);
      return data;
    } catch {
      setBackendOnline(false);
      return fallback;
    }
  };

  const refresh = async () => {
    const [d, h, r, m, dr, ch] = await Promise.all([
      apiGet("/dashboard/stats", { stats: DEMO_DASHBOARD }),
      apiGet("/history", { history: [] }),
      apiGet("/roads", { roads: [] }),
      apiGet("/map/defects", { defects: [] }),
      apiGet("/drafts", { drafts: [] }),
      apiGet("/history/changes", { changes: [] }),
    ]);

    setDashboard(d.stats || DEMO_DASHBOARD);
    setHistory((h.history || []).map(normalizeInspection).filter(Boolean));
    setRoads(r.roads || []);
    setMapDefects(m.defects || []);
    setDrafts(dr.drafts || []);
    setChanges(ch.changes || []);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const openInspection = (item) => {
    setSelected(normalizeInspection(item));
    setPage("AI Results");
  };

  const upload = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.image.files?.[0];
    if (!file) return;

    setLoading(true);
    setToast("");

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("road_id", form.road_id.value.trim() || "ROAD_001");
      body.append("segment_id", form.segment_id.value.trim() || "SEG_10");

      const response = await fetch(`${API}/inspect`, {
        method: "POST",
        body,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Inspection failed");
      }

      // The backend returns the inspection response, while the history endpoint
      // contains the stored record with the final analysis fields. Refresh first
      // and select the newest record so AI Results always shows the actual data.
      const h = await apiGet("/history", { history: [] });
      const latest = (h.history || []).map(normalizeInspection).filter(Boolean);

      setHistory(latest);
      const newest = latest[latest.length - 1];

      setSelected(
        newest ||
          normalizeInspection(result) || {
            ...result,
            image_name: file.name,
          }
      );

      setToast("Inspection completed successfully.");
      setPage("AI Results");
      form.reset();
    } catch (error) {
      setToast(error.message || "Could not complete inspection.");
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const response = await fetch(`${API}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          road_id: form.road_id.value,
          segment_id: form.segment_id.value,
          entered_details: form.details.value,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not save draft");
      setToast("Draft saved.");
      await refresh();
    } catch (error) {
      setToast(error.message || "Could not save draft.");
    }
  };

  const generateReport = async () => {
    try {
      const response = await fetch(`${API}/reports/generate`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Report generation failed");
      setReportLink(data.download_link || "");
      setToast("Live PDF report generated successfully.");
    } catch (error) {
      setToast(error.message || "Connect the backend to generate a live report.");
    }
  };

  const totalDefects = useMemo(
    () =>
      Object.values(dashboard.defect_type_count || {}).reduce(
        (sum, value) => sum + Number(value || 0),
        0
      ),
    [dashboard]
  );

  const pageTitle = page === "Dashboard" ? "Road Intelligence Dashboard" : page;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>RoadLens <i>AI</i></strong>
            <small>Intelligent Road Inspection</small>
          </div>
        </div>

        <nav>
          {MENU.map(([name, icon]) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => setPage(name)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={backendOnline ? "online-dot" : "offline-dot"} />
          {backendOnline ? "System Online" : "Demo Mode"}
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">ROADLENS AI</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="profile">
            <div className="avatar">P</div>
            <div>
              <strong>Prabhneet</strong>
              <span>Frontend</span>
            </div>
          </div>
        </header>

        {page === "Dashboard" && (
          <Dashboard
            data={dashboard}
            totalDefects={totalDefects}
            history={history}
            onSelect={openInspection}
          />
        )}

        {page === "Roads" && <RoadsPage roads={roads.length ? roads : MAP_ROADS} />}
        {page === "Inspections" && <InspectionPage onSubmit={upload} loading={loading} />}
        {page === "AI Results" && <ResultsPage item={selected || history[history.length - 1]} />}
        {page === "History" && <HistoryPage data={history} onSelect={openInspection} />}
        {page === "Comparison" && (
          <ComparisonPage data={history} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
        )}
        {page === "Drafts" && (
          <DraftsPage data={drafts} onSave={saveDraft} />
        )}
        {page === "Changes" && <ChangesPage data={changes} />}
        {page === "Map / GIS" && <MapPage defects={mapDefects} roads={roads.length ? roads : MAP_ROADS} />}
        {page === "Reports" && <ReportsPage onGenerate={generateReport} reportLink={reportLink} />}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Panel({ eyebrow, title, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Dashboard({ data, totalDefects, history, onSelect }) {
  const health = Number(data.overall_health_score || 0);
  const defectRows = [
    ["Potholes", data.defect_type_count?.Pothole || 0],
    ["Cracks", data.defect_type_count?.Crack || 0],
    ["Rutting", data.defect_type_count?.Rutting || 0],
  ];

  return (
    <>
      <div className="stats-grid">
        <StatCard icon="▰" label="Total Roads" value={data.total_roads} />
        <StatCard icon="⌖" label="Total Segments" value={data.total_segments} />
        <StatCard icon="!" label="Detected Defects" value={data.total_defects ?? totalDefects} />
        <StatCard icon="♥" label="Road Health" value={`${health}%`} />
      </div>

      <div className="dashboard-grid">
        <Panel eyebrow="NETWORK CONDITION" title="Overall Road Health">
          <div className="health-layout">
            <div className="health-ring" style={{ "--health": `${health * 3.6}deg` }}>
              <div>
                <strong>{health.toFixed(1)}</strong>
                <span>/100</span>
              </div>
            </div>
            <div className="health-copy">
              <span className={`condition ${health >= 80 ? "good" : health >= 60 ? "warn" : "critical"}`}>
                {health >= 80 ? "Healthy Network" : health >= 60 ? "Needs Attention" : "Critical Condition"}
              </span>
              <h3>Network condition snapshot</h3>
              <p>Current road health calculated from inspection analysis.</p>
              <Progress label="Healthy Segments" value={data.healthy_segments} max={data.total_segments} />
              <Progress label="Damaged Segments" value={data.damaged_segments} max={data.total_segments} />
            </div>
          </div>
        </Panel>

        <Panel eyebrow="ACTION QUEUE" title="Repair Priority">
          <Priority label="High" value={data.severity_wise_count?.High || 0} note="Immediate attention" />
          <Priority label="Medium" value={data.severity_wise_count?.Medium || 0} note="Plan maintenance" />
          <Priority label="Low" value={data.severity_wise_count?.Low || 0} note="Routine monitoring" />
        </Panel>
      </div>

      <div className="dashboard-grid">
        <Panel eyebrow="DETECTED ISSUES" title="Defect Distribution">
          {defectRows.map(([name, value]) => {
            const percent = totalDefects ? (value / totalDefects) * 100 : 0;
            return (
              <div className="defect-row" key={name}>
                <div><span>{name}</span><b>{percent.toFixed(1)}%</b></div>
                <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
              </div>
            );
          })}
          <div className="mini-summary">
            <span>Total tracked defects</span>
            <strong>{totalDefects}</strong>
          </div>
        </Panel>

        <Panel
          eyebrow="LATEST ACTIVITY"
          title="Recent Inspections"
          action={<button className="text-button" onClick={() => onSelect(history[history.length - 1])} disabled={!history.length}>Open latest</button>}
        >
          {history.length ? (
            <div className="inspection-list">
              {history.slice(-5).reverse().map((item) => (
                <InspectionRow key={item.inspection_id || item.image_name} item={item} onClick={() => onSelect(item)} />
              ))}
            </div>
          ) : (
            <Empty text="No inspections yet. Upload a road image to start analysis." />
          )}
        </Panel>
      </div>
    </>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function Progress({ label, value, max }) {
  const percent = max ? Math.min(100, (Number(value) / Number(max)) * 100) : 0;
  return (
    <div className="progress-row">
      <div><span>{label}</span><b>{value}</b></div>
      <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function Priority({ label, value, note }) {
  return (
    <div className="priority-row">
      <div>
        <strong>{label} Priority</strong>
        <span>{note}</span>
      </div>
      <b>{value}</b>
    </div>
  );
}

function InspectionRow({ item, onClick }) {
  const metrics = getMetrics(item);
  const c = metrics.defect_counts || {};
  const defects = `D00 ${c.D00 || 0} · D10 ${c.D10 || 0} · D20 ${c.D20 || 0} · D40 ${c.D40 || 0}`;
  return (
    <button className="inspection-row" onClick={onClick}>
      <span className="road-chip">R</span>
      <span className="inspection-main">
        <strong>{item.road_id || "Road"} · {item.segment_id || "Segment"}</strong>
        <small>{item.date_time || item.image_name || "Inspection"} · {defects}</small>
      </span>
      <b>{metrics.health_score ?? "—"}%</b>
      <span className="history-severity">S {metrics.severity_percent ?? metrics.severity_score ?? "—"}%</span>
      <em className={metrics.priority === "High" ? "badge high" : metrics.priority === "Medium" ? "badge medium" : "badge low"}>
        {metrics.priority || "—"}
      </em>
    </button>
  );
}

function RoadsPage({ roads }) {
  return (
    <Panel eyebrow="NETWORK INVENTORY" title="Roads & Segments">
      <div className="road-table table-header">
        <span>ROAD / SEGMENT</span><span>CHAINAGE</span><span>HEALTH</span><span>STATUS</span>
      </div>
      {roads.map((road) => (
        <div className="road-table" key={`${road.road_id}-${road.segment_id}`}>
          <span>
            <strong>{road.road_name || road.road_id}</strong>
            <small>{road.road_id} · {road.segment_id}</small>
          </span>
          <span>{road.chainage || `${road.chainage_start_km} – ${road.chainage_end_km} km`}</span>
          <b>{road.health_score ?? "—"}</b>
          <em className="badge low">{road.current_condition || "Active"}</em>
        </div>
      ))}
    </Panel>
  );
}

function InspectionPage({ onSubmit, loading }) {
  return (
    <Panel eyebrow="AI INSPECTION" title="New Road Inspection">
      <form onSubmit={onSubmit}>
        <div className="upload-zone">
          <div className="upload-symbol">↑</div>
          <h3>Upload road image</h3>
          <p>Single image · YOLO defect detection + road health analysis</p>
          <label className="file-button">
            Choose image
            <input name="image" type="file" accept="image/*" required />
          </label>
        </div>

        <div className="form-grid">
          <label>Road ID<input name="road_id" defaultValue="ROAD_001" /></label>
          <label>Segment ID<input name="segment_id" defaultValue="SEG_10" /></label>
        </div>

        <div className="form-actions">
          <button className="primary" disabled={loading}>{loading ? "Analyzing image…" : "Run AI Inspection"}</button>
          <span className="hint">Supported: JPG, JPEG, PNG</span>
        </div>
      </form>
    </Panel>
  );
}

function ResultsPage({ item }) {
  if (!item) {
    return (
      <Panel eyebrow="DETECTION & ANALYSIS" title="AI Inspection Result">
        <Empty text="Upload an inspection or open a record from History." />
      </Panel>
    );
  }

  const normalized = normalizeInspection(item);
  const metrics = getMetrics(normalized);
  const counts = metrics.defect_counts || {};
  const imageName = normalized.image_name || "Inspection image";

  return (
    <>
      <Panel
        eyebrow="DETECTION & ANALYSIS"
        title="AI Inspection Result"
        action={<span className={`result-status ${metrics.priority?.toLowerCase() || ""}`}>{metrics.priority || "Analyzed"}</span>}
      >
        <div className="result-cards">
          <ResultCard label="Health Score" value={metrics.health_score ?? "—"} suffix={metrics.health_score !== undefined ? "/100" : ""} large />
          <ResultCard label="Severity Score" value={metrics.severity_score ?? "—"} />
          <ResultCard label="Repair Priority" value={metrics.priority ?? "—"} />
          <ResultCard label="Image" value={imageName} compact />
        </div>

        <div className="section-divider" />

        <div className="codes-grid">
          {DEFECTS.map(([code, name]) => (
            <div className="code-card" key={code}>
              <span>{code}</span>
              <small>{name}</small>
              <strong>{counts[code] || 0}</strong>
              <em>detections</em>
            </div>
          ))}
        </div>
      </Panel>

      <Panel eyebrow="INTERPRETATION" title="Decision Summary">
        <div className="decision-grid">
          <Decision title="Health" text={metrics.health_score >= 80 ? "Road condition is healthy." : metrics.health_score >= 60 ? "Maintenance attention is recommended." : "Immediate repair attention is recommended."} />
          <Decision title="Priority" text={`Priority is ${metrics.priority || "not available"} based on the analysis.`} />
          <Decision title="Next Step" text="Use History and Comparison to track how the segment changes over time." />
        </div>
      </Panel>
    </>
  );
}

function ResultCard({ label, value, suffix, large, compact }) {
  return (
    <div className="result-card">
      <span>{label}</span>
      <strong className={large ? "large" : compact ? "compact" : ""}>{value}</strong>
      {suffix && <small>{suffix}</small>}
    </div>
  );
}

function Decision({ title, text }) {
  return <div className="decision-card"><span>{title}</span><p>{text}</p></div>;
}

function HistoryPage({ data, onSelect }) {
  return (
    <Panel eyebrow="TRACK & COMPARE" title="Inspection History">
      {data.length ? (
        <div className="history-list">
          {data.slice().reverse().map((item) => (
            <InspectionRow key={item.inspection_id || item.image_name} item={item} onClick={() => onSelect(item)} />
          ))}
        </div>
      ) : (
        <Empty text="No inspection history available." />
      )}
    </Panel>
  );
}

function ComparisonPage({ data, selectedIds, setSelectedIds }) {
  const selected = data.filter((item) => selectedIds.includes(item.inspection_id));
  const [previous, current] = selected.length === 2 ? selected : [data[data.length - 2], data[data.length - 1]];

  const toggle = (id) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 2 ? [...ids, id] : [ids[1], id]);
  };

  if (data.length < 2) {
    return (
      <Panel eyebrow="ROAD CONDITION CHANGE" title="Previous vs Current">
        <Empty text="Upload a second inspection to enable comparison." />
      </Panel>
    );
  }

  const pm = getMetrics(previous);
  const cm = getMetrics(current);
  const healthDelta = Number(cm.health_score || 0) - Number(pm.health_score || 0);

  return (
    <Panel eyebrow="ROAD CONDITION CHANGE" title="Previous vs Current">
      <div className="comparison-picker">
        <span>Select two inspections</span>
        <div>{data.slice(-8).map((item) => (
          <button
            key={item.inspection_id}
            className={selectedIds.includes(item.inspection_id) ? "selected" : ""}
            onClick={() => toggle(item.inspection_id)}
          >
            {item.inspection_id || item.image_name}
          </button>
        ))}</div>
      </div>

      <div className="compare-grid">
        <CompareCard label="PREVIOUS" item={previous} metrics={pm} />
        <div className={`delta ${healthDelta >= 0 ? "positive" : "negative"}`}>
          <span>Health change</span>
          <strong>{healthDelta >= 0 ? "+" : ""}{healthDelta.toFixed(1)}</strong>
          <small>{healthDelta >= 0 ? "Improved" : "Declined"}</small>
        </div>
        <CompareCard label="CURRENT" item={current} metrics={cm} />
      </div>
    </Panel>
  );
}

function CompareCard({ label, item, metrics }) {
  return (
    <div className="compare-card">
      <span className="eyebrow">{label}</span>
      <h3>{item?.road_id || "Road"} · {item?.segment_id || "Segment"}</h3>
      <strong>{metrics.health_score ?? "—"}</strong>
      <small>Health score</small>
      <div className="compare-meta">
        <span>Severity <b>{metrics.severity_score ?? "—"}</b></span>
        <span>Priority <b>{metrics.priority ?? "—"}</b></span>
      </div>
    </div>
  );
}

function DraftsPage({ data, onSave }) {
  return (
    <div className="two-column">
      <Panel eyebrow="WORK IN PROGRESS" title="Save Inspection Draft">
        <form onSubmit={onSave}>
          <div className="form-stack">
            <label>Road ID<input name="road_id" defaultValue="ROAD_001" /></label>
            <label>Segment ID<input name="segment_id" defaultValue="SEG_10" /></label>
            <label>Details<textarea name="details" placeholder="Enter inspection notes or pending details..." /></label>
          </div>
          <button className="primary">Save Draft</button>
        </form>
      </Panel>

      <Panel eyebrow="SAVED RECORDS" title="Drafts">
        {data.length ? (
          <div className="history-list">
            {data.map((draft) => (
              <div className="record-card" key={draft.draft_id}>
                <div><strong>{draft.road_id} · {draft.segment_id}</strong><span>{draft.status || "Draft"}</span></div>
                <p>{draft.entered_details || "No details entered."}</p>
                <small>{draft.created_date || ""}</small>
              </div>
            ))}
          </div>
        ) : <Empty text="No drafts saved yet." />}
      </Panel>
    </div>
  );
}

function ChangesPage({ data }) {
  return (
    <Panel eyebrow="VERSION CONTROL" title="Changes & Version History">
      {data.length ? (
        <div className="change-list">
          {data.map((change) => (
            <div className="change-row" key={change.version_id}>
              <div className="version">v{change.version_id}</div>
              <div><strong>{change.record_changed || "Record updated"}</strong><span>{change.date_time || ""}</span></div>
              <div className="change-values"><span>{change.old_value || "—"}</span><b>→</b><span>{change.new_value || "—"}</span></div>
              <em>{change.changed_by || "System"}</em>
            </div>
          ))}
        </div>
      ) : <Empty text="No changes recorded yet." />}
    </Panel>
  );
}

function MapPage({ defects, roads }) {
  const points = defects.length
    ? defects.map((d) => ({
        ...d,
        latitude: d.latitude ?? d.lat,
        longitude: d.longitude ?? d.lng,
      }))
    : roads.flatMap((road) =>
        (road.coordinates || []).map((point, index) => ({
          road_id: road.road_id,
          segment_id: road.segment_id,
          latitude: point.lat,
          longitude: point.lng,
          chainage: `Point ${index + 1}`,
          severity: "—",
        }))
      );

  return (
    <Panel eyebrow="GPS + CHAINAGE" title="Map / GIS">
      <div className="map-layout">
        <div className="map-visual">
          <div className="map-grid-lines" />
          <div className="map-road road-a" />
          <div className="map-road road-b" />
          {points.slice(0, 12).map((point, index) => (
            <span
              className="map-pin"
              key={`${point.road_id}-${point.segment_id}-${index}`}
              style={{ left: `${12 + ((index * 13) % 76)}%`, top: `${18 + ((index * 19) % 64)}%` }}
              title={`${point.road_id || ""} ${point.chainage || ""}`}
            />
          ))}
          <div className="map-legend"><span className="pin-dot" /> Inspection / defect location</div>
        </div>

        <div className="map-records">
          {points.length ? points.map((point, index) => (
            <div className="map-record" key={`${point.road_id}-${point.segment_id}-${index}`}>
              <strong>{point.road_id} · {point.segment_id}</strong>
              <span>Chainage: {point.chainage || "—"}</span>
              <small>{Number(point.latitude || 0).toFixed(4)}, {Number(point.longitude || 0).toFixed(4)}</small>
              <em>{point.severity || point.marker_status || "Location"}</em>
            </div>
          )) : <Empty text="No GPS/defect points available." />}
        </div>
      </div>
    </Panel>
  );
}

function ReportsPage({ onGenerate, reportLink }) {
  return (
    <Panel eyebrow="EXPORT & SHARE" title="Road Inspection Reports">
      <div className="report-hero">
        <div className="report-icon">▧</div>
        <div>
          <h3>Generate an actual inspection report</h3>
          <p>Uses live AI inspection history, D00/D10/D20/D40 counts, severity, health and repair priority.</p>
        </div>
        <button className="primary" onClick={onGenerate}>Generate PDF Report</button>
      </div>

      {reportLink && (
        <div className="report-download">
          <strong>Report generated successfully</strong>
          <a className="primary report-link" href={reportLink} target="_blank" rel="noreferrer">Open / Download PDF</a>
        </div>
      )}

      <div className="report-features">
        <div><strong>01</strong><span>Actual AI findings</span></div>
        <div><strong>02</strong><span>D00 / D10 / D20 / D40 summary</span></div>
        <div><strong>03</strong><span>Health & repair priority</span></div>
        <div><strong>04</strong><span>Inspection traceability</span></div>
      </div>
    </Panel>
  );
}

function Empty({ text }) {
  return <div className="empty-state"><div className="empty-icon">◌</div><p>{text}</p></div>;
}
