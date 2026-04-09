import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BASE_URL, authenticatedFetch, login, register } from "../services/api";

const DEPARTMENTS = [
  "Electronic Science",
  "Instrumentation Science (USIC)",
  "Mathematics",
  "Environmental Science",
  "Department of Technology",
  "Zoology",
  "Biotechnology",
  "Geography",
  "Geology",
  "Physics",
  "Chemistry",
  "Botany",
  "Atmospheric & Space Sciences",
  "Statistics",
  "Computer Science",
  "Media & Communication Studies",
  "Microbiology",
  "School of Health Sciences",
  "School of Energy Studies",
  "Interdisciplinary School of Scientific Computing",
  "Institute of Bioinformatics & Biotechnology (IBB)",
  "Bioinformatics Center",
  "Centre for Modeling & Simulation",
  "School of Basic Medical Sciences (SBMS)",
  "Commerce",
  "Management Science (PUMBA)",
  "Marathi",
  "Hindi",
  "English",
  "Sanskrit & Prakrit Languages",
  "Pali & Buddhist Studies",
  "Dr. Babasaheb Ambedkar Studies",
  "Foreign Languages",
  "Centre for Advanced Study in Sanskrit",
  "Economics",
  "History",
  "Philosophy",
  "Anthropology",
  "Psychology",
  "Political Science",
  "Sociology",
  "Defence & Strategic Studies",
  "Interdisciplinary School (Humanities & Social Sciences)",
  "Women's Studies Centre",
  "Lifelong Learning & Extension",
  "Buddhist Studies & Dr. Ambedkar Thoughts",
  "Law",
  "National Centre of International Security & Defence Analysis (NISDA)",
  "Centre for Social Science & Humanities (CSSH)",
  "Education & Extension",
  "Physical Education",
  "Centre for Performing Arts",
  "Library & Information Science",
  "Communication & Journalism",
  "Skill Development Center (SDC)",
];

