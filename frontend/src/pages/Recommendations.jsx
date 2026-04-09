import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRecommendations } from "../services/api";
import BookCard from "../components/BookCard";
import BookDetail from "../components/BookDetail";

export default function Recommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [method, setMethod] = useState("hybrid");
  const [n, setN] = useState(10);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const [selectedBook, setSelectedBook] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    loadRecommendations();
  }, [token, method, n, navigate]);

  const loadRecommendations = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchRecommendations(token, n, method);
      setRecommendations(data);
    } catch (err) {
      setError(err.detail || err.message || "Failed to load recommendations");
      console.error("Error loading recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return null;
  }

  return (
    <div className="p-10 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-black">Recommended Books for You</h2>
        <p className="text-gray-600 mb-6">
          Discover books tailored to your interests and reading history
        </p>

        {/* Controls */}
        <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="method" className="text-sm font-medium text-gray-700">
              Recommendation Method:
            </label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="px-3 py-2 border rounded bg-white text-gray-700"
            >
              <option value="hybrid">Hybrid (Recommended)</option>
              <option value="collaborative">Collaborative Filtering</option>
              <option value="content">Content-Based</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="count" className="text-sm font-medium text-gray-700">
              Number of Recommendations:
            </label>
            <select
              id="count"
              value={n}
              onChange={(e) => setN(parseInt(e.target.value))}
              className="px-3 py-2 border rounded bg-white text-gray-700"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
            </select>
          </div>

          <button
            onClick={loadRecommendations}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading recommendations...</p>
          </div>
        )}

        {/* Recommendations Grid */}
        {!loading && !error && (
          <>
            {recommendations.length === 0 ? (
              <div className="bg-white p-8 rounded-lg shadow text-center">
                <p className="text-gray-600 mb-4">
                  No recommendations available yet. Start browsing and interacting with books to get personalized recommendations!
                </p>
                <a
                  href="/books"
                  className="text-blue-600 hover:underline"
                >
                  Browse Books →
                </a>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Showing {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
              </>
            )}
          </>
        )}

        {/* Book detail modal */}
        {selectedBook && (
          <BookDetail book={selectedBook} onClose={() => setSelectedBook(null)} />
        )}

        {/* Info Box */}
        {!loading && recommendations.length > 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">💡 How Recommendations Work</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Hybrid:</strong> Combines collaborative filtering and content-based recommendations</li>
              <li>• <strong>Collaborative:</strong> Based on what similar users liked</li>
              <li>• <strong>Content-Based:</strong> Based on books similar to ones you've interacted with</li>
              <li>• The more you browse, like, and rate books, the better your recommendations become!</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
