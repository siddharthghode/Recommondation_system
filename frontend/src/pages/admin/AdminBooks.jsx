import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BASE_URL, fetchBooks, createBook, updateBook, deleteBook, getCategories } from "../../services/api";

export default function AdminBooks() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    isbn13: "",
    isbn10: "",
    subtitle: "",
    description: "",
    thumbnail: "",
    published_year: "",
    average_rating: "",
    num_pages: "",
    total_copies: 1,
    available_copies: 1,
    category: "",
  });
  const token = localStorage.getItem("token");

  useEffect(() => {
    loadBooks();
    loadCategories();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const data = await fetchBooks();
      setBooks(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.error || err.message || "Failed to load books");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getCategories(token);
      setCategories(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      const bookData = {
        ...formData,
        published_year: formData.published_year ? parseInt(formData.published_year) : null,
        average_rating: formData.average_rating ? parseFloat(formData.average_rating) : null,
        num_pages: formData.num_pages ? parseInt(formData.num_pages) : null,
        total_copies: parseInt(formData.total_copies) || 1,
        available_copies: parseInt(formData.available_copies) || 1,
        category: formData.category || null,
      };

      if (editingBook) {
        await updateBook(token, editingBook.id, bookData);
        alert("Book updated successfully!");
      } else {
        await createBook(token, bookData);
        alert("Book created successfully!");
      }
      
      setShowModal(false);
      setEditingBook(null);
      resetForm();
      loadBooks();
    } catch (err) {
      setError(err.error || err.message || "Failed to save book");
    }
  };

  const handleEdit = (book) => {
    setEditingBook(book);
    setFormData({
      title: book.title || "",
      authors: book.authors || "",
      isbn13: book.isbn13 || "",
      isbn10: book.isbn10 || "",
      subtitle: book.subtitle || "",
      description: book.description || "",
      thumbnail: book.thumbnail || "",
      published_year: book.published_year || "",
      average_rating: book.average_rating || "",
      num_pages: book.num_pages || "",
      total_copies: book.total_copies || 1,
      available_copies: book.available_copies || 1,
      category: book.category || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (bookId) => {
    if (!window.confirm("Are you sure you want to delete this book?")) return;
    
    try {
      await deleteBook(token, bookId);
      alert("Book deleted successfully!");
      loadBooks();
    } catch (err) {
      setError(err.error || err.message || "Failed to delete book");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      authors: "",
      isbn13: "",
      isbn10: "",
      subtitle: "",
      description: "",
      thumbnail: "",
      published_year: "",
      average_rating: "",
      num_pages: "",
      total_copies: 1,
      available_copies: 1,
      category: "",
    });
    setEditingBook(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading books...</p>
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            📚 Manage Books
          </h2>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Book
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Books Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <img
                src={book.thumbnail || "/images/bookshelf.jpeg"}
                alt={book.title}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{book.title}</h3>
              <p className="text-sm text-gray-600 mb-2">By: {book.authors}</p>
              <p className="text-sm text-gray-600 mb-2">
                Copies: {book.available_copies || 0} / {book.total_copies || 0} available
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleEdit(book)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(book.id)}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold mb-4">
                {editingBook ? "Edit Book" : "Add New Book"}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Authors *</label>
                    <input
                      type="text"
                      value={formData.authors}
                      onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                      required
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">ISBN-13</label>
                    <input
                      type="text"
                      value={formData.isbn13}
                      onChange={(e) => setFormData({ ...formData, isbn13: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">ISBN-10</label>
                    <input
                      type="text"
                      value={formData.isbn10}
                      onChange={(e) => setFormData({ ...formData, isbn10: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Thumbnail URL</label>
                  <input
                    type="url"
                    value={formData.thumbnail}
                    onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Published Year</label>
                    <input
                      type="number"
                      value={formData.published_year}
                      onChange={(e) => setFormData({ ...formData, published_year: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Rating</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formData.average_rating}
                      onChange={(e) => setFormData({ ...formData, average_rating: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Pages</label>
                    <input
                      type="number"
                      value={formData.num_pages}
                      onChange={(e) => setFormData({ ...formData, num_pages: e.target.value })}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Total Copies</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.total_copies}
                      onChange={(e) => setFormData({ ...formData, total_copies: e.target.value })}
                      required
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Available Copies</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.available_copies}
                      onChange={(e) => setFormData({ ...formData, available_copies: e.target.value })}
                      required
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="">None</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingBook ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
