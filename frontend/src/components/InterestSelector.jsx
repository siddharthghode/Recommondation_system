import { useState, useEffect } from "react";
import { BASE_URL } from "../services/api";

export default function InterestSelector({ onSave, onCancel }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const categorySet = new Set();
      
      // Fetch first few pages to get categories
      for (let page = 1; page <= 3; page++) {
        try {
          const response = await fetch(`${BASE_URL}/books/?page=${page}&page_size=40`);
          const data = await response.json();
          const books = data.results || (Array.isArray(data) ? data : []);
          
          books.forEach((book) => {
            const cats = (book.categories || "")
              .toString()
              .split(/[,;|]/)
              .map((s) => s.trim())
              .filter(Boolean);
            
            cats.forEach((c) => {
              categorySet.add(c);
            });
          });
          
          if (books.length < 40) break;
        } catch (err) {
          console.error(`Failed to load page ${page}:`, err);
        }
      }
      
      setCategories(Array.from(categorySet).sort());
    } catch (err) {
      console.error("Failed to load categories:", err);
      setError("Failed to load categories. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCategory = (category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleSave = async () => {
    if (selectedCategories.length === 0) {
      setError("Please select at least one category");
      return;
    }

    try {
      setSaving(true);
      setError("");
      
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You must be logged in to save preferences");
        return;
      }

      // Save as comma-separated string
      const categoriesString = selectedCategories.join(",");
      
      const response = await fetch(`${BASE_URL}/auth/me/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          preferred_categories: categoriesString
        })
      });

      if (!response.ok) {
        // Try to parse JSON error, but fall back to text to avoid "Unexpected token '<'" errors
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || errorData.detail || "Failed to save preferences");
        } else {
          const text = await response.text();
          // Provide first 300 chars of server response for debugging
          throw new Error(`Server error ${response.status}: ${text.slice(0,300)}`);
        }
      }

      // Call onSave callback to refresh recommendations
      if (onSave) {
        onSave();
      }
    } catch (err) {
      setError(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading categories...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Select Your Interests</h2>
        <p className="text-gray-600 mb-6">
          Help us personalize your book recommendations by selecting categories you're interested in.
        </p>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2">
            {categories.map((category) => (
              <label
                key={category}
                className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-blue-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => handleToggleCategory(category)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">{category}</span>
              </label>
            ))}
          </div>
          {selectedCategories.length > 0 && (
            <p className="mt-4 text-sm text-gray-600">
              {selectedCategories.length} categor{selectedCategories.length === 1 ? 'y' : 'ies'} selected
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || selectedCategories.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
