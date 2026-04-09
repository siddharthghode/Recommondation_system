import React, { useEffect, useState } from 'react';
import { fetchBooks } from '../services/api';
import BookListItem from './BookListItem';

export default function BooksList({ onView }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchBooks()
      .then(data => {
        // API may return { results: [...] } or list
        const list = Array.isArray(data) ? data : (data.results || data.items || []);
        if (mounted) setBooks(list);
      })
      .catch(err => {
        console.error('Failed to load books', err);
        if (mounted) setError(err);
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false };
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Loading books...</div>;
  if (error) return <div className="text-sm text-red-600">Failed to load books</div>;
  if (books.length === 0) return <div className="text-sm text-gray-500">No books found</div>;

  return (
    <div className="divide-y">
      {books.map((b, i) => (
        <div key={b.id || i} className="py-2">
          <BookListItem book={b} onView={onView} />
        </div>
      ))}
    </div>
  );
}
