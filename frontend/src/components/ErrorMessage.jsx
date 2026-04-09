import React from "react";

export default function ErrorMessage({ message, onRetry, retryLabel = "Retry" }) {
  if (!message) return null;

  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm">{message}</div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
