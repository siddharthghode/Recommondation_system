import React from 'react';

export default function BookListItem({ book, onView }) {
  const title = book.title || book.book__title || book.name || 'Untitled';
  const author = book.author || book.authors || book.book__author || '';
  const available = typeof book.in_stock !== 'undefined' ? book.in_stock > 0 : (book.available !== undefined ? book.available : true);

  return (
    <div className="py-2 flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-gray-800">{title}</div>
        {author ? <div className="text-xs text-gray-500">{author}</div> : null}
      </div>
      <div className="flex items-center gap-3">
        <div className={`text-xs ${available ? 'text-green-600' : 'text-red-600'}`}>{available ? 'Available' : 'Out'}</div>
        {onView ? (
          <button onClick={() => onView(book)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">View</button>
        ) : null}
      </div>
    </div>
  );
}
