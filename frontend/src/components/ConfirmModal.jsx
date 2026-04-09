import React from 'react';

export default function ConfirmModal({ open, title, children, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-black">{title}</h3>
        </div>
        <div className="p-4 text-black">{children}</div>
        <div className="p-4 flex justify-end gap-2 border-t">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-100">{cancelText}</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-blue-600 text-white">{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
