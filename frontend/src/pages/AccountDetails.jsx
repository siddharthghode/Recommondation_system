import { useEffect, useState, useCallback } from "react";
/* eslint-disable-next-line no-unused-vars */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BASE_URL, getMyBorrows, fetchRecommendations } from "../services/api";
import BookCard from "../components/BookCard";
import BookDetail from "../components/BookDetail";

const DEPARTMENTS = [
  "Electronic Science","Instrumentation Science (USIC)","Mathematics",
  "Environmental Science","Department of Technology","Zoology","Biotechnology",
  "Geography","Geology","Physics","Chemistry","Botany",
  "Atmospheric & Space Sciences","Statistics","Computer Science",
  "Media & Communication Studies","Microbiology","School of Health Sciences",
  "School of Energy Studies","Interdisciplinary School of Scientific Computing",
  "Institute of Bioinformatics & Biotechnology (IBB)","Bioinformatics Center",
  "Centre for Modeling & Simulation","School of Basic Medical Sciences (SBMS)",
  "Commerce","Management Science (PUMBA)","Marathi","Hindi","English",
  "Sanskrit & Prakrit Languages","Pali & Buddhist Studies",
  "Dr. Babasaheb Ambedkar Studies","Foreign Languages",
  "Centre for Advanced Study in Sanskrit","Economics","History","Philosophy",
  "Anthropology","Psychology","Political Science","Sociology",
  "Defence & Strategic Studies",
  "Interdisciplinary School (Humanities & Social Sciences)",
  "Women's Studies Centre","Lifelong Learning & Extension",
  "Buddhist Studies & Dr. Ambedkar Thoughts","Law",
  "National Centre of International Security & Defence Analysis (NISDA)",
  "Centre for Social Science & Humanities (CSSH)","Education & Extension",
  "Physical Education","Centre for Performing Arts",
  "Library & Information Science","Communication & Journalism",
  "Skill Development Center (SDC)",
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
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
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
      });
    }
  }, [profile]);

  const handleReset = useCallback(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        email: profile.email || "",
        department: profile.profile?.department || "",
        year: profile.profile?.year || "",
        student_id: profile.profile?.student_id || "",
      });
    }
  }, [profile]);

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
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.detail || "Update failed");
      }

      await loadProfile();
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Department</label>
                  <select
                    value={formData.department || ""}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900 bg-white"
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900"
                />
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
                <p className="font-semibold text-lg text-gray-900">
                  {profile.profile?.department || "Not specified"}
                </p>
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
