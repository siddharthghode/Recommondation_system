import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { getStudents, getStudentBorrows, getStudentAnalytics, approveStudent, rejectStudent } from "../services/api";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";

export default function StudentsList() {
  const { token: authToken, department } = useAuth();
  const token = authToken || localStorage.getItem("token");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryStatus = searchParams.get('status') || searchParams.get('tab') || searchParams.get('filter');

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [borrows, setBorrows] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [borrowsLoading, setBorrowsLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'borrows', 'analytics'
  const [statusFilter, setStatusFilter] = useState(queryStatus || 'all'); // 'all', 'pending', 'approved', 'rejected'
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (queryStatus && queryStatus !== statusFilter) {
      setStatusFilter(queryStatus);
    }
  }, [queryStatus]);

  const handleFilterChange = (newFilter) => {
    setStatusFilter(newFilter);
    if (newFilter === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ status: newFilter });
    }
  };

  useEffect(() => {
    if (token) {
      loadStudents();
    }
  }, [token]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await getStudents(token);
      setStudents(data || []);

      // Auto select first pending student if filter is pending
      const currentFilter = queryStatus || statusFilter;
      if (currentFilter === 'pending' && Array.isArray(data)) {
        const pendingList = data.filter(s => (s.approval_status === 'pending' || s.profile?.approval_status === 'pending'));
        if (pendingList.length > 0) {
          setSelectedStudent(pendingList[0]);
          setActiveTab('profile');
        }
      }
    } catch (err) {
      console.error('Failed to load students:', err);
      setToast({ open: true, message: 'Failed to load students', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (studentId, e) => {
    if (e) e.stopPropagation();
    try {
      setActionLoading(true);
      await approveStudent(token, studentId);
      setToast({ open: true, message: 'Student approved successfully!', type: 'success' });
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, approval_status: 'approved', profile: { ...s.profile, approval_status: 'approved' } } : s));
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(prev => ({ ...prev, approval_status: 'approved', profile: { ...prev.profile, approval_status: 'approved' } }));
      }
    } catch (err) {
      console.error('Failed to approve student:', err);
      setToast({ open: true, message: err.error || err.detail || 'Failed to approve student', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (studentId, e) => {
    if (e) e.stopPropagation();
    const reason = window.prompt("Enter rejection reason (optional):") || "";
    try {
      setActionLoading(true);
      await rejectStudent(token, studentId, reason);
      setToast({ open: true, message: 'Student registration rejected', type: 'info' });
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, approval_status: 'rejected', profile: { ...s.profile, approval_status: 'rejected' } } : s));
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(prev => ({ ...prev, approval_status: 'rejected', profile: { ...prev.profile, approval_status: 'rejected' } }));
      }
    } catch (err) {
      console.error('Failed to reject student:', err);
      setToast({ open: true, message: err.error || err.detail || 'Failed to reject student', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const loadStudentBorrows = async (studentId) => {
    try {
      setBorrowsLoading(true);
      const data = await getStudentBorrows(token, studentId);
      setBorrows(data || []);
    } catch (err) {
      console.error('Failed to load student borrows:', err);
      setToast({ open: true, message: 'Failed to load borrow records', type: 'error' });
      setBorrows([]);
    } finally {
      setBorrowsLoading(false);
    }
  };

  const loadStudentAnalytics = async (studentId) => {
    try {
      setAnalyticsLoading(true);
      const data = await getStudentAnalytics(token, studentId);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load student analytics:', err);
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    const sStatus = student.approval_status || student.profile?.approval_status || 'approved';
    if (sStatus === 'pending') {
      setActiveTab('profile');
    } else {
      setActiveTab('borrows');
    }
    loadStudentBorrows(student.id);
    loadStudentAnalytics(student.id);
  };


  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "requested":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-blue-100 text-blue-800";
      case "borrowed":
        return "bg-green-100 text-green-800";
      case "returned":
        return "bg-gray-100 text-gray-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getBorrowStats = (studentBorrows) => {
    if (!studentBorrows || studentBorrows.length === 0) return null;
    
    const stats = {
      total: studentBorrows.length,
      requested: studentBorrows.filter(b => b.status === 'requested').length,
      approved: studentBorrows.filter(b => b.status === 'approved').length,
      borrowed: studentBorrows.filter(b => b.status === 'borrowed').length,
      returned: studentBorrows.filter(b => b.status === 'returned').length,
      rejected: studentBorrows.filter(b => b.status === 'rejected').length,
    };
    
    return stats;
  };

  const pendingCount = students.filter(s => (s.approval_status === 'pending' || s.profile?.approval_status === 'pending')).length;
  const approvedCount = students.filter(s => (s.approval_status === 'approved' || s.profile?.approval_status === 'approved')).length;
  const rejectedCount = students.filter(s => (s.approval_status === 'rejected' || s.profile?.approval_status === 'rejected')).length;

  const filteredStudents = students.filter(student => {
    const sStatus = student.approval_status || student.profile?.approval_status || 'approved';
    if (statusFilter !== 'all' && sStatus !== statusFilter) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    
    const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
    const username = (student.username || '').toLowerCase();
    const email = (student.email || '').toLowerCase();
    const department = (student.department || student.profile?.department || '').toLowerCase();
    
    return fullName.includes(q) || username.includes(q) || email.includes(q) || department.includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          <p className="mt-4 text-slate-400 text-sm">Loading students in {department || 'your department'}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 p-6 rounded-3xl border border-slate-800">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  🏛 {department || 'Department Library'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                🎓 Student Registrations & Approvals
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Approve new student accounts and view student reading analytics for <strong>{department || 'your department'}</strong>.
              </p>
            </div>

            <button
              onClick={loadStudents}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-2 self-start sm:self-auto transition"
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              All Students ({students.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <span>⏳</span> Pending Approval ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                statusFilter === 'rejected'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'bg-white text-red-700 hover:bg-red-50 border border-red-200'
              }`}
            >
              Rejected ({rejectedCount})
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Students List */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-lg p-6">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Students ({filteredStudents.length})</h3>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students..."
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No students found in this category</p>
                ) : (
                  filteredStudents.map((student) => {
                    const sStatus = student.approval_status || student.profile?.approval_status || 'approved';
                    return (
                      <div
                        key={student.id}
                        onClick={() => handleStudentClick(student)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedStudent?.id === student.id
                            ? 'border-blue-500 bg-blue-50'
                            : sStatus === 'pending'
                            ? 'border-amber-300 bg-amber-50/50 hover:bg-amber-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            sStatus === 'pending' ? 'bg-amber-500' : sStatus === 'rejected' ? 'bg-red-500' : 'bg-gradient-to-br from-blue-500 to-purple-500'
                          }`}>
                            {(student.first_name?.[0] || student.username?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-semibold text-gray-800 truncate">
                                {student.first_name && student.last_name
                                  ? `${student.first_name} ${student.last_name}`
                                  : student.username}
                              </p>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                sStatus === 'pending'
                                  ? 'bg-amber-200 text-amber-900'
                                  : sStatus === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {sStatus}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{student.email}</p>
                            {(student.department || student.profile?.department) && (
                              <p className="text-xs text-blue-600 mt-1 truncate">
                                📚 {student.department || student.profile?.department}
                              </p>
                            )}

                            {/* Quick Action buttons for pending students */}
                            {sStatus === 'pending' && (
                              <div className="flex gap-2 mt-2.5 pt-2 border-t border-amber-200/60">
                                <button
                                  disabled={actionLoading}
                                  onClick={(e) => handleApprove(student.id, e)}
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1 px-2 rounded-md transition-colors disabled:opacity-50"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  disabled={actionLoading}
                                  onClick={(e) => handleReject(student.id, e)}
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1 px-2 rounded-md transition-colors disabled:opacity-50"
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Student Details and Data */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
              {!selectedStudent ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-20">
                  <div className="bg-gray-100 p-6 rounded-full mb-4">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a Student</h3>
                  <p className="text-gray-500">Click on a student to view their borrow records and analytics</p>
                </div>
              ) : (
                <div>
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bold text-gray-800">
                          {selectedStudent.first_name && selectedStudent.last_name
                            ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                            : selectedStudent.username}
                        </h3>
                        <span className={`text-xs uppercase font-bold px-2.5 py-1 rounded-full ${
                          (selectedStudent.approval_status || selectedStudent.profile?.approval_status) === 'pending'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : (selectedStudent.approval_status || selectedStudent.profile?.approval_status) === 'rejected'
                            ? 'bg-red-100 text-red-700 border border-red-300'
                            : 'bg-green-100 text-green-800 border border-green-300'
                        }`}>
                          {selectedStudent.approval_status || selectedStudent.profile?.approval_status || 'approved'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{selectedStudent.email}</p>
                      {(selectedStudent.department || selectedStudent.profile?.department) && (
                        <p className="text-xs text-blue-600 mt-1">
                          📚 Department: <strong>{selectedStudent.department || selectedStudent.profile?.department}</strong>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {(selectedStudent.approval_status || selectedStudent.profile?.approval_status) === 'pending' && (
                        <>
                          <button
                            disabled={actionLoading}
                            onClick={(e) => handleApprove(selectedStudent.id, e)}
                            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-1.5 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                          >
                            ✓ Approve Registration
                          </button>
                          <button
                            disabled={actionLoading}
                            onClick={(e) => handleReject(selectedStudent.id, e)}
                            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-1.5 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedStudent(null)}
                        className="text-gray-400 hover:text-gray-700 p-1"
                        title="Close details"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
                    <button
                      onClick={() => setActiveTab('profile')}
                      className={`px-4 py-2 font-semibold transition-colors flex items-center gap-1.5 ${
                        activeTab === 'profile'
                          ? 'text-blue-600 border-b-2 border-blue-600 -mb-0.5'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <span>👤</span> Registration Profile
                    </button>
                    <button
                      onClick={() => setActiveTab('borrows')}
                      className={`px-4 py-2 font-semibold transition-colors flex items-center gap-1.5 ${
                        activeTab === 'borrows'
                          ? 'text-blue-600 border-b-2 border-blue-600 -mb-0.5'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <span>📚</span> Books Data ({borrows.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('analytics')}
                      className={`px-4 py-2 font-semibold transition-colors flex items-center gap-1.5 ${
                        activeTab === 'analytics'
                          ? 'text-blue-600 border-b-2 border-blue-600 -mb-0.5'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      <span>📊</span> Analytics
                    </button>
                  </div>

                  {/* Tab 1: Profile & Registration Review */}
                  {activeTab === 'profile' && (
                    <div className="space-y-6">
                      {(selectedStudent.approval_status === 'pending' || selectedStudent.profile?.approval_status === 'pending') && (
                        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xl">⏳</span>
                                <h4 className="font-bold text-amber-900 text-base">Pending Registration Review</h4>
                              </div>
                              <p className="text-xs text-amber-800 mt-1 max-w-xl">
                                This student registered for the <strong>{selectedStudent.department || selectedStudent.profile?.department || department || 'department'}</strong> library. Click approve below to grant full library access.
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                disabled={actionLoading}
                                onClick={(e) => handleApprove(selectedStudent.id, e)}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <span>✓</span> Approve Student
                              </button>
                              <button
                                disabled={actionLoading}
                                onClick={(e) => handleReject(selectedStudent.id, e)}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <span>✕</span> Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Student Profile Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <span className="text-xs text-slate-500 block font-medium">Full Name</span>
                            <span className="font-bold text-slate-900 text-base">
                              {selectedStudent.first_name && selectedStudent.last_name
                                ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                                : selectedStudent.username}
                            </span>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <span className="text-xs text-slate-500 block font-medium">Student ID / Roll No</span>
                            <span className="font-bold text-slate-900 text-base font-mono">
                              {selectedStudent.profile?.student_id || selectedStudent.username}
                            </span>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <span className="text-xs text-slate-500 block font-medium">Institutional Email</span>
                            <span className="font-semibold text-slate-900">{selectedStudent.email || 'Not provided'}</span>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <span className="text-xs text-slate-500 block font-medium">Department</span>
                            <span className="font-bold text-indigo-700">
                              🏛 {selectedStudent.department || selectedStudent.profile?.department || 'Not assigned'}
                            </span>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <span className="text-xs text-slate-500 block font-medium">Academic Year</span>
                            <span className="font-semibold text-slate-900">
                              {selectedStudent.profile?.year ? `Year ${selectedStudent.profile.year}` : 'Not specified'}
                            </span>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <span className="text-xs text-slate-500 block font-medium">Approval Status</span>
                            <span className={`inline-block text-xs uppercase font-bold px-2.5 py-1 rounded-full mt-0.5 ${
                              (selectedStudent.approval_status || selectedStudent.profile?.approval_status) === 'pending'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : (selectedStudent.approval_status || selectedStudent.profile?.approval_status) === 'rejected'
                                ? 'bg-red-100 text-red-700 border border-red-300'
                                : 'bg-green-100 text-green-800 border border-green-300'
                            }`}>
                              {selectedStudent.approval_status || selectedStudent.profile?.approval_status || 'approved'}
                            </span>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200 sm:col-span-2">
                            <span className="text-xs text-slate-500 block font-medium mb-1.5">Reading Interests / Preferred Categories</span>
                            {selectedStudent.profile?.preferred_categories ? (
                              <div className="flex flex-wrap gap-1.5">
                                {selectedStudent.profile.preferred_categories.split(',').map((cat, i) => (
                                  <span key={i} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                                    {cat.trim()}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No preferred categories selected yet</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Borrows Content */}
                  {activeTab === 'borrows' && (
                    borrowsLoading ? (
                      <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                          <p className="mt-4 text-gray-600">Loading borrow records...</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Stats */}
                        {borrows.length > 0 && (
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
                            {(() => {
                              const stats = getBorrowStats(borrows);
                              return (
                                <>
                                  <div className="bg-gray-50 p-3 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                                    <p className="text-xs text-gray-600">Total</p>
                                  </div>
                                  <div className="bg-yellow-50 p-3 rounded-lg text-center">
                                    <p className="text-2xl font-bold text-yellow-800">{stats.requested}</p>
                                    <p className="text-xs text-yellow-600">Requested</p>
                                  </div>
                              <div className="bg-blue-50 p-3 rounded-lg text-center">
                                <p className="text-2xl font-bold text-blue-800">{stats.approved}</p>
                                <p className="text-xs text-blue-600">Approved</p>
                              </div>
                              <div className="bg-green-50 p-3 rounded-lg text-center">
                                <p className="text-2xl font-bold text-green-800">{stats.borrowed}</p>
                                <p className="text-xs text-green-600">Borrowed</p>
                              </div>
                              <div className="bg-gray-50 p-3 rounded-lg text-center">
                                <p className="text-2xl font-bold text-gray-800">{stats.returned}</p>
                                <p className="text-xs text-gray-600">Returned</p>
                              </div>
                              <div className="bg-red-50 p-3 rounded-lg text-center">
                                <p className="text-2xl font-bold text-red-800">{stats.rejected}</p>
                                <p className="text-xs text-red-600">Rejected</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Borrow History */}
                    {borrows.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="bg-gray-100 p-4 rounded-full inline-block mb-4">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-semibold">No borrow records found</p>
                      <p className="text-gray-500 text-sm mt-1">This student hasn't borrowed any books yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {borrows.map((borrow) => (
                        <motion.div
                          key={borrow.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border-2 border-gray-100 rounded-lg p-4 hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-800">{borrow.book_title}</h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(borrow.status)}`}>
                              {borrow.status_display || borrow.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                            <div>
                              <p className="text-xs text-gray-500">Requested</p>
                              <p className="font-medium">{formatDate(borrow.requested_at)}</p>
                            </div>
                            {borrow.borrow_date && (
                              <div>
                                <p className="text-xs text-gray-500">Borrowed</p>
                                <p className="font-medium">{formatDate(borrow.borrow_date)}</p>
                              </div>
                            )}
                            {borrow.due_date && (
                              <div>
                                <p className="text-xs text-gray-500">Due Date</p>
                                <p className="font-medium">{formatDate(borrow.due_date)}</p>
                              </div>
                            )}
                            {borrow.return_date && (
                              <div>
                                <p className="text-xs text-gray-500">Returned</p>
                                <p className="font-medium">{formatDate(borrow.return_date)}</p>
                              </div>
                            )}
                          </div>
                          {borrow.rejection_reason && (
                            <div className="mt-2 p-2 bg-red-50 rounded text-sm">
                              <p className="text-red-800"><strong>Rejection Reason:</strong> {borrow.rejection_reason}</p>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Tab 3: Analytics Content */}
              {activeTab === 'analytics' && (
                analyticsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      <p className="mt-4 text-gray-600">Loading analytics...</p>
                    </div>
                  </div>
                ) : analytics ? (
                  <div className="space-y-6">
                  {/* Interaction Stats */}
                  <div>
                    <h4 className="text-lg font-bold text-gray-800 mb-4">📈 Interaction Statistics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                        <p className="text-3xl font-bold text-blue-800">{analytics.interaction_stats.total}</p>
                        <p className="text-sm text-blue-600 mt-1">Total Interactions</p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                        <p className="text-3xl font-bold text-green-800">{analytics.interaction_stats.views}</p>
                        <p className="text-sm text-green-600 mt-1">Views</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                        <p className="text-3xl font-bold text-purple-800">{analytics.interaction_stats.likes}</p>
                        <p className="text-sm text-purple-600 mt-1">Likes</p>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
                        <p className="text-3xl font-bold text-orange-800">{analytics.interaction_stats.borrows}</p>
                        <p className="text-sm text-orange-600 mt-1">Borrows</p>
                      </div>
                    </div>
                  </div>

                  {/* Preferred Categories */}
                  {analytics.preferred_categories && analytics.preferred_categories.length > 0 && (
                    <div>
                      <h4 className="text-lg font-bold text-gray-800 mb-4">❤️ Preferred Categories</h4>
                      <div className="flex flex-wrap gap-2">
                        {analytics.preferred_categories.map((category, idx) => (
                          <span
                            key={idx}
                            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full text-sm font-semibold"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category Interactions */}
                  {analytics.category_interactions && analytics.category_interactions.length > 0 && (
                    <div>
                      <h4 className="text-lg font-bold text-gray-800 mb-4">📚 Most Interacted Categories</h4>
                      <div className="space-y-2">
                        {analytics.category_interactions.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-gray-700">{item.category}</span>
                                <span className="text-sm font-bold text-blue-600">{item.count}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                                  style={{
                                    width: `${Math.min(100, (item.count / Math.max(...analytics.category_interactions.map(c => c.count))) * 100)}%`
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Most Borrowed Books */}
                  {analytics.borrowed_books && analytics.borrowed_books.length > 0 && (
                    <div>
                      <h4 className="text-lg font-bold text-gray-800 mb-4">📖 Borrowed Books</h4>
                      <div className="grid gap-3">
                        {analytics.borrowed_books.map((book) => (
                          <div key={book.id} className="border-2 border-gray-100 rounded-lg p-3 hover:border-blue-200 transition-all">
                            <h5 className="font-semibold text-gray-800">{book.title}</h5>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Authors:</span> {book.authors || 'N/A'}
                            </p>
                            {book.categories && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {book.categories.split(',').slice(0, 3).map((cat, idx) => (
                                  <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                    {cat.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {(!analytics.category_interactions || analytics.category_interactions.length === 0) &&
                   (!analytics.preferred_categories || analytics.preferred_categories.length === 0) &&
                   analytics.interaction_stats.total === 0 && (
                    <div className="text-center py-12">
                      <div className="bg-gray-100 p-4 rounded-full inline-block mb-4">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-semibold">No analytics data available</p>
                      <p className="text-gray-500 text-sm mt-1">This student hasn't interacted with the system yet</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">Failed to load analytics</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>

    <Toast 
      open={toast.open} 
      message={toast.message} 
      type={toast.type} 
      onClose={() => setToast(s => ({ ...s, open: false }))} 
    />
    </div>
  </div>
);
}
