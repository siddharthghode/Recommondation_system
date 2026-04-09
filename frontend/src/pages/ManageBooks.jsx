import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { BASE_URL } from '../services/api';

export default function ManageBooks() {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'all'; // all, in_stock, out_of_stock
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState({ open: false, message: '', type: 'info' });
  const [confirmState, setConfirmState] = useState({ open: false, action: null, payload: null });
  const [editingBook, setEditingBook] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    categories: '',
    quantity: 0,
    description: '',
    published_year: ''
  });

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadBooks();
  }, [token, filter, navigate]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/books/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load books');
      const data = await res.json();
      let filteredBooks = Array.isArray(data) ? data : (data.results || []);
      
      // Apply filter
      if (filter === 'in_stock') {
        filteredBooks = filteredBooks.filter(b => (b.quantity || 0) > 0);
      } else if (filter === 'out_of_stock') {
        filteredBooks = filteredBooks.filter(b => (b.quantity || 0) === 0);
      }
      
      setBooks(filteredBooks);
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: 'Failed to load books', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (bookId) => {
    setConfirmState({ 
      open: true, 
      action: 'delete', 
      payload: bookId,
      title: <span className="text-black">Delete Book</span>,
      message: <span className="text-black">Are you sure you want to delete this book? This action cannot be undone.</span>
    });
  };

  const performDelete = async () => {
    const bookId = confirmState.payload;
    setConfirmState({ ...confirmState, open: false });
    
    try {
      const res = await fetch(`${BASE_URL}/books/manage/${bookId}/`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Failed to delete book');
      }
      
      setBooks(prev => prev.filter(b => b.id !== bookId));
      setToast({ open: true, message: 'Book deleted successfully', type: 'info' });
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: err.message || 'Failed to delete book', type: 'error' });
    }
  };

  const handleEdit = (book) => {
    setEditingBook(book);
    setFormData({
      title: book.title || '',
      authors: book.authors || '',
      categories: book.categories || '',
      quantity: book.quantity || 0,
      description: book.description || '',
      published_year: book.published_year || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const isEdit = !!editingBook;
    const url = isEdit 
      ? `${BASE_URL}/books/manage/${editingBook.id}/` 
      : `${BASE_URL}/books/manage/`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || 'Failed to save book');
      }

      const savedBook = await res.json();
      
      if (isEdit) {
        setBooks(prev => prev.map(b => b.id === savedBook.id ? savedBook : b));
        setToast({ open: true, message: 'Book updated successfully', type: 'info' });
      } else {
        setBooks(prev => [savedBook, ...prev]);
        setToast({ open: true, message: 'Book added successfully', type: 'info' });
      }

      // Reset form
      setEditingBook(null);
      setShowAddModal(false);
      setFormData({
        title: '', authors: '', categories: '', quantity: 0, description: '', published_year: ''
      });
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: err.message || 'Failed to save book', type: 'error' });
    }
  };

  // Filter and paginate
  const filteredBooks = books.filter(b => {
    const q = searchQuery.toLowerCase();
    return !q || 
      (b.title || '').toLowerCase().includes(q) ||
      (b.authors || '').toLowerCase().includes(q) ||
      (b.categories || '').toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
  const pagedBooks = filteredBooks.slice((page - 1) * pageSize, page * pageSize);

  const getTitle = () => {
    if (filter === 'in_stock') return 'Books In Stock';
    if (filter === 'out_of_stock') return 'Out of Stock Books';
    return 'Manage All Books';
  };

  const canEdit = filter === 'all';

  return (
    <Layout>
      <div className="p-4 md:p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => navigate('/librarian')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {getTitle()}
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">{filteredBooks.length} books found</p>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Book
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search by title, author, or category..."
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 pl-12 focus:border-blue-400 focus:outline-none"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Books List */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : pagedBooks.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500">No books found</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Title</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Authors</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Categories</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Year</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Quantity</th>
                        {canEdit && <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pagedBooks.map(book => (
                        <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{book.title}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{book.authors || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{book.categories || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{book.published_year || 'N/A'}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              book.quantity > 0 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {book.quantity}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEdit(book)}
                                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 min-h-[44px]"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(book.id)}
                                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 min-h-[44px]"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-200">
                  {pagedBooks.map(book => (
                    <div key={book.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="text-sm font-bold text-gray-900 line-clamp-2">
                              {book.title}
                            </h3>
                            <p className="text-xs text-gray-600 mt-1">
                              {book.authors || 'N/A'}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            book.quantity > 0 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            Qty: {book.quantity}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                          {book.categories && (
                            <span className="px-2 py-1 bg-gray-100 rounded">
                              📚 {book.categories}
                            </span>
                          )}
                          {book.published_year && (
                            <span className="px-2 py-1 bg-gray-100 rounded">
                              📅 {book.published_year}
                            </span>
                          )}
                        </div>

                        {canEdit && (
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleEdit(book)}
                              className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-200 min-h-[44px]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(book.id)}
                              className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200 min-h-[44px]"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="px-4 md:px-6 py-4 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600 text-center sm:text-left">
                      Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, filteredBooks.length)} of {filteredBooks.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold disabled:opacity-40 min-h-[44px]"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-2 text-sm flex items-center">Page {page} of {totalPages}</span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold disabled:opacity-40 min-h-[44px]"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingBook) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingBook ? 'Edit Book' : 'Add New Book'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-black focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Authors *</label>
                  <input
                    type="text"
                    required
                    value={formData.authors}
                    onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-black focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Categories</label>
                  <input
                    type="text"
                    value={formData.categories}
                    onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-black focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-black focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Publication Year</label>
                  <input
                    type="number"
                    value={formData.published_year}
                    onChange={(e) => setFormData({ ...formData, published_year: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-black focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-2 text-black focus:border-blue-400 focus:outline-none"
                ></textarea>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingBook(null); }}
                  className="px-6 py-2 bg-gray-200 text-white rounded-lg font-semibold hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700"
                >
                  {editingBook ? 'Update Book' : 'Add Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        onConfirm={performDelete}
        onCancel={() => setConfirmState({ ...confirmState, open: false })}
      >
        {confirmState.message}
      </ConfirmModal>

      <Toast
        open={toast.open}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, open: false })}
      />
    </Layout>
  );
}
