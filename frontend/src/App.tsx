

import { useEffect, useMemo, useState } from 'react';

import {

  Activity,

  AlertTriangle,

  ArrowUpRight,

  Bell,

  BookOpen,

  CheckCircle2,

  ChevronDown,

  CircleHelp,

  Clock3,

  FileSearch,

  FileText,

  LayoutDashboard,

  Menu,

  Moon,

  Plus,

  RefreshCw,

  Search,

  Settings,

  ShieldCheck,

  SlidersHorizontal,

  Trash2,

  UploadCloud,

  Workflow,

  X,

} from 'lucide-react';

import {

  Area,

  AreaChart,

  CartesianGrid,

  ResponsiveContainer,

  Tooltip,

  XAxis,

  YAxis,

} from 'recharts';



const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';



type Requirement = {

  id: string;

  text: string;

  category?: string;

  mandatory?: boolean;

  priority?: string;

  source_evidence?: string;

  source?: string;

  risk?: string;

  status?: string;

};



type Analysis = {

  id: number;

  filename: string;

  status: string;

  provider_status?: string;

  document_type?: string;

  is_rfp?: boolean;

  summary?: string;

  warnings?: string[];

  requirements: Requirement[];

  preview?: string;

  page_count?: number;

};



type RFP = {

  id: number;

  title: string;

  agency: string;

  deadline: string;

  estimated_value: string;

  status: string;

  qualification_score: number;

  is_demo: boolean;

  description: string;

};





type Analytics = {

  total_analyses: number;

  total_rfps: number;

  total_requirements: number;

  mandatory_requirements: number;

  optional_requirements: number;

  reviewed_requirements: number;

  pending_requirements: number;

  review_completion_percent: number;

  priority_breakdown: Record<string, number>;

  review_status_breakdown: Record<string, number>;

  rfp_status_breakdown: Record<string, number>;

  daily_activity: { date: string; count: number }[];

};







const nav = [

  {

    label: 'Workspace',

    items: [

      ['Dashboard', LayoutDashboard],

      ['RFP Findings', FileSearch],

      ['Document Analysis', FileText],

      ['Knowledge Library', BookOpen],

      ['Analytics', Activity],

    ],

  },

  {

    label: 'Configuration',

    items: [

      ['Discovery Sites', Workflow],

      ['Qualifications', SlidersHorizontal],

      ['History & Activity', Activity],

      ['Settings', Settings],

    ],

  },

] as const;



const descriptions: Record<string, string> = {

  'RFP Findings': 'Search, inspect, and organize opportunities in your workspace.',
  Analytics: 'Track document analysis, extracted requirements, priorities, and review progress using backend data.',

  'Document Analysis': 'Review AI-generated document analysis and extracted requirements.',

  'Knowledge Library': 'Manage approved evidence used to ground proposal responses.',

  'Discovery Sites': 'Configure official procurement data sources.',

  Qualifications: 'Understand how opportunity fit and eligibility are assessed.',

  'History & Activity': 'Review saved document analysis activity.',

  Settings: 'Workspace preferences, provider status, and operational controls.',

};



