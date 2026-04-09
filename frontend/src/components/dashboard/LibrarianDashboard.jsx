import React, { useState, useEffect } from "react";
import { fetchLibrarianDashboard, getBorrowHistory } from "../../services/api";
import DashboardHeader from "./DashboardHeader";
import DashboardSidebar from "./DashboardSidebar";
import StatCards from "./StatCards";
import ActivityFeed from "./ActivityFeed";
import TopCategoriesChart from "./TopCategoriesChart";
import BorrowingTrendsChart from "./BorrowingTrendsChart";
import { ScanQRModal, AddBookModal } from "./QuickActionModals";

// Default values for dashboard displays
const defaultDeptStats = {
  department: "Library Administration",
  total_books: 6810,
  active_borrows: 156,
  overdue_count: 12,
  returned_today: 23,
};

const defaultBorrowingTrends = [];
const defaultCategoryStats = [];

function LibrarianDashboard() {
  const [scanOpen, setScanOpen] = useState(false);
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    fetchLibrarianDashboard(token)
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load dashboard:", error);
        setLoading(false);
      });
  }, []);

  const dynamicDeptStats = stats ? {
    ...defaultDeptStats,
    total_books: stats.book_stats?.total || defaultDeptStats.total_books,
    active_borrows: stats.interaction_stats?.borrow_count || defaultDeptStats.active_borrows,
    overdue_count: stats.interaction_stats?.borrow_count || defaultDeptStats.overdue_count,
    returned_today: stats.borrows?.returned || defaultDeptStats.returned_today
  } : defaultDeptStats;

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      <DashboardHeader stats={dynamicDeptStats} />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar
          onScanQR={() => setScanOpen(true)}
          onAddBook={() => setAddBookOpen(true)}
          booksCount={stats?.book_stats?.total || "4.8K"}
          membersCount={stats?.user_stats?.total_students || 312}
          overdueCount={stats?.interaction_stats?.borrow_count || 47}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5 min-h-full">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Overview</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {dynamicDeptStats.department} · April 2026
              </p>
            </div>
            <StatCards stats={dynamicDeptStats} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5" style={{ minHeight: 380 }}>
              <div className="xl:col-span-2 grid grid-rows-2 gap-5" style={{ minHeight: 380 }}>
                <div className="min-h-0" style={{ minHeight: 220 }}>
                  <BorrowingTrendsChart data={stats?.borrowing_trends || defaultBorrowingTrends} />
                </div>
                <div className="min-h-0" style={{ minHeight: 180 }}>
                  <TopCategoriesChart data={stats?.category_stats || defaultCategoryStats} />
                </div>
              </div>
              <div className="xl:col-span-1 min-h-0" style={{ minHeight: 380 }}>
                <ActivityFeed items={stats?.borrowed_books || []} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Avg Borrow Duration",
                  value: "11.4 days",
                  sub: "Target: ≤14 days",
                  ok: true
                },
                {
                  label: "Collection Turnover",
                  value: "6.5%",
                  sub: "Active / Total",
                  ok: true
                },
                {
                  label: "Fine Recovery Rate",
                  value: "72%",
                  sub: "Of total issued fines",
                  ok: true
                },
                {
                  label: "Overdue Rate",
                  value: `${(dynamicDeptStats.overdue_count / dynamicDeptStats.active_borrows * 100).toFixed(1)}%`,
                  sub: "Of active borrows",
                  ok: false
                }
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4">
                  <p className="text-[11px] text-slate-400 font-medium mb-1">{s.label}</p>
                  <p className="text-xl font-extrabold text-slate-800">{s.value}</p>
                  <p className={`text-[11px] mt-1 font-medium ${s.ok ? "text-emerald-500" : "text-rose-500"}`}>
                    {s.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
      <ScanQRModal open={scanOpen} onClose={() => setScanOpen(false)} />
      <AddBookModal
        open={addBookOpen}
        onClose={() => setAddBookOpen(false)}
        department={dynamicDeptStats.department}
      />
    </div>
  );
}

export default LibrarianDashboard;
