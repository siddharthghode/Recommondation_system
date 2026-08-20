import { motion } from 'framer-motion';
import { trackDwellTime, trackInteraction, requestBorrow } from '../services/api';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=560&fit=crop';

/**
 * BookDetail — Floating Modal / Dialog / Lightbox-style Book Preview
 * Displays a centered floating modal window while keeping the catalog underneath.
 * Automatically tracks view interactions, dwell time, likes, and borrow requests.
 */
export default function BookDetail({ book, onClose }) {
  const [borrowing, setBorrowing] = useState(false);
  const [borrowError, setBorrowError] = useState('');
  const [borrowSuccess, setBorrowSuccess] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeFeedback, setLikeFeedback] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratedSuccess, setRatedSuccess] = useState(false);

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const navigate = useNavigate();

  // ── Robust Page-Visibility-Aware Dwell Time Tracking ──────────────────────
  // Measures active visible reading duration only, pausing when tab is hidden.
  const accumulatedTimeRef = useRef(0);
  const lastVisibleStartRef = useRef(null);
  const hasSubmittedRef = useRef(false);

  // Derive availability from quantity
  const available = (book?.quantity ?? 1) > 0;

  // Parse comma-separated categories
  const categories = book?.categories
    ? book.categories.toString().split(/[,;|]/).map(c => c.trim()).filter(Boolean)
    : [];

  // 1. Auto-track VIEW interaction on open
  useEffect(() => {
    if (!book?.id) return;
    if (token) {
      trackInteraction(token, book.id, 'view').catch(() => {});
    }
  }, [book?.id, token]);

  // 2. Page-Visibility-Aware Dwell Time Accumulator & Submitter
  useEffect(() => {
    setBorrowing(false);
    setBorrowError('');
    setBorrowSuccess(false);

    if (!book?.id || !token) return;

    // Initialize tracking for this book session
    accumulatedTimeRef.current = 0;
    hasSubmittedRef.current = false;
    lastVisibleStartRef.current =
      typeof document !== 'undefined' && document.visibilityState === 'visible'
        ? Date.now()
        : null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab went to background: record elapsed visible segment and pause
        if (lastVisibleStartRef.current !== null) {
          accumulatedTimeRef.current += Date.now() - lastVisibleStartRef.current;
          lastVisibleStartRef.current = null;
        }
      } else if (document.visibilityState === 'visible') {
        // Tab returned to foreground: resume active timer
        lastVisibleStartRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // On unmount, modal close, or book change: compute final active time and submit once
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (hasSubmittedRef.current) return;

      if (lastVisibleStartRef.current !== null) {
        accumulatedTimeRef.current += Date.now() - lastVisibleStartRef.current;
        lastVisibleStartRef.current = null;
      }

      const totalSeconds = accumulatedTimeRef.current / 1000;

      // Only send meaningful reading durations (>= 0.5s) to avoid empty zero-second noise
      if (totalSeconds >= 0.5 && token && book?.id) {
        hasSubmittedRef.current = true;
        const roundedSeconds = Math.round(totalSeconds * 10) / 10;
        trackDwellTime(token, book.id, roundedSeconds).catch(() => {});
      }
    };
  }, [book?.id, token]);

  // 3. Close on Escape key
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  // Prevent background body scroll while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Handle Like Interaction
  const handleLike = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    const newLiked = !liked;
    setLiked(newLiked);
    if (newLiked) {
      setLikeFeedback(true);
      setTimeout(() => setLikeFeedback(false), 2000);
      try {
        await trackInteraction(token, book.id, 'like');
      } catch (err) {
        console.warn('Failed to record like:', err);
      }
    }
  };

  // Handle Star Rating
  const handleRate = async (stars) => {
    if (!token) {
      navigate('/login');
      return;
    }
    setUserRating(stars);
    try {
      await trackInteraction(token, book.id, 'rate', stars);
      setRatedSuccess(true);
      setTimeout(() => setRatedSuccess(false), 2500);
    } catch (err) {
      console.warn('Failed to submit rating:', err);
    }
  };

  // Handle Borrow Request
  const handleBorrow = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (role !== 'student') {
      setBorrowError('Only students can borrow books.');
      return;
    }
    if (!book?.id) {
      setBorrowError('Book ID not available.');
      return;
    }
    if (!available) {
      setBorrowError('This book is currently out of stock.');
      return;
    }
    if (!window.confirm(`Request to borrow "${book.title}"?`)) return;

    try {
      setBorrowing(true);
      setBorrowError('');
      await requestBorrow(token, book.id);
      setBorrowSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setBorrowError(err.error || err.detail || err.message || 'Failed to submit borrow request.');
    } finally {
      setBorrowing(false);
    }
  };

  if (!book) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Blurred Backdrop */}
      <motion.div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Modal Window */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-title"
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 z-10 my-auto"
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 shrink-0" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-white/95 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Book Preview
            </span>
            <span className="text-slate-300">•</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
            }`}>
              {available ? `✓ In Stock (${book.quantity ?? 1} available)` : '✕ Out of Stock'}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Modal Body (Scrollable if description is long) */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6 items-start">
            {/* Left: Book Cover & Quick Meta */}
            <div className="flex flex-col items-center sm:items-start space-y-3">
              <div className="w-36 sm:w-full aspect-[3/4] rounded-xl overflow-hidden shadow-lg bg-slate-100 border border-slate-200 shrink-0">
                <img
                  src={book.thumbnail || PLACEHOLDER}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.src = PLACEHOLDER; }}
                />
              </div>

              {/* Badges Column */}
              <div className="w-full grid grid-cols-1 gap-1.5 text-xs">
                {book.average_rating && (
                  <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1.5 rounded-lg font-medium border border-amber-100/60">
                    <span>⭐ {Number(book.average_rating).toFixed(1)} / 5.0</span>
                    {book.ratings_count ? (
                      <span className="text-amber-600 text-[10px]">({book.ratings_count})</span>
                    ) : null}
                  </div>
                )}
                {book.num_pages && (
                  <div className="flex items-center gap-1.5 bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <span>📄 {book.num_pages} pages</span>
                  </div>
                )}
                {book.published_year && (
                  <div className="flex items-center gap-1.5 bg-slate-50 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <span>📅 Year {book.published_year}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Book Details & Description */}
            <div className="space-y-4">
              <div>
                <h2 id="book-title" className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                  {book.title}
                </h2>
                {book.subtitle && (
                  <p className="text-sm text-slate-500 italic mt-0.5">{book.subtitle}</p>
                )}
                <p className="text-sm font-medium text-indigo-600 mt-1 flex items-center gap-1.5">
                  <span className="text-slate-400 font-normal">by</span>
                  {book.authors || 'Unknown Author'}
                </p>
              </div>

              {/* Categories */}
              {categories.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-1.5">
                    Category
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium border border-blue-100"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-1.5">
                  About this Book
                </h4>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {book.description ? book.description : 'No description available for this book.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Borrow Error or Success Feedback */}
          {borrowError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">
              {borrowError}
            </div>
          )}
          {borrowSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2">
              <span>✓</span> Borrow request submitted successfully! Your department librarian will review it.
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Like & Rate Buttons */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={handleLike}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  liked
                    ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                }`}
              >
                <span className={`text-base leading-none transition-transform ${liked ? 'scale-125' : ''}`}>
                  {liked ? '❤️' : '🤍'}
                </span>
                <span>{liked ? 'Liked' : 'Like'}</span>
              </button>

              {likeFeedback && (
                <span className="absolute -top-7 left-0 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap animate-bounce">
                  Added to your interests!
                </span>
              )}
            </div>

            {/* Interactive 5-Star Rating */}
            {token && (
              <div className="relative flex items-center bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs text-slate-400 font-medium mr-2 hidden sm:inline">Rate:</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRate(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="text-base transition-transform hover:scale-125 focus:outline-none"
                      title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    >
                      {star <= (hoverRating || userRating) ? '⭐' : '☆'}
                    </button>
                  ))}
                </div>
                {ratedSuccess && (
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow whitespace-nowrap animate-bounce">
                    Rated {userRating} ⭐!
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action & Close Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            >
              Close
            </button>

            {token && role === 'student' ? (
              <button
                onClick={handleBorrow}
                disabled={borrowing || !available || borrowSuccess}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-all"
              >
                {borrowing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Requesting...
                  </>
                ) : borrowSuccess ? (
                  '✓ Requested'
                ) : available ? (
                  '📚 Request to Borrow'
                ) : (
                  'Out of Stock'
                )}
              </button>
            ) : !token ? (
              <button
                onClick={() => navigate('/login')}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/20 transition-colors"
              >
                Login to Borrow
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
