import React, { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose, open }) {
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => onClose && onClose(), 4000);
    return () => clearTimeout(id);
  }, [open, onClose]);

  if (!open) return null;

  const bg = type === 'error' ? 'bg-red-600' : 'bg-green-600';

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${bg} text-white px-4 py-2 rounded shadow`}> 
      {message}
    </div>
  );
}