export default function App() {

  const [page, setPage] = useState('Dashboard');

  const [rfps, setRfps] = useState<RFP[]>([]);

  const [summary, setSummary] = useState<any>({});

  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const [query, setQuery] = useState('');

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');

  const [dark, setDark] = useState(true);

  const [sidebar, setSidebar] = useState(true);

  const [file, setFile] = useState<File | null>(null);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const [showAdd, setShowAdd] = useState(false);

  const [title, setTitle] = useState('');

  const [agency, setAgency] = useState('');

  const [showPreview, setShowPreview] = useState(false)

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [readNotifications, setReadNotifications] = useState(false);;



  async function load() {

    try {

      const [recordsResponse, summaryResponse, analyticsResponse] =

  await Promise.all([

    fetch(`${API}/api/rfps?q=${encodeURIComponent(query)}`),

    fetch(`${API}/api/summary`),

    fetch(`${API}/api/analytics`),

  ]);





if (

  !recordsResponse.ok ||

  !summaryResponse.ok ||

  !analyticsResponse.ok

) {

  throw new Error(

    'Backend returned an error. Check that FastAPI is running.'

  );

}



setRfps(await recordsResponse.json());

setSummary(await summaryResponse.json());

setAnalytics(await analyticsResponse.json());

setError('');



    } catch (e: any) {

      setError(e.message || 'Could not connect to the backend.');

    }

  }



  useEffect(() => {

    load();

  }, [query]);



  const chart = useMemo(

    () => [

      { name: 'Mon', value: 2 },

      { name: 'Tue', value: 4 },

      { name: 'Wed', value: 3 },

      { name: 'Thu', value: 6 },

      { name: 'Fri', value: 5 },

      { name: 'Sat', value: 7 },

      { name: 'Sun', value: rfps.length },

    ],

    [rfps.length]

  );



  async function upload() {

    if (!file) return;



    setBusy(true);

    setError('');

    setAnalysis(null);

    setShowPreview(false);



    try {

      const formData = new FormData();

      formData.append('file', file);



      const response = await fetch(`${API}/api/analyze`, {

        method: 'POST',

        body: formData,

      });



      const data = await response.json();



      if (!response.ok) {

        throw new Error(data.detail || 'Document analysis failed.');

      }



      // Display the actual API response without replacing it with sample data.

      setAnalysis({

        ...data,

        requirements: Array.isArray(data.requirements)

          ? data.requirements

          : [],

        warnings: Array.isArray(data.warnings) ? data.warnings : [],

      });



      setPage('Document Analysis');

      await load();

    } catch (e: any) {

      setError(e.message || 'Unable to analyze this document.');

    } finally {

      setBusy(false);

    }

  }



  async function addRfp() {

    if (!title.trim()) return;



    setBusy(true);



    try {

      const response = await fetch(`${API}/api/rfps`, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          title,

          agency: agency || 'Not specified',

          status: 'New',

        }),

      });



      if (!response.ok) {

        throw new Error('Could not create the RFP record.');

      }



      setTitle('');

      setAgency('');

      setShowAdd(false);

      await load();

    } catch (e: any) {

      setError(e.message || 'Could not save the record.');

    } finally {

      setBusy(false);

    }

  }



  async function remove(id: number) {

    if (!confirm('Delete this RFP record?')) return;



    try {

      const response = await fetch(`${API}/api/rfps/${id}`, {

        method: 'DELETE',

      });



      if (!response.ok) {

        const data = await response.json();

        throw new Error(data.detail || 'Delete failed.');

      }



      await load();

    } catch (e: any) {

      setError(e.message || 'Could not delete the record.');

    }

  }



  function openUpload() {

    setPage('Document Analysis');

    window.setTimeout(() => {

      document.getElementById('upload-input')?.click();

    }, 0);

  }



  return (

    <div className={dark ? 'app dark' : 'app'}>

      <aside className={sidebar ? 'sidebar' : 'sidebar collapsed'}>

        <div className="brand">

          <div className="brand-mark">

            <Workflow size={21} />

          </div>



          {sidebar && (

            <div>

              <b>BidWise AI<span>.</span></b>

              <small>RFP WRITER</small>

            </div>

          )}



          <button

            className="icon-btn side-toggle"

            onClick={() => setSidebar(!sidebar)}

            aria-label="Toggle sidebar"

          >

            {sidebar ? <X size={16} /> : <Menu size={17} />}

          </button>

        </div>



        {nav.map((group) => (

          <div className="nav-group" key={group.label}>

            {sidebar && <div className="nav-label">{group.label}</div>}



            {group.items.map(([label, Icon]) => (

              <button

                key={label}

                className={`nav-item ${page === label ? 'active' : ''}`}

                onClick={() => setPage(label)}

                title={label}

              >

                <Icon size={18} />

                {sidebar && <span>{label}</span>}



                {sidebar && label === 'RFP Findings' && (

                  <em>{rfps.length}</em>

                )}

              </button>

            ))}

          </div>

        ))}



        <div className="sidebar-bottom">

          <div className="help-card">

            <CircleHelp size={18} />

            {sidebar && (

              <div>

                <b>Need a hand?</b>

                <small>Explore your workspace</small>

              </div>

            )}

          </div>



          <div className="user-row">

            <div className="avatar">NR</div>



            {sidebar && (

              <div className="user-info">

                <b>Workspace Admin</b>

                <small>Local workspace</small>

              </div>

            )}



            {sidebar && <ChevronDown size={15} />}

          </div>

        </div>

      </aside>



      <main className="main">

        <header className="topbar">

          <div className="crumb">

            <span>Workspace</span>

            <b>/</b>

            <strong>{page}</strong>

          </div>



          <div className="top-actions">

            <div className="api-status">

              <span className="pulse" />

              API {error ? 'Check connection' : 'Connected'}

            </div>



            <button

              className="icon-btn"

              onClick={() => setDark(!dark)}

              title="Toggle theme"

              aria-label="Toggle dark mode"

            >

              <Moon size={18} />

            </button>
            
<div className="notification-wrap">
  <button
    className="icon-btn notification-trigger"
    title="Notifications"
    aria-label="Open notifications"
    onClick={() => {
      setNotificationsOpen(!notificationsOpen);
      setReadNotifications(true);
    }}
  >
    <Bell size={18} />
    {!readNotifications && (
      <span className="notification-dot" />
    )}
  </button>

  {notificationsOpen && (
    <div className="notification-panel">
      <div className="notification-header">
        <div>
          <h3>Notifications</h3>
          <p>Workspace updates</p>
        </div>
        <button
          className="icon-btn"
          onClick={() => setNotificationsOpen(false)}
        >
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="notification-item">
          <AlertTriangle size={18} />
          <div>
            <b>Backend connection issue</b>
            <p>{error}</p>
          </div>
        </div>
      )}

      {analysis && (
        <div className="notification-item">
          <CheckCircle2 size={18} />
          <div>
            <b>Document analysis completed</b>
            <p>{analysis.filename} is ready for review.</p>
            <button
              className="text-btn"
              onClick={() => {
                setPage('Document Analysis');
                setNotificationsOpen(false);
              }}
            >
              View analysis
            </button>
          </div>
        </div>
      )}

      {!error && !analysis && (
        <div className="notification-empty">
          <Bell size={24} />
          <b>You're all caught up</b>
          <p>No new workspace updates.</p>
        </div>
      )}
    </div>
  )}
