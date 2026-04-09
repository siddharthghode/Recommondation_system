import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Toast from '../components/Toast';
import { BASE_URL } from '../services/api';

export default function ViewStudents() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' });
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadStudents();
  }, [token]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/analytics/students/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to load students');
      
      const data = await res.json();
      const studentsList = Array.isArray(data) ? data : (data.results || data.students || []);
      setStudents(studentsList);
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: 'Failed to load students', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Filter and paginate
  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    return !q || 
      (s.first_name || '').toLowerCase().includes(q) ||
      (s.last_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.student_id || s.id || '').toString().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const pagedStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Layout>
      <div className="p-4 md:p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/librarian')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Active Students
                </h1>
                <p className="text-sm text-gray-600 mt-1">{filteredStudents.length} students found</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search by name, email, or student ID..."
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 pl-12 focus:border-blue-400 focus:outline-none"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Students List */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : pagedStudents.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500">No students found</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Student ID</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">First Name</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Last Name</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Email</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Department</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Year</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pagedStudents.map(student => (
                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {student.profile?.student_id || student.username || student.id}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {student.first_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {student.last_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {student.email || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {student.profile?.department || student.department || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {student.profile?.year || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-200">
                  {pagedStudents.map(student => (
                    <div key={student.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {student.first_name || 'N/A'} {student.last_name || ''}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              ID: {student.profile?.student_id || student.username || student.id}
                            </div>
                          </div>
                          {student.profile?.year && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                              Year {student.profile.year}
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="text-gray-600">{student.email || 'N/A'}</span>
                          </div>
                          
                          {(student.profile?.department || student.department) && (
                            <div className="flex items-center gap-2 text-sm">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              <span className="text-gray-600">{student.profile?.department || student.department}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="px-4 md:px-6 py-4 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600 text-center sm:text-left">
                      Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, filteredStudents.length)} of {filteredStudents.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold disabled:opacity-40 min-h-[44px]"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-2 text-sm flex items-center">Page {page} of {totalPages}</span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold disabled:opacity-40 min-h-[44px]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Toast
        open={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, open: false })}
      />
    </Layout>
  );
}
