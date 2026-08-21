import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BASE_URL, returnBook } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/Toast';

export default function LibrarianReturns() {
  const { token, department } = useAuth();
  const [activeBorrows, setActiveBorrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' });

  const loadBorrows = useCallback(async () => {
    const activeToken = token || localStorage.getItem('token');
    if (!activeToken) return;

    try {
      setLoading(true);
      // Fetch department approved borrows via analytics students or borrows
      const res = await fetch(`${BASE_URL}/analytics/students/`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) throw new Error('Failed to load students');
      const students = await res.json();
      
      // Load active borrows for all students in this department
      const allBorrows = [];
      await Promise.all(
        students.map(async (student) => {
          try {
            const bRes = await fetch(`${BASE_URL}/analytics/students/${student.id}/borrows/`, {
              headers: { Authorization: `Bearer ${activeToken}` },
            });
            if (bRes.ok) {
              const bData = await bRes.json();
              if (Array.isArray(bData)) {
                bData.forEach((b) => {
                  allBorrows.push({
                    ...b,
                    student_name: student.first_name ? `${student.first_name} ${student.last_name || ''}` : student.username,
                    student_email: student.email,
                    student_code: student.profile?.student_id || student.username,
                  });
                });
              }
            }
          } catch {
            // continue
          }
        })
      );

      setActiveBorrows(allBorrows);
    } catch (err) {
      console.error('Failed to load department circulation:', err);
      setToast({ open: true, message: 'Failed to load return records', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBorrows();
  }, [loadBorrows]);

  const handleReturn = async (borrowId) => {
    const activeToken = token || localStorage.getItem('token');
    setActionLoading((prev) => ({ ...prev, [borrowId]: true }));
    try {
      await returnBook(activeToken, borrowId);
      setToast({ open: true, message: 'Book marked as returned! Stock restored atomically.', type: 'success' });
      setActiveBorrows((prev) =>
        prev.map((b) => (b.id === borrowId ? { ...b, status: 'returned', return_date: new Date().toISOString() } : b))
      );
    } catch (err) {
      setToast({ open: true, message: err.detail || err.error || 'Failed to record return', type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [borrowId]: false }));
    }
  };

  const filteredBorrows = activeBorrows.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const sName = (b.student_name || '').toLowerCase();
    const sCode = (b.student_code || '').toLowerCase();
    const bTitle = (b.book_title || '').toLowerCase();
    return sName.includes(q) || sCode.includes(q) || bTitle.includes(q);
  });

  const activeCount = activeBorrows.filter((b) => b.status === 'approved' || b.status === 'borrowed').length;
  const returnedCount = activeBorrows.filter((b) => b.status === 'returned').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              🏛 {department || 'Department'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ↩ Return Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track active checkouts and record returned books to restore department inventory.
          </p>
        </div>

        <button
          onClick={loadBorrows}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-2 self-start sm:self-auto transition"
        >
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-2xl">
            📖
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white">{activeCount}</p>
            <p className="text-xs text-slate-400">Currently Borrowed / Active</p>
          </div>
        </div>
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-2xl">
            ✓
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white">{returnedCount}</p>
            <p className="text-xs text-slate-400">Successfully Returned</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by student name, roll number, or book title..."
          className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
      </div>

      {/* List */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3" />
            <p className="text-sm">Loading circulation records...</p>
          </div>
        ) : filteredBorrows.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl block mb-2">📦</span>
            <p className="text-sm font-bold text-slate-300">No Circulation Records Found</p>
            <p className="text-xs text-slate-500 mt-1">
              No active or returned borrow items found for {department || 'your department'}.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            <div className="grid grid-cols-12 px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60">
              <span className="col-span-3">Student</span>
              <span className="col-span-4">Book Title</span>
              <span className="col-span-2">Due Date</span>
              <span className="col-span-1 text-center">Status</span>
              <span className="col-span-2 text-right">Action</span>
            </div>

            {filteredBorrows.map((b) => {
              const isCheckedOut = b.status === 'approved' || b.status === 'borrowed';
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-800/40 transition text-sm"
                >
                  <div className="col-span-3 pr-2">
                    <p className="font-semibold text-white truncate">{b.student_name}</p>
                    <p className="text-xs text-slate-400 font-mono">{b.student_code}</p>
                  </div>

                  <div className="col-span-4 pr-4">
                    <p className="font-medium text-slate-200 truncate">{b.book_title}</p>
                    <p className="text-xs text-slate-500 truncate">Borrowed: {b.borrow_date ? new Date(b.borrow_date).toLocaleDateString() : '—'}</p>
                  </div>

                  <div className="col-span-2 text-xs text-slate-400">
                    {b.due_date ? new Date(b.due_date).toLocaleDateString() : '—'}
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        b.status === 'returned'
                          ? 'bg-slate-800 text-slate-300'
                          : isCheckedOut
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="col-span-2 flex justify-end">
                    {isCheckedOut ? (
                      <button
                        onClick={() => handleReturn(b.id)}
                        disabled={actionLoading[b.id]}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition shadow-sm"
                      >
                        {actionLoading[b.id] ? 'Saving...' : '↩ Record Return'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Completed</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <Toast
        open={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