</div>




            <div className="avatar small">NR</div>

          </div>

        </header>



        <section className="content">

          <div className="page-heading">

            <div>

              <div className="eyebrow">RFP INTELLIGENCE PLATFORM</div>

              <h1>{page === 'Dashboard' ? 'Good to see you.' : page}</h1>

              <p>

                {page === 'Dashboard'

                  ? 'Your RFP pipeline, evidence coverage, and next actions — all in one place.'

                  : descriptions[page] || 'Manage your workspace.'}

              </p>

            </div>



            <div className="heading-actions">

              <button className="btn secondary" onClick={load}>

                <RefreshCw size={15} /> Refresh

              </button>



              <button className="btn primary" onClick={openUpload}>

                <Plus size={16} /> Analyze RFP

              </button>

            </div>

          </div>



          {error && (

            <div className="error-banner">

              <AlertTriangle size={17} />

              <span>{error}</span>

              <button onClick={() => setError('')} aria-label="Dismiss error">

                <X size={15} />

              </button>

            </div>

          )}



          {page === 'Dashboard' && (

            <>

              <div className="demo-banner">

                <span className="demo-dot" />

                <div>

                  <b>Workspace preview</b>

                  <span>

                    Demo records are synthetic. No live procurement scan has

                    been performed.

                  </span>

                </div>

                <button onClick={() => setPage('RFP Findings')}>

                  View records <ArrowUpRight size={14} />

                </button>

              </div>



              <div className="metric-grid">

                {metric(

                  'Total RFPs',

                  summary.total_rfps ?? '—',

                  'Across your workspace',

                  FileText,

                  'blue'

                )}

                {metric(

                  'New opportunities',

                  summary.new_opportunities ?? '—',

                  'Awaiting qualification',

                  FileSearch,

                  'violet'

                )}

                {metric(

                  'Qualified',

                  summary.qualified ?? '—',

                  'Score ≥ 70',

                  ShieldCheck,

                  'teal'

                )}

                {metric(

                  'AI provider',

                  summary.ai_configured ? 'Configured' : 'Not configured',

                  summary.ai_configured

                    ? 'Server-side key detected'

                    : 'AI provider not configured',

                  Activity,

                  summary.ai_configured ? 'teal' : 'amber'

                )}

              </div>



              <div className="dashboard-grid">

                <div className="panel chart-panel">

                  <div className="panel-head">

                    <div>

                      <h3>Pipeline activity</h3>

                      <p>RFP records in your workspace</p>

                    </div>

                    <span className="select-pill">

                      Last 7 days <ChevronDown size={14} />

                    </span>

                  </div>



                  <div className="chart-wrap">

                    <ResponsiveContainer width="100%" height="100%">

                      <AreaChart

                        data={chart}

                        margin={{ left: -20, right: 8, top: 10, bottom: 0 }}

                      >

                        <defs>

                          <linearGradient

                            id="fillBlue"

                            x1="0"

                            y1="0"

                            x2="0"

                            y2="1"

                          >

                            <stop

                              offset="0%"

                              stopColor="#4777f5"

                              stopOpacity={0.2}

                            />

                            <stop

                              offset="100%"

                              stopColor="#4777f5"

                              stopOpacity={0}

                            />

                          </linearGradient>

                        </defs>



                        <CartesianGrid

                          strokeDasharray="3 5"

                          vertical={false}

                          stroke="var(--line)"

                        />

                        <XAxis

                          dataKey="name"

                          axisLine={false}

                          tickLine={false}

                          tick={{ fill: 'var(--muted)', fontSize: 12 }}

                        />

                        <YAxis

                          axisLine={false}

                          tickLine={false}

                          tick={{ fill: 'var(--muted)', fontSize: 12 }}

                          allowDecimals={false}

                        />

                        <Tooltip

                          contentStyle={{

                            background: 'var(--panel)',

                            border: '1px solid var(--line)',

                            borderRadius: 10,

                            color: 'var(--text)',

                          }}

                        />

                        <Area

                          type="monotone"

                          dataKey="value"

                          stroke="#4777f5"

                          strokeWidth={2.5}

                          fill="url(#fillBlue)"

                        />

                      </AreaChart>

                    </ResponsiveContainer>

                  </div>



                  <div className="chart-foot">

                    <span><i className="legend-dot" /> Workspace records</span>

                    <small>

                      Illustrative trend; historical daily activity is not

                      available yet.

                    </small>

                  </div>

                </div>



                <div className="panel action-panel">

                  <div className="panel-head">

                    <div>

                      <h3>Quick actions</h3>

                      <p>Pick up where you left off</p>

                    </div>

                  </div>



                  <button className="quick-action" onClick={openUpload}>

                    <div className="quick-icon blue-bg">

                      <UploadCloud size={19} />

                    </div>

                    <div>

                      <b>Upload an RFP</b>

                      <small>Analyze a PDF or DOCX with Gemini AI</small>

                    </div>

                    <ArrowUpRight size={16} />

                  </button>



                  <button

                    className="quick-action"

                    onClick={() => setPage('Knowledge Library')}

                  >

                    <div className="quick-icon teal-bg">

                      <BookOpen size={19} />

                    </div>

                    <div>

                      <b>Add knowledge evidence</b>

                      <small>Manage approved company references</small>

                    </div>

                    <ArrowUpRight size={16} />

                  </button>



                  <button

                    className="quick-action"

                    onClick={() => setPage('Qualifications')}

                  >

                    <div className="quick-icon purple-bg">

                      <SlidersHorizontal size={19} />

                    </div>

                    <div>

                      <b>Review qualification rules</b>

                      <small>Understand opportunity fit</small>

                    </div>

                    <ArrowUpRight size={16} />

                  </button>



                  <div className="ai-note">

                    <ShieldCheck size={17} />

                    <span>

                      <b>Grounded by design</b>

                      <small>

                        AI findings require evidence and human review.

                      </small>

                    </span>

                  </div>

                </div>

              </div>



              <div className="panel table-panel">

                <div className="panel-head">

                  <div>

                    <h3>Recent RFP findings</h3>

                    <p>Your latest opportunities and analysis status</p>

                  </div>

                  <button

                    className="text-btn"

                    onClick={() => setPage('RFP Findings')}

                  >

                    View all <ArrowUpRight size={15} />

                  </button>

                </div>



                <RfpTable rfps={rfps.slice(0, 5)} remove={remove} />

              </div>

            </>

          )}



          {page === 'Analytics' && (
            <div className="analytics-grid">
              <div className="metric-grid">
                {metric('Total analyses', analytics?.total_analyses ?? 0, 'Saved document analyses', FileText, 'blue')}
                {metric('Total requirements', analytics?.total_requirements ?? 0, 'Extracted requirements', FileSearch, 'violet')}
                {metric('Mandatory requirements', analytics?.mandatory_requirements ?? 0, 'Flagged as mandatory', ShieldCheck, 'teal')}
                {metric('Optional requirements', analytics?.optional_requirements ?? 0, 'Flagged as optional', BookOpen, 'amber')}
              </div>

              <div className="metric-grid">
                {metric('Reviewed', analytics?.reviewed_requirements ?? 0, 'Requirements reviewed', CheckCircle2, 'teal')}
                {metric('Pending review', analytics?.pending_requirements ?? 0, 'Awaiting human review', Clock3, 'amber')}
                {metric('Completion', `${analytics?.review_completion_percent ?? 0}%`, 'Review completion rate', Activity, 'blue')}
                {metric('RFP records', analytics?.total_rfps ?? 0, 'Saved opportunities', Workflow, 'violet')}
              </div>

              <div className="panel chart-panel">
                <div className="panel-head">
                  <div>
                    <h3>Analysis activity</h3>
                    <p>Daily document analyses recorded by the backend</p>
                  </div>
                </div>
                <div className="chart-wrap">
                  {analytics?.daily_activity?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.daily_activity}>
                        <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--line)" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                        <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)' }} />
                        <Area type="monotone" dataKey="count" name="Analyses" stroke="#4777f5" strokeWidth={2.5} fill="#4777f5" fillOpacity={0.15} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state">No analysis activity has been recorded yet. Analyze a document to populate this chart.</div>
                  )}
                </div>
              </div>

              <div className="analytics-breakdowns">
                <div className="panel table-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Requirement priorities</h3>
                      <p>Distribution returned by the backend</p>
                    </div>
                  </div>
                  {Object.entries(analytics?.priority_breakdown ?? {}).length ? (
                    Object.entries(analytics?.priority_breakdown ?? {}).map(([priority, count]) => (
                      <div className="rule-row" key={priority}>
                        <div className="rule-weight">{count}</div>
                        <div><b>{priority}</b><p>Requirements in this priority category</p></div>
                      </div>
                    ))
                  ) : <div className="empty-state">No priority data available yet.</div>}
                </div>

                <div className="panel table-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Review status</h3>
                      <p>Current requirement review distribution</p>
                    </div>
                  </div>
                  {Object.entries(analytics?.review_status_breakdown ?? {}).length ? (
                    Object.entries(analytics?.review_status_breakdown ?? {}).map(([status, count]) => (
                      <div className="rule-row" key={status}>
                        <div className="rule-weight">{count}</div>
                        <div><b>{status}</b><p>Requirements with this review status</p></div>
                      </div>
                    ))
                  ) : <div className="empty-state">No review status data available yet.</div>}
                </div>
              </div>
            </div>
          )}

          {page === 'RFP Findings' && (

            <div className="panel table-panel">

              <div className="panel-head">

                <div>

                  <h3>Opportunity register</h3>

                  <p>{rfps.length} records in your workspace</p>

                </div>



                <button

                  className="btn primary"

                  onClick={() => setShowAdd(!showAdd)}

                >

                  <Plus size={15} /> Add opportunity

                </button>

              </div>



              {showAdd && (

                <div className="add-form">

                  <input

                    value={title}

                    onChange={(e) => setTitle(e.target.value)}

                    placeholder="RFP title"

                  />

                  <input

                    value={agency}

                    onChange={(e) => setAgency(e.target.value)}

                    placeholder="Agency or client"

                  />

                  <button

                    className="btn primary"

                    disabled={busy || !title.trim()}

                    onClick={addRfp}

                  >

                    Save record

                  </button>

                </div>

              )}



              <div className="table-tools">

                <div className="search-box">

                  <Search size={16} />

                  <input

                    value={query}

                    onChange={(e) => setQuery(e.target.value)}

                    placeholder="Search title, agency, description..."

                  />

                </div>

                <span className="muted">

                  <SlidersHorizontal size={15} /> Search filters records

                </span>

              </div>



              <RfpTable rfps={rfps} remove={remove} />

            </div>

          )}



          {page === 'Document Analysis' && (

            <>

              <div className="panel upload-panel">

                <div className="upload-symbol">

                  <UploadCloud size={26} />

                </div>



                <h3>Analyze an RFP document</h3>

                <p>

                  Upload a PDF or DOCX to extract the document summary,

                  requirements, risks, priorities, and missing information

                  using Gemini AI.

                </p>



                <label className="drop-zone">

                  <input

                    id="upload-input"

                    type="file"

                    accept=".pdf,.docx"

                    onChange={(e) => {

                      setFile(e.target.files?.[0] || null);

                      setAnalysis(null);

                      setError('');

                    }}

                  />

                  <FileText size={22} />

                  <b>{file ? file.name : 'Choose a PDF or DOCX file'}</b>

                  <span>

                    {file

                      ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected`

                      : 'Maximum file size: 15 MB · Scanned PDF OCR is not included'}

                  </span>

                </label>



                <button

                  className="btn primary upload-submit"

                  disabled={!file || busy}

                  onClick={upload}

                >

                  <UploadCloud size={16} />

                  {busy ? 'Analyzing with Gemini AI...' : 'Analyze document'}

                  <ArrowUpRight size={15} />

                </button>

              </div>



              {analysis && (

                <div className="analysis-results">

                  {/* ANALYSIS HEADER */}

                  <div className="panel results-panel">

                    <div className="panel-head">

                      <div>

                        <div className="eyebrow">GEMINI AI ANALYSIS</div>

                        <h3>{analysis.filename}</h3>

                        <p>

                          Analysis #{analysis.id} · {analysis.status}

                        </p>

                      </div>



                      <span

                        className={`status ${

                          analysis.is_rfp

                            ? 'status-supported'

                            : 'status-review'

                        }`}

                      >

                        {analysis.is_rfp === true

                          ? 'RFP detected'

                          : analysis.is_rfp === false

                            ? 'Not an RFP'

                            : 'Classification pending'}

                      </span>

                    </div>



                    <div className="result-stats">

                      <div>

                        <b>{analysis.document_type || 'Unclassified'}</b>

                        <span>Document type</span>

                      </div>

                      <div>

                        <b>{analysis.requirements.length}</b>

                        <span>Extracted requirements</span>

                      </div>

                      <div>

                        <b>{analysis.page_count ?? '—'}</b>

                        <span>Pages / text sections reported by API</span>

                      </div>

                      <div>

                        <b>{analysis.provider_status || 'Not reported'}</b>

                        <span>AI provider</span>

                      </div>

                    </div>



                    <div className="analysis-section">

                      <h4>AI-generated summary</h4>

                      <p className="analysis-summary">

                        {analysis.summary || 'No summary was returned.'}

                      </p>

                    </div>

                  </div>



                  {/* WARNINGS */}

                  <div className="panel results-panel">

                    <div className="panel-head">

                      <div>

                        <h3>

                          <AlertTriangle

                            size={17}

                            style={{

                              display: 'inline',

                              verticalAlign: 'middle',

                              marginRight: 8,

                            }}

                          />

                          Risks & missing information

                        </h3>

                        <p>

                          Issues identified by the AI that may require

                          clarification or follow-up.

                        </p>

                      </div>



                      <span className="status status-review">

                        {analysis.warnings?.length || 0} warnings

                      </span>

                    </div>



                    {analysis.warnings?.length ? (

                      <div className="analysis-warning-list">

                        {analysis.warnings.map((warning, index) => (

                          <div className="analysis-warning" key={index}>

                            <AlertTriangle size={16} />

                            <span>{warning}</span>

                          </div>

                        ))}

                      </div>

                    ) : (

                      <div className="empty-state">

                        No warnings were returned by the AI. This does not

                        guarantee that the document has no risks.

                      </div>

                    )}

                  </div>



                  {/* REQUIREMENTS */}

                  <div className="panel results-panel">

                    <div className="panel-head">

                      <div>

                        <h3>Extracted requirements</h3>

                        <p>

                          Review each requirement against the original

                          document before using it in a proposal.

                        </p>

                      </div>

                    </div>



                    {analysis.requirements.length > 0 ? (

                      <div className="requirement-list">

                        {analysis.requirements.map((requirement, index) => (

                          <article

                            className="requirement"

                            key={`${requirement.id}-${index}`}

                          >

                            <div className="requirement-heading">

                              <b>{requirement.id || `REQ-${index + 1}`}</b>



                              <span

                                className={

                                  requirement.mandatory

                                    ? 'mandatory'

                                    : 'optional'

                                }

                              >

                                {requirement.mandatory

                                  ? 'Mandatory'

                                  : 'Optional / preference'}

                              </span>



                              {requirement.priority && (

                                <span

                                  className={`priority-tag priority-${requirement.priority.toLowerCase()}`}

                                >

                                  {requirement.priority} priority

                                </span>

                              )}



                              {requirement.category && (

                                <span className="category-tag">

                                  {requirement.category}

                                </span>

                              )}

                            </div>



                            <p className="requirement-text">

                              {requirement.text}

                            </p>



                            <div className="requirement-detail-grid">

                              <div>

                                <b>Source evidence</b>

                                <p>

                                  {requirement.source_evidence ||

                                    requirement.source ||

                                    'No source evidence returned.'}

                                </p>

                              </div>



                              <div>

                                <b>Risk / concern</b>

                                <p>

                                  {requirement.risk || 'No risk information returned.'}

                                </p>

                              </div>

                            </div>



                            <div className="requirement-footer">

                              <span>

                                <FileSearch size={13} />

                                {requirement.source || 'Source not specified'}

                              </span>

                              <span>

                                <Clock3 size={13} />

                                {requirement.status || 'Pending Review'}

                              </span>

                            </div>

                          </article>

                        ))}

                      </div>

                    ) : (

                      <div className="empty-state">

                        The AI did not return any requirements. Review the

                        extracted text and try again if necessary.

                      </div>

                    )}

                  </div>



                  {/* ORIGINAL EXTRACTED TEXT */}

                  <div className="panel results-panel">

                    <div className="panel-head">

                      <div>

                        <h3>Extracted document text</h3>

                        <p>

                          Text preview returned by the backend for

                          verification against the AI analysis.

                        </p>

                      </div>



                      <button

                        className="btn secondary"

                        onClick={() => setShowPreview(!showPreview)}

                      >

                        {showPreview ? 'Hide text' : 'Show full preview'}

                        <ChevronDown size={15} />

                      </button>

                    </div>



                    {showPreview && (

                      <pre className="text-preview">

                        {analysis.preview ||

                          'No extracted text preview was returned.'}

                      </pre>

                    )}



                    {!showPreview && (

                      <div className="text-preview-summary">

                        {analysis.preview

                          ? `${analysis.preview.length.toLocaleString()} characters available. Select "Show full preview" to inspect the extracted text.`

                          : 'No text preview was returned by the backend.'}

                      </div>

                    )}

                  </div>



                  <div className="analysis-disclaimer">

                    <ShieldCheck size={17} />

                    <span>

                      <b>Human verification required</b>

                      <small>

                        AI-generated findings can contain omissions or

                        inaccuracies. Confirm requirements, mandatory

                        conditions, evidence, and risks against the original

                        procurement document before making a bid decision.

                      </small>

                    </span>

                  </div>

                </div>

              )}

            </>

          )}



          {page === 'Knowledge Library' && (

            <EmptyModule

              icon={BookOpen}

              title="Approved knowledge library"

              body="Secure reference-document storage, approval metadata, indexing, and evidence retrieval will be added in the next build stage. No document is currently treated as approved evidence."

              action="Start with an RFP document"

              onAction={() => setPage('Document Analysis')}

            />

          )}



          {page === 'Discovery Sites' && (

            <EmptyModule

              icon={Workflow}

              title="Discovery sources"

              body="No live procurement scans are configured. This starter does not crawl procurement websites or claim to have discovered live opportunities."

              action="Review RFP findings"

              onAction={() => setPage('RFP Findings')}

            />

          )}



          {page === 'Qualifications' && <Qualification rfps={rfps} />}



          {page === 'History & Activity' && (

            <EmptyModule

              icon={Activity}

              title="Analysis history"

              body="Detailed activity events, revisions, and approval audit trails are not yet implemented."

              action="Open document analysis"

              onAction={() => setPage('Document Analysis')}

            />

          )}



          {page === 'Settings' && (

            <div className="settings-grid">

              <div className="panel settings-card">

                <h3>General</h3>

                <p>Workspace preferences</p>



                <label>

                  Workspace name

                  <input defaultValue="BidWise AI RFP Writer" />

                </label>



                <label>

                  Default qualification threshold

                  <input type="number" defaultValue="70" />

                </label>



                <div className="setting-row">

                  <div>

                    <b>Dark appearance</b>

                    <small>Apply dark theme across the workspace</small>

                  </div>



                  <button

                    className={`toggle ${dark ? 'on' : ''}`}

                    onClick={() => setDark(!dark)}

                    aria-label="Toggle dark appearance"

                  >

                    <span />

                  </button>

                </div>

              </div>



              <div className="panel settings-card">

                <h3>Integrations & system health</h3>

                <p>Configuration status from the backend</p>



                <div className="integration-row">

                  <div className="integration-icon">

                    <Activity size={18} />

                  </div>

                  <div>

                    <b>FastAPI backend</b>

                    <small>Local API connection</small>

                  </div>

                  <span

                    className={`status ${

                      error ? 'status-review' : 'status-supported'

                    }`}

                  >

                    {error ? 'Check connection' : 'Connected'}

                  </span>

                </div>



                <div className="integration-row">

                  <div className="integration-icon">

                    <Workflow size={18} />

                  </div>

                  <div>

                    <b>Gemini API</b>

                    <small>Configured server-side only</small>

                  </div>

                  <span

                    className={`status ${

                      summary.ai_configured

                        ? 'status-supported'

                        : 'status-review'

                    }`}

                  >

                    {summary.ai_configured ? 'Configured' : 'Not configured'}

                  </span>

                </div>



                <div className="warning-note">

                  <AlertTriangle size={16} />

                  Admin authentication, role-based access, and production

                  secrets management must be configured before public deployment.

                </div>

              </div>

            </div>

          )}



          <footer>

            <span>

              BidWise AI RFP WRITER <i>·</i> Starter build 0.1

            </span>

            <span>

              <span className="footer-dot" />

              {error ? 'Connection issue' : 'Local workspace'}

              <i>·</i> Human review required

            </span>

          </footer>

        </section>

      </main>

    </div>

  );

}



function metric(

  label: string,

  value: any,

  detail: string,

  Icon: any,

  color: string

) {

  return (

    <div className="metric-card">

      <div className="metric-top">

        <span>{label}</span>

        <div className={`metric-icon ${color}`}>

          <Icon size={18} />

        </div>

      </div>

      <strong>{value}</strong>

      <small>{detail}</small>

    </div>

  );

}



function RfpTable({

  rfps,

  remove,

}: {

  rfps: RFP[];

  remove: (id: number) => void;

}) {

  if (!rfps.length) {

    return <div className="empty-state">No records match this search.</div>;

  }



  return (

    <div className="table-scroll">

      <table>

        <thead>

          <tr>

            <th>RFP / Opportunity</th>

            <th>Agency</th>

            <th>Deadline</th>

            <th>Qualification</th>

            <th>Status</th>

            <th />

          </tr>

        </thead>



        <tbody>

          {rfps.map((rfp) => (

            <tr key={rfp.id}>

              <td>

                <div className="rfp-title">

                  <div className="file-icon">

                    <FileText size={16} />

                  </div>

                  <div>

                    <b>{rfp.title}</b>

                    <small>

                      {rfp.is_demo

                        ? 'SYNTHETIC DEMO RECORD'

                        : rfp.description || 'Workspace record'}

                    </small>

                  </div>

                </div>

              </td>



              <td>{rfp.agency}</td>



              <td>

                <span className="date-cell">

                  <Clock3 size={14} />

                  {rfp.deadline || 'Not set'}

                </span>

              </td>



              <td>

                <div className="score-cell">

                  <div className="score-track">

                    <span

                      style={{

                        width: `${Math.min(

                          100,

                          Math.max(0, rfp.qualification_score || 0)

                        )}%`,

                      }}

                    />

                  </div>

                  <b>{rfp.qualification_score ?? 0}%</b>

                </div>

              </td>



              <td>

                <span

                  className={`status ${

                    rfp.status === 'Analyzed'

                      ? 'status-supported'

                      : rfp.status === 'New'

                        ? 'status-new'

                        : 'status-review'

                  }`}

                >

                  {rfp.status}

                </span>

              </td>



              <td>

                {!rfp.is_demo && (

                  <button

                    className="icon-btn danger-btn"

                    title="Delete record"

                    onClick={() => remove(rfp.id)}

                  >

                    <Trash2 size={15} />

                  </button>

                )}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}



function EmptyModule({

  icon: Icon,

  title,

  body,

  action,

  onAction,

}: any) {

  return (

    <div className="panel module-empty">

      <div className="empty-icon">

        <Icon size={24} />

      </div>

      <h3>{title}</h3>

      <p>{body}</p>

      <button className="btn secondary" onClick={onAction}>

        {action} <ArrowUpRight size={15} />

      </button>

    </div>

  );

}



function Qualification({ rfps }: { rfps: RFP[] }) {

  const rules = [

    [

      'Mandatory eligibility',

      40,

      'Failing a mandatory eligibility condition should disqualify an opportunity.',

    ],

    [

      'Industry and capability fit',

      25,

      'Compare the stated scope with verified company capabilities.',

    ],

    [

      'Contract value fit',

      20,

      'Use known contract value only; missing values require review.',

    ],

    [

      'Deadline feasibility',

      15,

      'Evaluate submission time against actual team capacity.',

    ],

  ] as const;



  return (

    <div className="panel settings-card">

      <div className="panel-head">

        <div>

          <h3>Starter qualification preview</h3>

          <p>

            {rfps.length} RFP records · Illustrative scoring rules, not a

            production qualification engine

          </p>

        </div>

        <span className="status status-review">Preview</span>

      </div>



      {rules.map(([name, weight, description]) => (

        <div className="rule-row" key={name}>

          <div className="rule-weight">{weight}%</div>

          <div>

            <b>{name}</b>

            <p>{description}</p>

          </div>

          <span className="status status-review">Needs configuration</span>

        </div>

      ))}



      <div className="warning-note">

        <AlertTriangle size={16} />

        These weights are illustrative and are not automatically applied to

        your RFPs.

      </div>

    </div>

  );

}
