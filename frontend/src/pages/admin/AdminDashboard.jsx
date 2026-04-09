import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  getAdminStats,
  getAdminStudents,
  getAdminBooks,
  listPageContents,
  createPageContent,
  updatePageContent,
  deletePageContent,
  fetchBooks,
  createBook,
  updateBook,
  deleteBook,
  getStudentList,
  updateStudent,
  deleteStudent,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../services/api";

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState("website");
  const [stats, setStats] = useState({
    total_books: 0,
    available_books: 0,
    total_students: 0,
    total_categories: 0,
    total_borrow_requests: 0,
    overdue_books: 0,
  });
  
  // Website section
  const [pageContents, setPageContents] = useState([]);
  const [showPageModal, setShowPageModal] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [pageForm, setPageForm] = useState({
    page: "",
    title: "",
    heading: "",
    subheading: "",
    description: "",
    content: {},
    is_active: true,
  });
  
  // Students section
  const [students, setStudents] = useState([]);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    department: "",
    year: "",
  });
  
  // Books section
  const [books, setBooks] = useState([]);
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookForm, setBookForm] = useState({
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
    categories: "",
  });
  
  // Categories
  const [categories, setCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      setError("Please login");
      setLoading(false);
      return;
    }
    loadData();
  }, [activeSection]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Load stats
      const statsData = await getAdminStats(token);
      setStats(statsData);
      
      if (activeSection === "website") {
        const pages = await listPageContents(token);
        setPageContents(Array.isArray(pages) ? pages : []);
      } else if (activeSection === "students") {
        const studs = await getAdminStudents(token);
        setStudents(Array.isArray(studs) ? studs : []);
      } else if (activeSection === "books") {
        const booksData = await getAdminBooks(token);
        setBooks(Array.isArray(booksData) ? booksData : []);
      } else if (activeSection === "categories") {
        const cats = await getCategories(token);
        setCategories(Array.isArray(cats.results) ? cats.results : Array.isArray(cats) ? cats : []);
      }
    } catch (err) {
      setError(err.error || err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Page Content Handlers
  const handlePageSubmit = async () => {
    try {
      if (editingPage) {
        await updatePageContent(token, editingPage.page, pageForm);
        setSuccess("Page content updated successfully!");
      } else {
        await createPageContent(token, pageForm);
        setSuccess("Page content created successfully!");
      }
      setShowPageModal(false);
      setEditingPage(null);
      setPageForm({
        page: "",
        title: "",
        heading: "",
        subheading: "",
        description: "",
        content: {},
        is_active: true,
      });
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.error || err.message || "Failed to save page content");
    }
  };

  const handlePageDelete = async (page) => {
    if (!window.confirm(`Delete content for ${page} page?`)) return;
    try {
      await deletePageContent(token, page);
      setSuccess("Page content deleted successfully!");
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.error || err.message || "Failed to delete page content");
    }
  };

  const openPageModal = (page = null) => {
    if (page) {
      setEditingPage(page);
      setPageForm({
        page: page.page,
        title: page.title || "",
        heading: page.heading || "",
        subheading: page.subheading || "",
        description: page.description || "",
        content: page.content || {},
        is_active: page.is_active !== false,
      });
    } else {
      setEditingPage(null);
      setPageForm({
        page: "",
        title: "",
        heading: "",
        subheading: "",
        description: "",
        content: {},
        is_active: true,
      });
    }
    setShowPageModal(true);
  };

  // Student Handlers
  const handleStudentUpdate = async () => {
    if (!editingStudent) return;
    try {
      await updateStudent(token, editingStudent.id, studentForm);
      setSuccess("Student updated successfully!");
      setShowStudentModal(false);
      setEditingStudent(null);
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.error || err.message || "Failed to update student");
    }
  };

  const handleStudentDelete = async (studentId) => {
    if (!window.confirm("Are you sure you want to delete this student?")) return;
    try {
      await deleteStudent(token, studentId);
      setSuccess("Student deleted successfully!");
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.error || err.message || "Failed to delete student");
    }
  };

  const openStudentModal = (student = null) => {
    if (student) {
      setEditingStudent(student);
      setStudentForm({
        first_name: student.first_name || "",
        last_name: student.last_name || "",
        email: student.email || "",
        department: student.profile?.department || "",
        year: student.profile?.year || "",
      });
    } else {
      setEditingStudent(null);
      setStudentForm({ first_name: "", last_name: "", email: "", department: "", year: "" });
    }
    setShowStudentModal(true);
  };

  // Book Handlers
  const handleBookSubmit = async () => {
    try {
      if (editingBook) {
        await updateBook(token, editingBook.id, bookForm);
        setSuccess("Book updated successfully!");
      } else {
        await createBook(token, bookForm);
        setSuccess("Book created successfully!");
      }
      setShowBookModal(false);
      setEditingBook(null);
      setBookForm({
        title: "", authors: "", isbn13: "", isbn10: "", subtitle: "", description: "",
        thumbnail: "", published_year: "", average_rating: "", num_pages: "",
        total_copies: 1, available_copies: 1, categories: ""
      });
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.error || err.message || "Failed to save book");
    }
  };

  const handleBookDelete = async (bookId) => {
    if (!window.confirm("Are you sure you want to delete this book?")) return;
    try {
      await deleteBook(token, bookId);
      setSuccess("Book deleted successfully!");
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.error || err.message || "Failed to delete book");
    }
  };

  const openBookModal = (book = null) => {
    if (book) {
      setEditingBook(book);
      setBookForm({
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
        categories: book.categories || "",
      });
    } else {
      setEditingBook(null);
      setBookForm({
        title: "", authors: "", isbn13: "", isbn10: "", subtitle: "", description: "",
        thumbnail: "", published_year: "", average_rating: "", num_pages: "",
        total_copies: 1, available_copies: 1, categories: ""
      });
    }
    setShowBookModal(true);
  };

  // Category Handlers
  const handleCategorySubmit = async () => {
    try {
      if (editingCategory) {
        await updateCategory(token, editingCategory.id, categoryForm);
        setSuccess("Category updated successfully!");
      } else {
        await createCategory(token, categoryForm);
        setSuccess("Category created successfully!");
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "" });
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.error || err.message || "Failed to save category");
    }
  };

  const handleCategoryDelete = async (categoryId) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await deleteCategory(token, categoryId);
      setSuccess("Category deleted successfully!");
      loadData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.error || err.message || "Failed to delete category");
    }
  };

  if (loading && activeSection === "website") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
          🎛️ Superuser Admin Dashboard
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-4"
          >
            <h3 className="text-2xl font-bold text-gray-900">{stats.total_books || 0}</h3>
            <p className="text-sm text-gray-600">Books</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-4"
          >
            <h3 className="text-2xl font-bold text-green-600">{stats.available_books || 0}</h3>
            <p className="text-sm text-gray-600">Available</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-4"
          >
            <h3 className="text-2xl font-bold text-blue-600">{stats.total_students || 0}</h3>
            <p className="text-sm text-gray-600">Students</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-4"
          >
            <h3 className="text-2xl font-bold text-orange-600">{stats.total_categories || 0}</h3>
            <p className="text-sm text-gray-600">Categories</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg p-4"
          >
            <h3 className="text-2xl font-bold text-yellow-600">{stats.total_borrow_requests || 0}</h3>
            <p className="text-sm text-gray-600">Requests</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-lg p-4"
          >
            <h3 className="text-2xl font-bold text-red-600">{stats.overdue_books || 0}</h3>
            <p className="text-sm text-gray-600">Overdue</p>
          </motion.div>
        </div>

        {/* Section Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "website", label: "🌐 Website", icon: "🌐" },
              { id: "students", label: "👨‍🎓 Students", icon: "👨‍🎓" },
              { id: "books", label: "📚 Books", icon: "📚" },
              { id: "categories", label: "📂 Categories", icon: "📂" },
            ].map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  activeSection === section.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Website Section */}
        {activeSection === "website" && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Page Content Management</h3>
              <button
                onClick={() => openPageModal()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add Page Content
              </button>
            </div>
            {pageContents.length === 0 ? (
              <p className="text-gray-500">No page content yet. Create content for Home, About, Gallery, or Books pages.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pageContents.map((page) => (
                  <div key={page.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900 capitalize">{page.page}</h4>
                      <span className={`px-2 py-1 rounded text-xs ${page.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {page.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{page.title || 'No title'}</p>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{page.description || 'No description'}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openPageModal(page)}
                        className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handlePageDelete(page.page)}
                        className="flex-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Students Section */}
        {activeSection === "students" && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Student Management</h3>
            </div>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading students...</p>
              </div>
            ) : students.length === 0 ? (
              <p className="text-gray-500">No students found</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {students.map((student) => (
                  <div key={student.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="font-semibold text-gray-900">{student.username}</p>
                    <p className="text-sm text-gray-600">{student.email}</p>
                    <p className="text-sm text-gray-600">{student.first_name} {student.last_name}</p>
                    {student.profile && (
                      <>
                        <p className="text-xs text-gray-500">Dept: {student.profile.department || 'N/A'}</p>
                        <p className="text-xs text-gray-500">Year: {student.profile.year || 'N/A'}</p>
                      </>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openStudentModal(student)}
                        className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleStudentDelete(student.id)}
                        className="flex-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Books Section */}
        {activeSection === "books" && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Book Management</h3>
              <button
                onClick={() => openBookModal()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add Book
              </button>
            </div>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading books...</p>
              </div>
            ) : books.length === 0 ? (
              <p className="text-gray-500">No books found</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {books.slice(0, 20).map((book) => (
                  <div key={book.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{book.title}</h4>
                    <p className="text-sm text-gray-600 mb-1">Author: {book.authors}</p>
                    <p className="text-sm text-gray-600 mb-1">Available: {book.available_copies}/{book.total_copies}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openBookModal(book)}
                        className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleBookDelete(book.id)}
                        className="flex-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Categories Section */}
        {activeSection === "categories" && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Category Management</h3>
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryForm({ name: "", description: "" });
                  setShowCategoryModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add Category
              </button>
            </div>
            {categories.length === 0 ? (
              <p className="text-gray-500">No categories yet</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                  <div key={category.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-1">{category.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{category.description || "No description"}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingCategory(category);
                          setCategoryForm({ name: category.name, description: category.description || "" });
                          setShowCategoryModal(true);
                        }}
                        className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleCategoryDelete(category.id)}
                        className="flex-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Page Content Modal */}
        {showPageModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold mb-4">
                {editingPage ? "Edit Page Content" : "Create Page Content"}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Page *</label>
                  <select
                    value={pageForm.page}
                    onChange={(e) => setPageForm({...pageForm, page: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                    disabled={!!editingPage}
                  >
                    <option value="">Select Page</option>
                    <option value="home">Home</option>
                    <option value="about">About Us</option>
                    <option value="gallery">Gallery</option>
                    <option value="books">Books</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Title</label>
                  <input
                    type="text"
                    value={pageForm.title}
                    onChange={(e) => setPageForm({...pageForm, title: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Page Title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Heading</label>
                  <input
                    type="text"
                    value={pageForm.heading}
                    onChange={(e) => setPageForm({...pageForm, heading: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Main Heading"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Subheading</label>
                  <input
                    type="text"
                    value={pageForm.subheading}
                    onChange={(e) => setPageForm({...pageForm, subheading: e.target.value})}
                    className="w-full p-2 border rounded"
                    placeholder="Subheading"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Description</label>
                  <textarea
                    value={pageForm.description}
                    onChange={(e) => setPageForm({...pageForm, description: e.target.value})}
                    rows={5}
                    className="w-full p-2 border rounded"
                    placeholder="Page Description"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pageForm.is_active}
                    onChange={(e) => setPageForm({...pageForm, is_active: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <label className="text-sm font-semibold">Active</label>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handlePageSubmit}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingPage ? "Update" : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowPageModal(false);
                    setEditingPage(null);
                    setPageForm({
                      page: "",
                      title: "",
                      heading: "",
                      subheading: "",
                      description: "",
                      content: {},
                      is_active: true,
                    });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Student Modal */}
        {showStudentModal && editingStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">Edit Student</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="First Name"
                  value={studentForm.first_name}
                  onChange={(e) => setStudentForm({...studentForm, first_name: e.target.value})}
                  className="w-full p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={studentForm.last_name}
                  onChange={(e) => setStudentForm({...studentForm, last_name: e.target.value})}
                  className="w-full p-2 border rounded"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
                  className="w-full p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="Department"
                  value={studentForm.department}
                  onChange={(e) => setStudentForm({...studentForm, department: e.target.value})}
                  className="w-full p-2 border rounded"
                />
                <input
                  type="number"
                  placeholder="Year"
                  value={studentForm.year}
                  onChange={(e) => setStudentForm({...studentForm, year: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleStudentUpdate}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Update
                </button>
                <button
                  onClick={() => {
                    setShowStudentModal(false);
                    setEditingStudent(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Book Modal */}
        {showBookModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">
                {editingBook ? "Edit Book" : "Add Book"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Title *"
                  value={bookForm.title}
                  onChange={(e) => setBookForm({...bookForm, title: e.target.value})}
                  className="col-span-2 p-2 border rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="Authors *"
                  value={bookForm.authors}
                  onChange={(e) => setBookForm({...bookForm, authors: e.target.value})}
                  className="col-span-2 p-2 border rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="ISBN-13"
                  value={bookForm.isbn13}
                  onChange={(e) => setBookForm({...bookForm, isbn13: e.target.value})}
                  className="p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="ISBN-10"
                  value={bookForm.isbn10}
                  onChange={(e) => setBookForm({...bookForm, isbn10: e.target.value})}
                  className="p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="Subtitle"
                  value={bookForm.subtitle}
                  onChange={(e) => setBookForm({...bookForm, subtitle: e.target.value})}
                  className="col-span-2 p-2 border rounded"
                />
                <textarea
                  placeholder="Description"
                  value={bookForm.description}
                  onChange={(e) => setBookForm({...bookForm, description: e.target.value})}
                  rows={3}
                  className="col-span-2 p-2 border rounded"
                />
                <input
                  type="url"
                  placeholder="Thumbnail URL"
                  value={bookForm.thumbnail}
                  onChange={(e) => setBookForm({...bookForm, thumbnail: e.target.value})}
                  className="col-span-2 p-2 border rounded"
                />
                <input
                  type="number"
                  placeholder="Published Year"
                  value={bookForm.published_year}
                  onChange={(e) => setBookForm({...bookForm, published_year: e.target.value})}
                  className="p-2 border rounded"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Rating"
                  value={bookForm.average_rating}
                  onChange={(e) => setBookForm({...bookForm, average_rating: e.target.value})}
                  className="p-2 border rounded"
                />
                <input
                  type="number"
                  placeholder="Pages"
                  value={bookForm.num_pages}
                  onChange={(e) => setBookForm({...bookForm, num_pages: e.target.value})}
                  className="p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="Categories"
                  value={bookForm.categories}
                  onChange={(e) => setBookForm({...bookForm, categories: e.target.value})}
                  className="p-2 border rounded"
                />
                <input
                  type="number"
                  placeholder="Total Copies"
                  value={bookForm.total_copies}
                  onChange={(e) => setBookForm({...bookForm, total_copies: e.target.value})}
                  className="p-2 border rounded"
                />
                <input
                  type="number"
                  placeholder="Available Copies"
                  value={bookForm.available_copies}
                  onChange={(e) => setBookForm({...bookForm, available_copies: e.target.value})}
                  className="p-2 border rounded"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleBookSubmit}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingBook ? "Update" : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowBookModal(false);
                    setEditingBook(null);
                    setBookForm({
                      title: "", authors: "", isbn13: "", isbn10: "", subtitle: "", description: "",
                      thumbnail: "", published_year: "", average_rating: "", num_pages: "",
                      total_copies: 1, available_copies: 1, categories: ""
                    });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">
                {editingCategory ? "Edit Category" : "Add Category"}
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Category Name *"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                  className="w-full p-2 border rounded"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                  rows={3}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleCategorySubmit}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingCategory ? "Update" : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                    setCategoryForm({ name: "", description: "" });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
