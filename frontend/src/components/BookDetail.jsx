/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';
import { trackDwellTime, trackInteraction, requestBorrow } from '../services/api';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=560&fit=crop';

/**
 * BookDetail — strict backend fields:
 *   book.id, book.title, book.subtitle, book.authors, book.categories,
 *   book.thumbnail, book.average_rating, book.num_pages, book.published_year,
 *   book.quantity, book.description
 * No isbn13/isbn10 — not in the Book model.
 */
export default function BookDetail({ book, onClose, onSelectBook, variant = "overlay" }) {
  const [borrowing, setBorrowing] = useState(false);
  const [borrowError, setBorrowError] = useState('');
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const navigate = useNavigate();

  // Track dwell time per-open/book (sent on unmount / book switch).
  const dwellStartRef = useRef(null);

  // Derive availability from quantity
  const available = (book?.quantity ?? 1) > 0;

  // Parse comma-separated categories
  const categories = book?.categories
    ? book.categories.toString().split(/[,;|]/).map(c => c.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    if (!book?.id) return;
    if (token) trackInteraction(token, book.id, 'view').catch(() => {});
  }, [book?.id, token]);

  useEffect(() => {
    // Reset dwell timer when opening a new book.
    dwellStartRef.current = Date.now();
    setBorrowing(false);
    setBorrowError('');

    return () => {
      if (!token) return;
      if (!book?.id) return;
      if (!dwellStartRef.current) return;

      const durationSeconds = (Date.now() - dwellStartRef.current) / 1000;
      if (durationSeconds <= 0) return;

      // Fire-and-forget dwell tracking; UI shouldn't block on this.
      trackDwellTime(token, book.id, durationSeconds).catch(() => {});
    };
  }, [book?.id, token]);

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const handleBorrow = async () => {
    if (!token) { navigate('/login'); return; }
    if (role !== 'student') { setBorrowError('Only students can borrow books.'); return; }
    if (!book?.id) { setBorrowError('Book ID not available.'); return; }
    if (!available) { setBorrowError('This book is currently not available.'); return; }
    if (!window.confirm(`Request to borrow "${book.title}"?`)) return;
    try {
      setBorrowing(true);
      setBorrowError('');
      await requestBorrow(token, book.id);
      alert('Borrow request submitted! The librarian will review it.');
      onClose();
    } catch (err) {
      setBorrowError(err.error || err.message || 'Failed to submit borrow request.');
    } finally {
      setBorrowing(false);
    }
  };

  if (!book) return null;

  const isOverlay = variant === "overlay";

  return (
    <div className={`${isOverlay ? 'fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6' : ''}`}>
      {isOverlay && (
        <motion.div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
      )}

      <motion.div
        initial={{ opacity: 0, x: isOverlay ? 0 : 40, scale: isOverlay ? 0.95 : 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: isOverlay ? 0 : 40, scale: isOverlay ? 0.95 : 0.98 }}
        transition={{ type: "spring", damping: 24, stiffness: 220 }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-3xl shadow-2xl w-full max-w-[calc(100vw-3rem)] ${isOverlay ? 'max-h-[92vh]' : 'max-h-[90vh]'} overflow-y-auto relative mx-auto`}
        role={isOverlay ? 'dialog' : undefined}
        aria-modal={isOverlay ? 'true' : undefined}
      >
        {/* Top accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-t-3xl" />

        {/* Sticky header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between z-20">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400 font-semibold">
              <span>Book details</span>
              <span className="h-px w-8 bg-slate-200 inline-block" aria-hidden="true" />
              <span className="text-slate-500">Click a book to explore more</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 leading-tight">{book.title}</h2>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-slate-900 shadow-sm px-3 py-2 transition-colors"
              aria-label="Close book detail"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
            }`}>
              {available ? `${book.quantity} Available` : 'Not Available'}
            </span>
          </div>
        </div>

        <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Cover */}
              <div className="md:col-span-1">
                <div className="sticky top-20 space-y-4">
                  <motion.img
                    whileHover={{ scale: 1.03 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    src={book.thumbnail || PLACEHOLDER}
                    alt={book.title}
                    className="w-full rounded-xl shadow-xl object-cover aspect-[3/4]"
                    onError={(e) => { e.target.src = PLACEHOLDER; }}
                  />
                  <div className="grid gap-3">
                    {book.average_rating && (
                      <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-3 rounded-2xl text-sm font-medium">
                        <span>⭐ {Number(book.average_rating).toFixed(1)} / 5.0</span>
                        {book.ratings_count && (
                          <span className="text-amber-500 text-xs">({book.ratings_count.toLocaleString()} ratings)</span>
                        )}
                      </div>
                    )}
                    {book.num_pages && (
                      <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-3 rounded-2xl text-sm font-medium">
                        <span>📄 {book.num_pages} pages</span>
                      </div>
                    )}
                    {book.published_year && (
                      <div className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-3 rounded-2xl text-sm font-medium">
                        <span>📅 {book.published_year}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="md:col-span-2 space-y-5">
                {/* Title */}
                <div>
                  <h1 className="text-2xl md:text-2xl font-extrabold text-slate-900 leading-tight mb-1">
                    {book.title}
                  </h1>
                  {book.subtitle && (
                    <p className="text-slate-500 italic">{book.subtitle}</p>
                  )}
                </div>

                {/* Author — strictly book.authors */}
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-slate-700 font-medium">{book.authors || 'Unknown Author'}</span>
                </div>

                {/* Categories — strictly book.categories */}
                {categories.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((cat, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h3>
                  {book.description ? (
                    <p className="text-slate-700 leading-relaxed text-sm">{book.description}</p>
                  ) : (
                    <p className="text-slate-400 italic text-sm">No description available.</p>
                  )}
                </div>

                {/* Borrow button */}
                <div className="pt-4 border-t border-slate-100">
                  {borrowError && (
                    <div className="mb-3 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
                      {borrowError}
                    </div>
                  )}
                  {token && role === 'student' ? (
                    <button
                      onClick={handleBorrow}
                      disabled={borrowing || !available}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors duration-200 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                    >
                      {borrowing ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Requesting…</>
                      ) : available ? (
                        '📚 Request to Borrow'
                      ) : (
                        '❌ Not Available'
                      )}
                    </button>
                  ) : !token ? (
                    <button
                      onClick={() => navigate('/login')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors duration-200 text-sm"
                    >
                      Login to Borrow
                    </button>
                  ) : null}
                  <p className="text-xs text-slate-400 mt-2 text-center">Standard borrowing period: 30 days</p>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    );
}