const YEARS = [1, 2, 3, 4];

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [role, setRole] = useState("student");
  const [loginRole, setLoginRole] = useState("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const ROLE_DESTINATIONS = { admin: "/admin", librarian: "/librarian", student: "/account" };

  const handleLogin = async e => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);
    try {
      // Step 1: obtain tokens — role is embedded in the login response
      const data = await login(username.trim(), password);

      if (!data.access || !data.refresh) {
        throw new Error("Invalid response from server");
      }

      localStorage.setItem("token", data.access);
      localStorage.setItem("refreshToken", data.refresh);

      // Step 2: resolve role — prefer the login response field (avoids extra round-trip)
      // Fall back to /auth/me/ only if the login endpoint didn't return role
      let userRole = data.role || null;

      if (!userRole) {
        const res = await authenticatedFetch(`${BASE_URL}/auth/me/`, {
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error || "Failed to fetch user profile");
        }
        const profile = await res.json();
        userRole = profile.is_superuser || profile.is_staff ? "admin" : (profile.role || "student");
      }

      // Step 3: validate the radio-button role selection against the real role
      // Only enforce the librarian check — students and admins can log in freely
      if (loginRole === "librarian" && userRole !== "librarian") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setError("This account does not have librarian access.");
        return;
      }

      localStorage.setItem("role", userRole);
      setSuccess("Login successful! Redirecting...");
      navigate(ROLE_DESTINATIONS[userRole] ?? "/account", { replace: true });
    } catch (err) {
      const errorMsg =
        err.message || err.detail || err.error || err.non_field_errors?.[0] ||
        "Login failed. Please check your credentials.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async e => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Simplified validation rules
    if (!studentId || studentId.trim() === "") {
      setError("Student ID is required");
      return;
    }

    if (studentId.length < 2) {
      setError("Student ID must be at least 2 characters");
      return;
    }
    
    // Department and year are now optional

    if (!firstName || firstName.trim() === "") {
      setError("First name is required");
      return;
    }

    if (!lastName || lastName.trim() === "") {
      setError("Last name is required");
      return;
    }

    if (!email || email.trim() === "") {
      setError("Email is required");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setLoading(true);
    try {
      // Prepare user data - department and year are optional
        const userData = {
          role: 'student',
          password,
          password_confirm: passwordConfirm,
          email: email.trim().toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        };
        // username depends on role
        if (role === 'student') {
          userData.username = studentId.trim();
          userData.student_id = studentId.trim();
        } else {
          userData.username = regUsername.trim();
        }
      
      // Only add department and year if provided
      if (department && department !== "") {
        userData.department = department;
      }
      if (year && year !== "") {
        userData.year = parseInt(year, 10);
      }

      console.log("Registering with data:", { ...userData, password: "***", password_confirm: "***" });
      const data = await register(userData);
      const access = data.access;
      const refresh = data.refresh;
      localStorage.setItem("token", access);
      localStorage.setItem("refreshToken", refresh);

      // fetch user profile to determine role
      const res = await authenticatedFetch(`${BASE_URL}/auth/me/`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          throw await res.json();
        } else {
          const text = await res.text();
          throw new Error(`Failed to fetch profile: ${res.status} ${res.statusText}`);
        }
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format from server");
      }
      
      const profile = await res.json();
      
      // Determine role from profile
      let userRole = "student";
      if (profile.is_superuser) {
        userRole = "admin";
      } else if (profile.role) {
        userRole = profile.role;
      } else if (profile.profile?.role) {
        userRole = profile.profile.role;
      } else if (profile.is_staff) {
        userRole = "admin";
      }
      
      localStorage.setItem("role", userRole);
      setSuccess("Registration successful! Redirecting...");
      
      setTimeout(() => {
        if (userRole === "admin") {
          navigate("/admin");
        } else if (userRole === "librarian") {
          navigate("/librarian");
        } else {
          navigate("/account");
        }
      }, 1500);
    } catch (err) {
      console.error("Registration error:", err);
      let errorMsg = "Registration failed";
      
      // Check if error is a string (from non-JSON response)
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err instanceof Error) {
        // Handle Error objects
        errorMsg = err.message || "Registration failed";
        
        // Check if it's a field-specific error object
        if (err.data) {
          const errorFields = ['student_id', 'username', 'password', 'password_confirm', 
                              'department', 'year', 'email', 'first_name', 'last_name', 'user_type'];
          
          for (const field of errorFields) {
            if (err.data[field]) {
              errorMsg = Array.isArray(err.data[field]) ? err.data[field][0] : err.data[field];
              break;
            }
          }
        }
      } else {
        // Handle field-specific errors (object with field names)
        const errorFields = ['student_id', 'username', 'password', 'password_confirm', 
                            'department', 'year', 'email', 'first_name', 'last_name', 'user_type'];
        
        for (const field of errorFields) {
          if (err[field]) {
            errorMsg = Array.isArray(err[field]) ? err[field][0] : err[field];
            break;
          }
        }
        
        // Handle general errors
        if (errorMsg === "Registration failed") {
          if (err.non_field_errors) {
            errorMsg = Array.isArray(err.non_field_errors) ? err.non_field_errors[0] : err.non_field_errors;
          } else if (err.error) {
            errorMsg = err.error;
          } else if (err.detail) {
            errorMsg = err.detail;
          } else if (err.message) {
            errorMsg = err.message;
          }
        }
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4 py-20">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Top accent */}
          <div className="h-2 bg-gradient-to-r from-blue-600 to-cyan-400" />

          <div className="p-8">
            {/* Tab header */}
            <div className="flex gap-4 mb-6 border-b pb-4">
              <button
                onClick={() => { setIsRegister(false); setError(""); setSuccess(""); }}
                className={`pb-2 px-2 font-semibold flex-1 text-center ${
                  !isRegister
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => { setIsRegister(true); setError(""); setSuccess(""); }}
                className={`pb-2 px-2 font-semibold flex-1 text-center ${
                  isRegister
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500"
                }`}
              >
                Register
              </button>
            </div>

            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-1">
                {isRegister ? "Student Registration" : "Student Login"}
              </h1>
              <p className="text-slate-500 text-sm">Access the Department Library System</p>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </motion.div>
            )}

            {/* Success */}
            {success && (
              <div className="mb-5 p-4 bg-green-50 text-green-700 text-sm rounded-xl border border-green-100">
                {success}
              </div>
            )}

            {isRegister ? (
              <form onSubmit={handleRegister} className="space-y-5">
                {/* Registration only allows student sign-ups; librarians must be created via admin panel */}
                {role === "student" ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Student ID</label>
                    <input
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="Student ID (will be used as username)"
                      required
                      minLength={2}
                      maxLength={50}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                    <small className="text-gray-500 text-xs -mt-1 block">
                      Min 2 characters and must be unique.
                    </small>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username</label>
                    <input
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="Username (for librarian)"
                      required
                      minLength={2}
                      maxLength={50}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    placeholder="Email"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Name</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value.trim())}
                      placeholder="First Name"
                      required
                      maxLength={150}
                      pattern="[A-Za-z\s]+"
                      title="First name must contain only letters and spaces"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last Name</label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value.trim())}
                      placeholder="Last Name"
                      required
                      maxLength={150}
                      pattern="[A-Za-z\s]+"
                      title="Last name must contain only letters and spaces"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select Department (Optional)</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>

                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                  >
                    <option value="">Select Year (Optional)</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>Year {y}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 4 characters)"
                    required
                    minLength={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                  />
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Confirm Password"
                    required
                    minLength={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                  />
                </div>

                <button
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors duration-200 text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                >
                  {loading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <>
                      Register
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input type="radio" checked={loginRole === "student"} onChange={() => setLoginRole("student")} />
                      Student
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input type="radio" checked={loginRole === "librarian"} onChange={() => setLoginRole("librarian")} />
                      Librarian
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Username or Student ID</label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your Student ID / Username"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Password</label>
                    <button type="button" className="text-xs text-blue-600 hover:underline">Forgot password?</button>
                  </div>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors duration-200 text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                >
                  {loading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <>
                      Login
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>

                <p className="text-center text-slate-400 text-xs mt-2">
                  Department Library System · Secure Student Portal
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
