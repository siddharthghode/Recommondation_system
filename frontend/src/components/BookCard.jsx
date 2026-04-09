import { useEffect } from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';
import { trackInteraction } from '../services/api';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200&h=280&fit=crop';

/**
 * BookCard — uses STRICT backend field names from Book model:
 *   book.id, book.title, book.subtitle, book.authors, book.categories,
 *   book.thumbnail, book.average_rating, book.num_pages, book.published_year,
 *   book.quantity  →  availability derived as quantity > 0
 */
export default function BookCard({ book, onClick, selected, trackView = false, index = 0 }) {
  const available = (book.quantity ?? 1) > 0;

  useEffect(() => {
    if (trackView && book?.id) {
      const token = localStorage.getItem('token');
      if (token) {
        trackInteraction(token, book.id, 'view').catch(() => {});
      }
    }
  }, [book?.id, trackView]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      whileHover={{ y: -5 }}
      onClick={() => onClick && onClick(book)}
      className={`cursor-pointer rounded-xl overflow-hidden bg-white border transition-all duration-200 ${
        selected
          ? 'border-blue-500 shadow-lg shadow-blue-100 ring-2 ring-blue-500/20'
          : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      {/* Cover Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-100">
        <img
          src={book.thumbnail || PLACEHOLDER}
          alt={book.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          onError={(e) => { e.target.src = PLACEHOLDER; }}
        />
        {/* Availability badge */}
        <div className={`absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
          available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
        }`}>
          {available ? 'Available' : 'Borrowed'}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2 mb-1">
          {book.title}
        </h3>
        <p className="text-xs text-slate-500 mb-2 truncate">
          {book.authors || 'Unknown Author'}
        </p>
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium truncate max-w-[110px]">
            {book.categories?.toString().split(/[,;|]/)[0].trim() || 'General'}
          </span>
          {book.average_rating && (
            <span className="text-xs text-amber-600 font-medium">⭐ {Number(book.average_rating).toFixed(1)}</span>
          )}
        </div>
        {book.num_pages && (
          <p className="text-xs text-slate-400 mt-1">📄 {book.num_pages} pages</p>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onClick && onClick(book); }}
          className="mt-3 w-full text-xs font-semibold bg-blue-600 text-white py-1.5 rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          View Details
        </button>
      </div>
    </motion.div>
  );
}
