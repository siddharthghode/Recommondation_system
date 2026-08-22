import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BASE_URL, getMyBorrows, fetchRecommendations, getDepartments, getBookCategories } from "../services/api";
import BookCard from "../components/BookCard";
import BookDetail from "../components/BookDetail";

const POPULAR_CATEGORIES = [
  "History",
  "Biology",
  "Computer Science",
  "Artificial Intelligence",
  "Data Science",
  "Algorithms",
  "Web Development",
  "Database",
  "Software Engineering",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Engineering",
  "Philosophy & Ethics",
  "Economics",
  "Business & Management",
  "Psychology",
  "Politics",
  "Literature",
  "Fiction",
  "Biographies",
  "Science Fiction",
  "Law & Criminology",
  "Art",
  "Music",
  "Geography",
];

export default function AccountDetails() {
  const [profile, setProfile] = useState(null);
  const [borrowStats, setBorrowStats] = useState({
    total: 0,
    active: 0,
    returned: 0,
    overdue: 0,
  });
  const [recommendations, setRecommendations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [availableCategories, setAvailableCategories] = useState(POPULAR_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [customCategory, setCustomCategory] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/auth/me/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          navigate("/login");
          return;
        }
        throw new Error("Failed to load profile");
      }
      
      const data = await res.json();
      setProfile(data);
      setFormData({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
        department: data.profile?.department ?? data.department ?? "",
        year: data.profile?.year || "",
        student_id: data.profile?.student_id || "",
        preferred_categories: data.profile?.preferred_categories || "",
      });
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  const loadBorrowStats = useCallback(async () => {
    try {
      const data = await getMyBorrows(token);
      const stats = {
        total: data.length,
        active: data.filter(b => b.status === "borrowed" || b.status === "approved").length,
        returned: data.filter(b => b.status === "returned").length,
        overdue: data.filter(b => b.status === "overdue").length,
      };
      setBorrowStats(stats);
    } catch (err) {
      console.error("Failed to load borrow stats:", err);
    }
  }, [token]);

  const loadRecommendations = useCallback(() => {
    if (!token) return;
    setRecLoading(true);
    fetchRecommendations(token, 6, 'hybrid')
      .then(data => {
        setRecommendations(data);
        setRecLoading(false);
      })
      .catch(err => {
        console.error("Failed to load recommendations:", err);
        setRecLoading(false);
      });
  }, [token]);

  useEffect(() => {
    getDepartments()
      .then((data) => {
        if (Array.isArray(data)) {
          setDepartments(data);
        }
      })
      .catch((err) => console.error("Failed to load departments:", err));
  }, []);

  useEffect(() => {
    const dept = formData.department || profile?.profile?.department || profile?.department || null;
    getBookCategories(dept)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const merged = Array.from(new Set([...data, ...POPULAR_CATEGORIES]));
          setAvailableCategories(merged);
        }
      })
      .catch((err) => console.error("Failed to load book categories:", err));
  }, [formData.department, profile]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    loadProfile();
    loadBorrowStats();
    loadRecommendations();
  }, [token, navigate, loadProfile, loadBorrowStats, loadRecommendations]);

  // Sync formData with profile data whenever profile changes
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        email: profile.email || "",
        department: profile.profile?.department ?? profile.department ?? "",
        year: profile.profile?.year || "",
        student_id: profile.profile?.student_id || "",
        preferred_categories: profile.profile?.preferred_categories || "",
      });
    }
  }, [profile]);

  const handleReset = useCallback(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        email: profile.email || "",
        department: profile.profile?.department ?? profile.department ?? "",
        year: profile.profile?.year || "",
        student_id: profile.profile?.student_id || "",
        preferred_categories: profile.profile?.preferred_categories || "",
      });
    }
  }, [profile]);

  const toggleCategory = (cat) => {
    const current = (formData.preferred_categories || "")
      .split(/[,;|]/)
      .map((c) => c.trim())
      .filter(Boolean);

    let updated;
    if (current.includes(cat)) {
      updated = current.filter((c) => c !== cat);
    } else {
      updated = [...current, cat];
    }
    setFormData({ ...formData, preferred_categories: updated.join(", ") });
  };

  const handleAddCustomCategory = (e) => {
    if (e) e.preventDefault();
    const trimmed = customCategory.trim();
    if (!trimmed) return;
    const current = (formData.preferred_categories || "")
      .split(/[,;|]/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed];
      setFormData({ ...formData, preferred_categories: updated.join(", ") });
    }
    setCustomCategory("");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess("");
    try {
      setError("");
      const res = await fetch(`${BASE_URL}/auth/me/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          department: formData.department,
          year: formData.year ? parseInt(formData.year) : null,
          student_id: formData.student_id,
          preferred_categories: formData.preferred_categories,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.detail || "Update failed");
      }

      await loadProfile();
      loadRecommendations();
      setEditMode(false);
      setSaveSuccess("Profile updated successfully!");
      setTimeout(() => setSaveSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaveLoading(false);
    }
  };

  /* eslint-disable-next-line no-unused-vars */
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("role");
      navigate("/login");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading account details...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 md:p-10 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error || "Failed to load profile"}
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
        className="max-w-4xl mx-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            👤 My Account Details
          </h2>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {saveSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {saveSuccess}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Missing Department Banner */}
        {profile.role === "student" && !profile.profile?.department && !profile.department && (
          <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-r-xl shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏛</span>
              <div>
                <h4 className="font-bold text-indigo-900">Department Not Selected</h4>
                <p className="text-sm text-indigo-700">
                  Please select your academic department below and click <strong>Save Changes</strong> to send your registration to your department librarian for approval.
                </p>
              </div>
            </div>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-sm self-start sm:self-auto"
              >
                Select Department →
              </button>
            )}
          </div>
        )}

        {/* Approval Status Banner */}
        {profile.role === "student" && (
          (profile.profile?.approval_status === "pending" || profile.approval_status === "pending") ? (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏳</span>
                <div>
                  <h4 className="font-bold text-amber-800">Registration Pending Approval</h4>
                  <p className="text-sm text-amber-700">
                    Your account is currently awaiting approval from the <strong>{profile.profile?.department || profile.department || "department"}</strong> librarian.
                    Full access to search, browse, and borrow books will be unlocked once approved.
                  </p>
                </div>
              </div>
            </div>
          ) : (profile.profile?.approval_status === "rejected" || profile.approval_status === "rejected") ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">❌</span>
                <div>
                  <h4 className="font-bold text-red-800">Registration Rejected</h4>
                  <p className="text-sm text-red-700">
                    Your library registration was rejected. Please contact your department librarian for assistance.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-xl shadow-sm mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">✅</span>
                <span className="text-sm font-semibold text-emerald-800">Approved Library Member · {profile.profile?.department || profile.department}</span>
              </div>
              <span className="text-xs bg-emerald-200 text-emerald-800 font-bold px-2.5 py-1 rounded-full uppercase">Active</span>
            </div>
          )
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-lg p-6 text-center"
          >
            <div className="text-3xl font-bold text-blue-600">{borrowStats.total}</div>
            <div className="text-sm text-gray-600 mt-1">Total Borrows</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-6 text-center"
          >
            <div className="text-3xl font-bold text-green-600">{borrowStats.active}</div>
            <div className="text-sm text-gray-600 mt-1">Active</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-6 text-center"
          >
            <div className="text-3xl font-bold text-gray-600">{borrowStats.returned}</div>
            <div className="text-sm text-gray-600 mt-1">Returned</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6 text-center"
          >
            <div className="text-3xl font-bold text-red-600">{borrowStats.overdue}</div>
            <div className="text-sm text-gray-600 mt-1">Overdue</div>
          </motion.div>
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 mb-6">
          <h3 className="text-2xl font-bold mb-6">Personal Information</h3>
          
          {editMode ? (
            // Loading guard: ensure formData is initialized before rendering form
            Object.keys(formData).length === 0 ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading form data...</p>
              </div>
            ) : (
              <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Student ID</label>
                  <input
                    type="text"
                    value={formData.student_id}
                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Department
                    {profile?.approval_status === "approved" && (formData.department && formData.department !== "Not assigned") && (
                      <span className="text-xs text-emerald-600 font-normal ml-1.5">🔒 (Approved & Locked)</span>
                    )}
                    {(!formData.department || formData.department === "Not assigned" || profile?.approval_status === "pending") && (
                      <span className="text-xs text-indigo-600 font-medium ml-1.5">★ (Required for Librarian Approval)</span>
                    )}
                  </label>
                  {(profile?.is_staff || profile?.is_superuser || profile?.role === "admin" || profile?.role === "librarian" || profile?.approval_status === "pending" || !profile?.profile?.department || !profile?.department || formData.department === "Not assigned" || !formData.department) ? (
                    <div>
                      <select
                        value={formData.department && formData.department !== "Not assigned" ? formData.department : ""}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        required
                        className="w-full p-3 border-2 border-indigo-300 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900 bg-white font-medium shadow-sm"
                      >
                        <option value="">-- Choose Your Academic Department --</option>
                        {departments.map((dept) => {
                          const name = typeof dept === "object" ? dept.name : dept;
                          const key = typeof dept === "object" ? dept.id : dept;
                          return (
                            <option key={key} value={name}>{name}</option>
                          );
                        })}
                      </select>
                      <small className="text-xs text-indigo-600 font-medium mt-1 block">
                        Select your department so your account can be reviewed and approved by your department librarian.
                      </small>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        disabled
                        value={formData.department || "Not assigned"}
                        className="w-full p-3 border-2 border-gray-200 bg-gray-100 text-gray-600 rounded-lg cursor-not-allowed font-medium"
                      />
                      <small className="text-xs text-gray-500 mt-1 block">
                        Assigned by your institution. Contact your department librarian to request a change.
                      </small>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Academic Year</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900"
                />
              </div>

              {/* Preferred Categories / Reading Interests Selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Reading Interests / Preferred Categories <span className="text-xs text-gray-400 font-normal">(Used for personalized book recommendations)</span>
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border-2 border-gray-200 max-h-36 overflow-y-auto">
                  {(() => {
                    const currentSelected = (formData.preferred_categories || "")
                      .split(/[,;|]/)
                      .map((c) => c.trim())
                      .filter(Boolean);
                    const allCats = Array.from(new Set([...availableCategories, ...currentSelected]));
                    return allCats.map((cat) => {
                      const isSelected = currentSelected.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          {isSelected ? `✓ ${cat}` : `+ ${cat}`}
                        </button>
                      );
                    });
                  })()}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomCategory();
                      }
                    }}
                    placeholder="Type custom interest (e.g. Ancient History)..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    disabled={!customCategory.trim()}
                    className="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saveLoading && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {saveLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={() => {
                    handleReset();
                    setEditMode(false);
                  }}
                  className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition-colors font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Username</p>
                <p className="font-semibold text-lg text-gray-900">{profile.username}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-semibold text-lg text-gray-900">{profile.email || "Not provided"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Full Name</p>
                <p className="font-semibold text-lg text-gray-900">
                  {profile.first_name && profile.last_name
                    ? `${profile.first_name} ${profile.last_name}`
                    : profile.first_name || profile.last_name || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Student ID</p>
                <p className="font-semibold text-lg text-gray-900">
                  {profile.profile?.student_id || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Department</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-lg text-gray-900">
                    {profile.profile?.department || profile.department || "Not assigned"}
                  </p>
                  {(!profile.profile?.department && !profile.department) && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
                    >
                      + Choose Department
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Year</p>
                <p className="font-semibold text-lg text-gray-900">
                  {profile.profile?.year || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Role</p>
                <p className="font-semibold text-lg text-gray-900 capitalize">
                  {profile.role || "Student"}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600 mb-2">Reading Interests / Preferred Categories</p>
                {profile.profile?.preferred_categories ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.profile.preferred_categories
                      .split(/[,;|]/)
                      .map((c) => c.trim())
                      .filter(Boolean)
                      .map((cat, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200"
                        >
                          📚 {cat}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No reading interests selected yet. Click &ldquo;Edit Profile&rdquo; to customize your topics for better book recommendations!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recommendations Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold">Recommended for You</h3>
            <a
              href="/recommendations"
              className="text-blue-600 hover:underline text-sm"
            >
              View All Recommendations →
            </a>
          </div>

          {recLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 text-sm">Loading recommendations...</p>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow text-center">
              <p className="text-gray-600 mb-4">
                No recommendations available yet. Start browsing books to get personalized recommendations!
              </p>
              <a
                href="/books"
                className="text-blue-600 hover:underline"
              >
                Browse Books →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {recommendations.map((book, i) => (
                <BookCard
                  key={book.id}
                  book={book}
                  index={i}
                  trackView
                  onClick={setSelectedBook}
                />
              ))}
            </div>
          )}
        </div>

        {/* Book detail modal */}
        {selectedBook && (
          <BookDetail
            book={selectedBook}
            onClose={() => setSelectedBook(null)}
          />
        )}
      </motion.div>
    </div>
  );
}
