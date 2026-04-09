import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BASE_URL, getMyBorrows, returnBook } from "../services/api";

export default function MyBorrows() {
  const [borrows, setBorrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      setError("Please login to view your borrows");
      setLoading(false);
      return;
    }
    loadBorrows();
  }, [token, statusFilter]);

  const loadBorrows = async () => {
    try {
      setLoading(true);
      const status = statusFilter === "all" ? null : statusFilter;
      const data = await getMyBorrows(token, status);
      setBorrows(data);
      setError("");
    } catch (err) {
      setError(err.error || err.message || "Failed to load borrows");
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (borrowId) => {
    if (!window.confirm("Are you sure you want to return this book?")) {
      return;
    }

    try {
      await returnBook(token, borrowId);
      setError("");
      loadBorrows();
      alert("Book returned successfully!");
    } catch (err) {
      setError(err.error || err.message || "Failed to return book");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "requested":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-blue-100 text-blue-800";
      case "returned":
        return "bg-gray-100 text-gray-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading your borrows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          📚 My Borrows
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <label className="text-sm font-semibold text-gray-700 mr-4">Filter by Status:</label>
              <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border-2 border-gray-200 rounded-lg bg-white text-gray-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All</option>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="returned">Returned</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Borrows List */}
        {borrows.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xl font-semibold text-gray-700 mb-2">No borrows found</p>
            <p className="text-gray-500">You haven't borrowed any books yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {borrows.map((borrow) => {
              const daysUntilDue = getDaysUntilDue(borrow.due_date);
              const isOverdue =
                borrow.status === "approved" &&
                daysUntilDue !== null &&
                daysUntilDue < 0;

              return (
                <motion.div
                  key={borrow.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{borrow.book_title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(borrow.status)}`}>
                      {borrow.status_display}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Requested:</strong> {formatDate(borrow.requested_at)}</p>
                    {borrow.borrow_date && (
                      <p><strong>Borrowed:</strong> {formatDate(borrow.borrow_date)}</p>
                    )}
                    {borrow.due_date && (
                      <p className={isOverdue ? "text-red-600 font-semibold" : ""}>
                        <strong>Due Date:</strong> {formatDate(borrow.due_date)}
                        {daysUntilDue !== null && (
                          <span className="ml-2">
                            ({daysUntilDue > 0 ? `${daysUntilDue} days left` : `${Math.abs(daysUntilDue)} days overdue`})
                          </span>
                        )}
                      </p>
                    )}
                    {borrow.return_date && (
                      <p><strong>Returned:</strong> {formatDate(borrow.return_date)}</p>
                    )}
                    {borrow.approved_by_name && (
                      <p><strong>Approved by:</strong> {borrow.approved_by_name}</p>
                    )}
                  </div>

                  {borrow.status === "approved" && (
                    <button
                      onClick={() => handleReturn(borrow.id)}
                      className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Return Book
                    </button>
                  )}

                  {isOverdue && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-800 text-sm font-semibold">⚠️ This book is overdue. Please return it as soon as possible.</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
