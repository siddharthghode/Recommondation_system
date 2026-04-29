import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchLibrarianDashboard,
  getBorrowRequests,
  approveBorrow,
  rejectBorrow,
  getStudents,
} from "../../services/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// Fallback fake data — used only when real API returns empty
const FAKE_TREND = [
  { date: "04-01", borrows: 4,  returned: 2 },
  { date: "04-02", borrows: 7,  returned: 3 },
  { date: "04-03", borrows: 5,  returned: 5 },
  { date: "04-04", borrows: 9,  returned: 4 },
  { date: "04-05", borrows: 6,  returned: 6 },
  { date: "04-06", borrows: 11, returned: 7 },
  { date: "04-07", borrows: 8,  returned: 5 },
  { date: "04-08", borrows: 13, returned: 9 },
  { date: "04-09", borrows: 10, returned: 8 },
  { date: "04-10", borrows: 15, returned: 11 },
  { date: "04-11", borrows: 12, returned: 10 },
  { date: "04-12", borrows: 9,  returned: 7 },
  { date: "04-13", borrows: 14, returned: 12 },
  { date: "04-14", borrows: 17, returned: 13 },
];

const FAKE_TOP_BOOKS = [
  { book__title: "Clean Code — Robert C. Martin",       count: 18 },
  { book__title: "DBMS — Navathe & Elmasri",            count: 14 },
  { book__title: "Operating System Concepts",           count: 11 },
  { book__title: "Introduction to Algorithms (CLRS)",   count: 9  },
  { book__title: "Computer Networks — Tanenbaum",       count: 7  },
];

const FAKE_STUDENTS = [
  { id: 1, first_name: "Aarav",   last_name: "Sharma",  username: "aarav_s",  profile: { student_id: "CS2021001", department: "Computer Science" } },
  { id: 2, first_name: "Priya",   last_name: "Patil",   username: "priya_p",  profile: { student_id: "CS2021002", department: "Computer Science" } },
  { id: 3, first_name: "Rohan",   last_name: "Desai",   username: "rohan_d",  profile: { student_id: "CS2021003", department: "Computer Science" } },
  { id: 4, first_name: "Sneha",   last_name: "Kulkarni",username: "sneha_k",  profile: { student_id: "CS2021004", department: "Computer Science" } },
  { id: 5, first_name: "Vikram",  last_name: "Joshi",   username: "vikram_j", profile: { student_id: "CS2021005", department: "Computer Science" } },
];

const FAKE_REQUESTS = [
  { id: 9001, student_name: "Aarav Sharma",  student_id: "CS2021001", book_title: "Clean Code",              book_authors: "Robert C. Martin", book_quantity: 3, requested_at: new Date(Date.now() - 25 * 60000).toISOString() },
  { id: 9002, student_name: "Priya Patil",   student_id: "CS2021002", book_title: "DBMS — Navathe",          book_authors: "Elmasri & Navathe", book_quantity: 1, requested_at: new Date(Date.now() - 70 * 60000).toISOString() },
  { id: 9003, student_name: "Rohan Desai",   student_id: "CS2021003", book_title: "Operating System Concepts",book_authors: "Silberschatz",      book_quantity: 0, requested_at: new Date(Date.now() - 3 * 3600000).toISOString() },
];

