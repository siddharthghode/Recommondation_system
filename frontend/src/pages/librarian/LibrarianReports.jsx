import React, { useState, useEffect, useCallback } from 'react';
import { fetchLibrarianDashboard } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

export default function LibrarianReports() {
  const { token, department } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const activeToken = token || localStorage.getItem('token');
    if (!activeToken) return;

    try {
      setLoading(true);
      const res = await fetchLibrarianDashboard(activeToken);
      setData(res);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deptLabel = department || 'Department';

  const trendData = (data?.borrow_trends || []).map((d) => ({
    date: d.day ? String(d.day).slice(5) : '',
    total: d.total ?? 0,
    returned: d.returned ?? 0,
  }));

  const categoryData = (data?.top_categories || []).map((c) => ({
    name: c.category || 'General',
    count: c.count ?? 0,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              🏛 {deptLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            📊 Department Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Comprehensive circulation insights, catalog statistics, and student reading activity.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-2 self-start sm:self-auto transition"
        >
          <span>🔄</span>
          <span>Refresh Analytics</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3" />
          <p className="text-sm">Calculating department metrics...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metric Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Books</p>
              <p className="text-3xl font-extrabold text-white mt-1">{data?.books?.total ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">{data?.books?.in_stock ?? 0} available in stock</p>
            </div>
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Borrows</p>
              <p className="text-3xl font-extrabold text-indigo-400 mt-1">{data?.borrows?.total ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">{data?.borrows?.approved ?? 0} approved checkouts</p>
            </div>
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Registered Students</p>
              <p className="text-3xl font-extrabold text-emerald-400 mt-1">{data?.students ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">{data?.active_students?.last_30_days ?? 0} active in last 30d</p>
            </div>
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Completed Returns</p>
              <p className="text-3xl font-extrabold text-blue-400 mt-1">{data?.borrows?.returned ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">Returned to shelves</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Borrow Trends */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-1">📈 Circulation Over Time</h3>
              <p className="text-xs text-slate-400 mb-6">Daily checkout activity in {deptLabel}</p>

              {trendData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
                  No historical borrow trends available yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="chartBorrows" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        fontSize: 12,
                        borderRadius: 8,
                        color: "#f8fafc",
                      }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#6366f1" fill="url(#chartBorrows)" name="Borrows" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Categories */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-1">📚 Popular Categories</h3>
              <p className="text-xs text-slate-400 mb-6">Distribution of titles across subject areas</p>

              {categoryData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
                  No category distribution data available yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#94a3b8" }} width={90} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        fontSize: 12,
                        borderRadius: 8,
                        color: "#f8fafc",
                      }}
                    />
                    <Bar dataKey="count" fill="#818cf8" radius={[0, 6, 6, 0]} name="Books" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tables Row: Most Borrowed & Most Viewed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4">🏆 Top Borrowed Titles</h3>
              {(data?.most_borrowed_books || []).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No borrow rankings yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.most_borrowed_books.slice(0, 5).map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-750">
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <p className="text-sm font-semibold text-slate-200 truncate">{b.book__title}</p>
                      </div>
                      <span className="text-xs font-bold text-indigo-400 shrink-0">{b.count} checkouts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h3 className="text-sm font-bold text-white mb-4">👁 Most Viewed Titles</h3>
              {(data?.most_viewed_books || []).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No view statistics yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.most_viewed_books.slice(0, 5).map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-750">
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <p className="text-sm font-semibold text-slate-200 truncate">{b.book__title}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-400 shrink-0">{b.count} views</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
