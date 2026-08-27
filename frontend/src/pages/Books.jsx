import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BookCard from '../components/BookCard';
import BookDetail from '../components/BookDetail';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import Footer from '../components/Footer';
import { BASE_URL, getDepartments } from '../services/api';

const PAGE_SIZE = 20;

export default function Books() {
  const [books, setBooks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState(() => localStorage.getItem("approval_status") || "approved");

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // Load departments
  useEffect(() => {
    getDepartments()
      .then(data => {
        if (Array.isArray(data)) setDepartments(data);
      })
      .catch(() => {});
  }, []);

  // Sync latest user profile approval status
  useEffect(() => {
    if (token && role === 'student') {
      fetch(`${BASE_URL}/auth/me/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setUserProfile(data);
            const status = data.profile?.approval_status || data.approval_status || 'approved';
            setApprovalStatus(status);
            localStorage.setItem('approval_status', status);
          }
        })
        .catch(() => {});
    }
  }, [token, role]);

  // ── Real API: load books ────────────────────────────────────────────────
  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      let url = `${BASE_URL}/books/?page=${page}&page_size=${PAGE_SIZE}&ordering=-id`;
      if (selectedDept && selectedDept !== 'All') url += `&department=${encodeURIComponent(selectedDept)}`;
      if (category && category !== 'All') url += `&category=${encodeURIComponent(category)}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const authToken = localStorage.getItem('token');
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.results) {
        setBooks(data.results);
        setTotalCount(data.count || 0);
        setTotalPages(Math.ceil((data.count || 0) / PAGE_SIZE) || 1);
      } else if (Array.isArray(data)) {
        setBooks(data);
        setTotalCount(data.length);
        setTotalPages(1);
      } else {
        setBooks([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load books.');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [page, selectedDept, category, searchQuery]);

  useEffect(() => { loadBooks(); window.scrollTo(0, 0); }, [loadBooks]);
  useEffect(() => { setPage(1); }, [selectedDept, category, searchQuery]);
  useEffect(() => { if (page > totalPages && totalPages > 0) setPage(1); }, [page, totalPages]);

  return (
    <>
      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <section className="pt-12 pb-8 bg-gradient-to-br from-blue-700 to-blue-600">
        <div className="w-[90%] max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
              Book Collection
            </h1>
            <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
              Browse, search, and discover books from our curated academic library.
            </p>

            {/* Search */}
            <div className="relative max-w-2xl mx-auto">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, category, or description…"
                className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-white text-slate-800 placeholder-slate-400 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Department Filter Tabs ─────────────────────────────────────── */}
      <section className="bg-slate-900 border-b border-slate-800 text-white shadow-inner">
        <div className="w-[90%] max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
            <span className="font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0 flex items-center gap-1">
              <span>🏛</span> Department:
            </span>
            <button
              onClick={() => setSelectedDept('All')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl font-semibold transition ${
                selectedDept === 'All'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-900/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Departments ({totalCount})
            </button>
            {departments.map((dept) => {
              const name = typeof dept === 'object' ? dept.name : dept;
              const key = typeof dept === 'object' ? dept.id : dept;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDept(name)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 ${
                    selectedDept === name
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-900/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>🏛</span>
                  <span>{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Book Grid ───────────────────────────────────────────────────── */}
      <section className="py-10 bg-slate-50 min-h-[600px]">
        <div className="w-[90%] max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <ErrorMessage message={error} />

          <div>
            <AnimatePresence mode="wait">
              {loading ? (
                <Loading key="loading" message="Loading books from database…" />
              ) : books.length === 0 ? (
                token && role === 'student' && approvalStatus === 'pending' ? (
                  <motion.div
                    key="pending"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl mx-auto my-8 bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-amber-200/80 text-center relative overflow-hidden"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5 text-3xl">
                      ⏳
                    </div>
                    <span className="inline-block text-xs font-bold text-amber-800 bg-amber-100 px-3.5 py-1 rounded-full uppercase tracking-wider mb-3">
                      🟡 Pending Approval
                    </span>
                    <h3 className="text-2xl font-extrabold text-slate-900 mb-3 tracking-tight">
                      Your library account is awaiting approval
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6 max-w-lg mx-auto">
                      Your registration has been submitted successfully. A librarian from your department ({userProfile?.profile?.department || userProfile?.department || 'your department'}) needs to approve your account before you can browse the book collection and access borrowing privileges.
                    </p>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 max-w-md mx-auto mb-6 text-left text-xs text-slate-600 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700">Account Status:</span>
                        <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">🟡 Pending Approval</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700">Next Step:</span>
                        <span>Department Librarian Verification</span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Link
                        to="/account"
                        className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md transition-colors"
                      >
                        View / Update Profile →
                      </Link>
                    </div>
                  </motion.div>
                ) : token && role === 'student' && approvalStatus === 'rejected' ? (
                  <motion.div
                    key="rejected"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl mx-auto my-8 bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-red-200/80 text-center relative overflow-hidden"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5 text-3xl">
                      ❌
                    </div>
                    <span className="inline-block text-xs font-bold text-red-800 bg-red-100 px-3.5 py-1 rounded-full uppercase tracking-wider mb-3">
                      🔴 Registration Rejected
                    </span>
                    <h3 className="text-2xl font-extrabold text-slate-900 mb-3 tracking-tight">
                      Your library registration was not approved
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-6 max-w-lg mx-auto">
                      Your library registration could not be approved by your department librarian. Please visit your account page or contact your department library administrator.
                    </p>
                    <div className="flex justify-center">
                      <Link
                        to="/account"
                        className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md transition-colors"
                      >
                        View Account Details →
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-20"
                  >
                    <div className="text-5xl mb-4">📭</div>
                    <p className="text-slate-600 font-semibold mb-1">No books found</p>
                    <p className="text-slate-400 text-sm">
                      {searchQuery
                        ? `No results for "${searchQuery}".`
                        : `No books in category "${category}".`}
                    </p>
                    {(searchQuery || category !== 'All') && (
                      <button
                        onClick={() => { setSearchQuery(''); setCategory('All'); }}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Clear Filters
                      </button>
                    )}
                  </motion.div>
                )
              ) : (
                <motion.div key="books" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-sm text-slate-500 mb-5">
                    Showing <span className="font-semibold text-slate-800">{books.length}</span> of{' '}
                    <span className="font-semibold text-slate-800">{totalCount}</span> books
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                    {books.map((book, i) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        index={i}
                        trackView
                        onClick={setSelectedBook}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-10">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        ← Prev
                      </button>
                      <span className="text-sm font-semibold text-slate-700 bg-white px-4 py-2 rounded-lg border border-slate-200">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next Page →
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Floating Centered Book Preview Modal */}
      <AnimatePresence>
        {selectedBook && (
          <BookDetail
            key={selectedBook.id}
            book={selectedBook}
            onClose={() => setSelectedBook(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
