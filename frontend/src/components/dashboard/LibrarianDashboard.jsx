import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchLibrarianDashboard,
  getBorrowRequests,
  approveBorrow,
  rejectBorrow,
  getStudents,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

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

function StatCard({ label, value, sublabel, icon, color, linkTo }) {
  const content = (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center justify-between hover:border-slate-700 transition-all shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-extrabold text-white tracking-tight">{value ?? 0}</p>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">{label}</p>
          {sublabel && <p className="text-[11px] text-slate-500 mt-0.5">{sublabel}</p>}
        </div>
      </div>
      {linkTo && (
        <span className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
          View →
        </span>
      )}
    </div>
  );

  return linkTo ? <Link to={linkTo}>{content}</Link> : content;
}

export default function LibrarianDashboard() {
  const navigate = useNavigate();
  const { token, department, user } = useAuth();

  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [pendingStudents, setPendingStudents] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast] = useState(null);
  const [error, setError] = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    const activeToken = token || localStorage.getItem("token");
    if (!activeToken) {
      navigate("/login");
      return;
    }

    try {
      setLoadingStats(true);
      setLoadingRequests(true);
      const [dashData, reqData, stuData] = await Promise.all([
        fetchLibrarianDashboard(activeToken).catch(() => ({})),
        getBorrowRequests(activeToken).catch(() => []),
        getStudents(activeToken).catch(() => []),
      ]);

      setStats({
        ...dashData,
        borrows: dashData?.borrows || {},
        books: dashData?.books || {},
        most_borrowed_books: dashData?.most_borrowed_books || [],
      });

      const reqList = Array.isArray(reqData) ? reqData : [];
      setRequests(reqList);

      const stuList = Array.isArray(stuData) ? stuData : [];
      setStudents(stuList);
      setPendingStudents(
        stuList.filter(
          (s) => s.approval_status === "pending" || s.profile?.approval_status === "pending"
        )
      );
    } catch {
      setError("Failed to load department dashboard data.");
    } finally {
      setLoadingStats(false);
      setLoadingRequests(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleApprove = async (borrowId) => {
    const activeToken = token || localStorage.getItem("token");
    setActionLoading((p) => ({ ...p, [borrowId]: "approve" }));
    try {
      await approveBorrow(activeToken, borrowId);
      setRequests((r) => r.filter((b) => b.id !== borrowId));
      setStats((s) =>
        s
          ? {
              ...s,
              borrows: {
                ...s.borrows,
                requested: Math.max(0, (s.borrows?.requested || 1) - 1),
                approved: (s.borrows?.approved || 0) + 1,
              },
            }
          : s
      );
      showToast("Borrow request approved successfully! Book stock decremented.", "success");
    } catch {
      showToast("Failed to approve borrow request", "error");
    } finally {
      setActionLoading((p) => ({ ...p, [borrowId]: null }));
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    const activeToken = token || localStorage.getItem("token");
    setActionLoading((p) => ({ ...p, [rejectModal]: "reject" }));
    try {
      await rejectBorrow(activeToken, rejectModal, rejectReason);
      setRequests((r) => r.filter((b) => b.id !== rejectModal));
      setStats((s) =>
        s
          ? {
              ...s,
              borrows: {
                ...s.borrows,
                requested: Math.max(0, (s.borrows?.requested || 1) - 1),
              },
            }
          : s
      );
      showToast("Borrow request rejected.", "info");
    } catch {
      showToast("Failed to reject request", "error");
    } finally {
      setActionLoading((p) => ({ ...p, [rejectModal]: null }));
      setRejectModal(null);
      setRejectReason("");
    }
  };

  const deptLabel = department || user?.department || "Department Library";
  const trendData = (stats?.borrow_trends || []).map((d) => ({
    date: d.day ? String(d.day).slice(5) : "",
    borrows: d.total ?? 0,
    returned: d.returned ?? 0,
  }));

  if (loadingStats && loadingRequests) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
          <p className="mt-4 text-slate-400 text-sm">Loading {deptLabel} Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Toast Notification ── */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white transition-all ${
            toast.type === "error" ? "bg-red-600" : toast.type === "warning" ? "bg-amber-600" : toast.type === "info" ? "bg-blue-600" : "bg-green-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 text-white">
            <h3 className="text-lg font-bold text-white mb-1">Reject Borrow Request</h3>
            <p className="text-xs text-slate-400 mb-4">
              Provide a reason to the student explaining why this request cannot be fulfilled.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Physical copy reserved for faculty / Out of stock"
              rows={3}
              className="w-full border border-slate-700 bg-slate-800/80 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                className="flex-1 h-10 border border-slate-700 bg-slate-800 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading[rejectModal] === "reject"}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition"
              >
                {actionLoading[rejectModal] === "reject" ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-950/60 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── Greeting Banner & Department Identity ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              🏛 {deptLabel}
            </span>
            <span className="text-xs text-slate-400">Library Control Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome, {user?.first_name || user?.username || "Librarian"} 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Managing books, students, and circulation records for the <strong>{deptLabel}</strong>.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/librarian/students"
            className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-2 transition"
          >
            <span>⏳</span>
            <span>Pending Approvals ({pendingStudents.length})</span>
          </Link>
          <Link
            to="/librarian/books"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-indigo-950"
          >
            <span>📚</span>
            <span>Manage Catalog</span>
          </Link>
        </div>
      </div>

      {/* ── Stat Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending Registrations"
          value={pendingStudents.length}
          sublabel="Students awaiting approval"
          icon="⏳"
          color="bg-amber-500/20 text-amber-400 border border-amber-500/30"
          linkTo="/librarian/students"
        />
        <StatCard
          label="Pending Borrow Requests"
          value={stats?.borrows?.requested ?? requests.length}
          sublabel="Awaiting book checkout"
          icon="📖"
          color="bg-blue-500/20 text-blue-400 border border-blue-500/30"
          linkTo="/librarian/borrowing"
        />
        <StatCard
          label="Books in Department"
          value={stats?.books?.total ?? 0}
          sublabel={`${stats?.books?.in_stock ?? 0} currently in stock`}
          icon="📚"
          color="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          linkTo="/librarian/books"
        />
        <StatCard
          label="Department Students"
          value={stats?.students ?? students.length}
          sublabel="Registered in department"
          icon="👥"
          color="bg-violet-500/20 text-violet-400 border border-violet-500/30"
          linkTo="/librarian/students"
        />
      </div>

      {/* ── Pending Borrow Requests Table ── */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📖</span>
              <span>Pending Borrow Requests ({requests.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and approve student book requests for {deptLabel}
            </p>
          </div>
          <Link
            to="/librarian/borrowing"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            Circulation Hub →
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="text-4xl block mb-2">✅</span>
            <p className="text-sm font-bold text-slate-300">No Pending Borrow Requests</p>
            <p className="text-xs text-slate-500 mt-1">
              All student book requests for {deptLabel} have been processed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800 overflow-x-auto">
            <div className="grid grid-cols-12 px-6 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/50">
              <span className="col-span-3">Student</span>
              <span className="col-span-4">Requested Book</span>
              <span className="col-span-2">Time</span>
              <span className="col-span-1 text-center">Stock</span>
              <span className="col-span-2 text-right">Action</span>
            </div>

            {requests.map((borrow) => (
              <div
                key={borrow.id}
                className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-800/40 transition text-sm"
              >
                <div className="col-span-3 pr-2">
                  <p className="font-semibold text-white truncate">
                    {borrow.student_name || borrow.student_id || "Student"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{borrow.student_id}</p>
                </div>

                <div className="col-span-4 pr-4">
                  <p className="font-medium text-slate-200 truncate">{borrow.book_title}</p>
                  <p className="text-xs text-slate-500 truncate">{borrow.book_authors || "—"}</p>
                </div>

                <div className="col-span-2">
                  <p className="text-xs text-slate-400">{timeAgo(borrow.requested_at)}</p>
                </div>

                <div className="col-span-1 flex justify-center">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      borrow.book_quantity > 0
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {borrow.book_quantity ?? 0}
                  </span>
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    onClick={() => handleApprove(borrow.id)}
                    disabled={!!actionLoading[borrow.id]}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition shadow-sm"
                  >
                    {actionLoading[borrow.id] === "approve" ? "..." : "✓ Approve"}
                  </button>
                  <button
                    onClick={() => setRejectModal(borrow.id)}
                    disabled={!!actionLoading[borrow.id]}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Borrow Trends Chart & Top Books ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-6">
          <h2 className="text-sm font-bold text-white mb-1">📊 Department Borrow Trends</h2>
          <p className="text-xs text-slate-400 mb-6">Daily book circulation in {deptLabel}</p>

          {trendData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-slate-500 text-sm">
              No borrow activity recorded yet in this department.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBorrows" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReturned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    fontSize: 12,
                    borderRadius: 8,
                    color: "#f8fafc",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="borrows"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#gBorrows)"
                  name="Borrows"
                />
                <Area
                  type="monotone"
                  dataKey="returned"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gReturned)"
                  name="Returned"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Borrowed Books */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white mb-1">🏆 Most Borrowed Books</h2>
            <p className="text-xs text-slate-400 mb-4">Top circulation in {deptLabel}</p>

            {(stats?.most_borrowed_books || []).length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center">
                No borrow records yet in this department catalog.
              </p>
            ) : (
              <ol className="space-y-3">
                {(stats.most_borrowed_books || []).slice(0, 5).map((b, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        i === 0
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : i === 1
                          ? "bg-slate-700 text-slate-200"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{b.book__title}</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-400 shrink-0">{b.count}×</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <Link
            to="/librarian/books"
            className="mt-4 block text-center py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-indigo-300 transition"
          >
            View Department Catalog →
          </Link>
        </div>
      </div>
    </div>
  );
}
