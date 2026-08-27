import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { getBorrowRequests, approveBorrow, rejectBorrow } from '../../services/api';
import { useAuth } from '../../context/useAuth';
import Toast from '../../components/Toast';

export default function LibrarianBorrowing() {
  const { token, department } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' });

  const loadRequests = useCallback(async () => {
    const activeToken = token || localStorage.getItem('token');
    if (!activeToken) return;

    try {
      setLoading(true);
      const data = await getBorrowRequests(activeToken);
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load borrow requests:', err);
      setToast({ open: true, message: 'Failed to load borrow requests', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (borrowId) => {
    const activeToken = token || localStorage.getItem('token');
    setActionLoading((prev) => ({ ...prev, [borrowId]: 'approve' }));
    try {
      await approveBorrow(activeToken, borrowId);
      setToast({ open: true, message: 'Borrow request approved successfully! Book stock decremented.', type: 'success' });
      setRequests((prev) => prev.filter((r) => r.id !== borrowId));
    } catch (err) {
      setToast({ open: true, message: err.detail || err.error || 'Failed to approve borrow request', type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [borrowId]: null }));
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    const activeToken = token || localStorage.getItem('token');
    setActionLoading((prev) => ({ ...prev, [rejectModal]: 'reject' }));
    try {
      await rejectBorrow(activeToken, rejectModal, rejectReason);
      setToast({ open: true, message: 'Borrow request rejected', type: 'info' });
      setRequests((prev) => prev.filter((r) => r.id !== rejectModal));
      setRejectModal(null);
      setRejectReason('');
    } catch (err) {
      setToast({ open: true, message: err.detail || err.error || 'Failed to reject request', type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [rejectModal]: null }));
    }
  };

  const filteredRequests = requests.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const sName = (r.student_name || '').toLowerCase();
    const sId = (r.student_id || '').toLowerCase();
    const bTitle = (r.book_title || '').toLowerCase();
    return sName.includes(q) || sId.includes(q) || bTitle.includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 text-white">
            <h3 className="text-lg font-bold text-white mb-1">Reject Borrow Request</h3>
            <p className="text-xs text-slate-400 mb-4">
              Optionally state a reason explaining why the book cannot be borrowed.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Physical copy currently under preservation"
              rows={3}
              className="w-full border border-slate-700 bg-slate-800/80 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="flex-1 h-10 border border-slate-700 bg-slate-800 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading[rejectModal] === 'reject'}
                className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition"
              >
                {actionLoading[rejectModal] === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              🏛 {department || 'Department'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            📖 Borrowing Circulation
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review and grant checkout authorization for students in your department.
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-2 self-start sm:self-auto transition"
        >
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by student name, ID, or book title..."
          className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-400 hover:text-white px-2 py-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Requests List */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-3" />
            <p className="text-sm">Loading borrow requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl block mb-2">📚</span>
            <p className="text-sm font-bold text-slate-300">No Pending Requests</p>
            <p className="text-xs text-slate-500 mt-1">
              There are currently no outstanding book checkout requests for {department || 'your department'}.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            <div className="grid grid-cols-12 px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60">
              <span className="col-span-3">Student</span>
              <span className="col-span-4">Book Title & Author</span>
              <span className="col-span-2">Requested Time</span>
              <span className="col-span-1 text-center">Stock</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>

            {filteredRequests.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-800/40 transition text-sm"
              >
                <div className="col-span-3 pr-2">
                  <p className="font-semibold text-white truncate">{req.student_name || req.student_id || 'Student'}</p>
                  <p className="text-xs text-slate-400 font-mono">{req.student_id}</p>
                </div>

                <div className="col-span-4 pr-4">
                  <p className="font-medium text-slate-200 truncate">{req.book_title}</p>
                  <p className="text-xs text-slate-500 truncate">{req.book_authors || '—'}</p>
                </div>

                <div className="col-span-2 text-xs text-slate-400">
                  {req.requested_at ? new Date(req.requested_at).toLocaleDateString() : '—'}
                </div>

                <div className="col-span-1 flex justify-center">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      req.book_quantity > 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {req.book_quantity ?? 0}
                  </span>
                </div>

                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={!!actionLoading[req.id]}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition shadow-sm"
                  >
                    {actionLoading[req.id] === 'approve' ? '...' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => setRejectModal(req.id)}
                    disabled={!!actionLoading[req.id]}
                    className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-lg disabled:opacity-50 transition"
                  >
                    ✗ Reject
                  </button>
                </div>
              </motion.div>
            ))}
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