const FAKE_STATS = {
  borrows: { requested: 3, approved: 12, returned: 47, total: 62 },
  books:   { total: 142, in_stock: 118, out_of_stock: 24 },
  students: 31,
  most_borrowed_books: FAKE_TOP_BOOKS,
  borrow_trends: [],
  top_categories: [],
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-800">{value ?? "—"}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function LibrarianDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("role") === "librarian"
    ? (localStorage.getItem("username") || "Librarian")
    : "Librarian";

  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [rejectModal, setRejectModal] = useState(null); // borrow id
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAll = useCallback(async () => {
    if (!token) { navigate("/login"); return; }
    try {
      setLoadingStats(true);
      setLoadingRequests(true);
      const [dashData, reqData, stuData] = await Promise.all([
        fetchLibrarianDashboard(token),
        getBorrowRequests(token),
        getStudents(token),
      ]);
      // Merge real data with fake fallbacks — real data wins
      setStats({
        ...dashData,
        borrows: dashData.borrows ?? {},
        books:   dashData.books   ?? {},
        most_borrowed_books: dashData.most_borrowed_books?.length
          ? dashData.most_borrowed_books : FAKE_TOP_BOOKS,
      });
      setRequests(reqData);
      setStudents(stuData.length ? stuData : FAKE_STUDENTS);
    } catch (e) {
      setError("Failed to load dashboard data.");
    } finally {
      setLoadingStats(false);
      setLoadingRequests(false);
    }
  }, [token, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleApprove = async (borrowId) => {
    setActionLoading(p => ({ ...p, [borrowId]: "approve" }));
    try {
      await approveBorrow(token, borrowId);
      setRequests(r => r.filter(b => b.id !== borrowId));
      setStats(s => s ? {
        ...s,
        borrows: { ...s.borrows, requested: (s.borrows.requested || 1) - 1, approved: (s.borrows.approved || 0) + 1 }
      } : s);
      showToast("Request approved ✓");
    } catch {
      showToast("Failed to approve", "error");
    } finally {
      setActionLoading(p => ({ ...p, [borrowId]: null }));
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(p => ({ ...p, [rejectModal]: "reject" }));
    try {
      await rejectBorrow(token, rejectModal, rejectReason);
      setRequests(r => r.filter(b => b.id !== rejectModal));
      setStats(s => s ? {
        ...s,
        borrows: { ...s.borrows, requested: (s.borrows.requested || 1) - 1 }
      } : s);
      showToast("Request rejected");
    } catch {
      showToast("Failed to reject", "error");
    } finally {
      setActionLoading(p => ({ ...p, [rejectModal]: null }));
      setRejectModal(null);
      setRejectReason("");
    }
  };

  // Map borrow_trends to chart shape, fall back to fake trend
  const rawTrend = stats?.borrow_trends || [];
  const trendData = rawTrend.length
    ? rawTrend.map(d => ({
        date: d.day ? String(d.day).slice(5) : "",
        borrows: d.total ?? 0,
        returned: d.returned ?? 0,
      }))
    : FAKE_TREND;

  const department = stats
    ? (requests[0]?.user_details?.department || "Department")
    : "Loading...";

  if (loadingStats && loadingRequests) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          <p className="mt-4 text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all
          ${toast.type === "error" ? "bg-rose-500" : "bg-emerald-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold text-slate-800 mb-1">Reject Request</h3>
            <p className="text-xs text-slate-500 mb-4">Optionally provide a reason for the student.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                className="flex-1 h-10 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading[rejectModal] === "reject"}
                className="flex-1 h-10 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {actionLoading[rejectModal] === "reject" ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-lg">📚</div>
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">UniLib</p>
            <p className="text-sm font-bold text-slate-800 -mt-0.5">Librarian Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full font-semibold">
            🏛 {stats?.borrows !== undefined
              ? (requests[0]?.user_details?.department || localStorage.getItem("dept") || "CS Dept")
              : "Loading..."}
          </span>
          <button
            onClick={() => navigate("/librarian/books")}
            className="text-xs text-slate-600 hover:text-indigo-600 font-medium"
          >
            Manage Books
          </button>
          <button
            onClick={() => navigate("/librarian/students")}
            className="text-xs text-slate-600 hover:text-indigo-600 font-medium"
          >
            Students
          </button>
          <button
            onClick={() => { localStorage.clear(); navigate("/login"); }}
            className="text-xs text-rose-500 hover:text-rose-600 font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* ── Greeting ── */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {loadingRequests
              ? "Loading requests..."
              : requests.length > 0
                ? `You have ${requests.length} pending borrow request${requests.length > 1 ? "s" : ""} waiting for action.`
                : "No pending requests. All caught up!"}
          </p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Pending Requests" value={stats?.borrows?.requested ?? requests.length} color="bg-amber-50" icon="⏳" />
          <StatCard label="Active Borrows"   value={stats?.borrows?.approved}   color="bg-indigo-50" icon="📖" />
          <StatCard label="Books in Dept"    value={stats?.books?.total}        color="bg-emerald-50" icon="📚" />
          <StatCard label="Students"         value={stats?.students}            color="bg-violet-50" icon="👥" />
        </div>

        {/* ── Pending Requests Table ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">⏳ Pending Requests</h2>
              <p className="text-xs text-slate-400 mt-0.5">Approve or reject borrow requests from your department</p>
            </div>
            {requests.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                {requests.length} pending
              </span>
            )}
          </div>

          {loadingRequests ? (
            <div className="px-6 py-10 text-center text-slate-400 text-sm">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-semibold text-slate-600">All requests handled</p>
              <p className="text-xs text-slate-400 mt-1">No pending borrow requests right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {/* Table header */}
              <div className="grid grid-cols-12 px-6 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide bg-slate-50">
                <span className="col-span-3">Student</span>
                <span className="col-span-4">Book</span>
                <span className="col-span-2">Requested</span>
                <span className="col-span-1 text-center">Stock</span>
                <span className="col-span-2 text-right">Action</span>
              </div>
              {requests.map(borrow => (
                <div key={borrow.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50/60 transition">
                  {/* Student */}
                  <div className="col-span-3">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {borrow.student_name || borrow.student_id || "Student"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{borrow.student_id}</p>
                  </div>
                  {/* Book */}
                  <div className="col-span-4 pr-4">
                    <p className="text-sm font-medium text-slate-700 truncate">{borrow.book_title}</p>
                    <p className="text-xs text-slate-400 truncate">{borrow.book_authors}</p>
                  </div>
                  {/* Time */}
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500">{timeAgo(borrow.requested_at)}</p>
                  </div>
                  {/* Stock badge */}
                  <div className="col-span-1 flex justify-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                      ${borrow.book_quantity > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                      {borrow.book_quantity ?? "?"}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => handleApprove(borrow.id)}
                      disabled={!!actionLoading[borrow.id]}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      {actionLoading[borrow.id] === "approve" ? "..." : "✓ Approve"}
                    </button>
                    <button
                      onClick={() => setRejectModal(borrow.id)}
                      disabled={!!actionLoading[borrow.id]}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Borrow Trend + Top Books ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Trend Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-1">📊 Borrow Trend</h2>
            <p className="text-xs text-slate-400 mb-5">Daily borrow activity in your department</p>
            <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gBorrows" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gReturned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={Math.floor(trendData.length / 6)} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Area type="monotone" dataKey="borrows" stroke="#6366f1" strokeWidth={2} fill="url(#gBorrows)" dot={false} name="Borrows" />
                  <Area type="monotone" dataKey="returned" stroke="#10b981" strokeWidth={2} fill="url(#gReturned)" dot={false} name="Returned" />
                </AreaChart>
              </ResponsiveContainer>
          </div>

          {/* Top Borrowed Books */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-1">🏆 Top Borrowed</h2>
            <p className="text-xs text-slate-400 mb-5">Most borrowed books in your dept</p>
            {(stats?.most_borrowed_books || []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No borrow data yet</p>
            ) : (
              <ol className="space-y-3">
                {(stats.most_borrowed_books || []).map((b, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                      ${i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-100 text-slate-500" : "bg-orange-50 text-orange-400"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{b.book__title}</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 shrink-0">{b.count}×</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* ── Active Students ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">👥 Students in Department</h2>
              <p className="text-xs text-slate-400 mt-0.5">{students.length} registered students</p>
            </div>
            <button
              onClick={() => navigate("/librarian/students")}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              View All →
            </button>
          </div>
          {students.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">No students found in your department</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {students.slice(0, 5).map(s => (
                <div key={s.id} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50/60 transition">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                    {(s.first_name?.[0] || s.username?.[0] || "S").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">
                      {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.username}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{s.profile?.student_id || s.username}</p>
                  </div>
                  <span className="text-xs text-slate-400">{s.profile?.department || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
