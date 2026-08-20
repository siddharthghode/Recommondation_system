import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BASE_URL, authenticatedFetch, login, register, requestOTP, verifyOTP, getDepartments, resetPassword } from "../services/api";
import GoogleAuthButton from "../components/GoogleAuthButton";

const YEARS = [1, 2, 3, 4];
const POPULAR_CATEGORIES = [
  "Computer Science",
  "Artificial Intelligence",
  "Data Science",
  "Algorithms",
  "Web Development",
  "Database",
  "Mathematics",
  "Physics",
  "Engineering",
  "Machine Learning",
  "Software Engineering",
  "Literature",
];

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);
  const [year, setYear] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loginRole, setLoginRole] = useState("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch departments from DB
  useEffect(() => {
    getDepartments()
      .then((data) => {
        if (Array.isArray(data)) {
          setDepartments(data);
        }
      })
      .catch((err) => console.error("Failed to load departments:", err));
  }, []);

  // OTP Verification States
  const [otpStep, setOtpStep] = useState(1); // 1: Email entry, 2: OTP verify, 3: Full form
  const [otpCode, setOtpCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);

  const navigate = useNavigate();

  const ROLE_DESTINATIONS = { admin: "/admin", librarian: "/librarian", student: "/books" };

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleGoogleSuccess = (data) => {
    localStorage.setItem("token", data.access);
    localStorage.setItem("refreshToken", data.refresh);
    const userRole = data.role || "student";
    localStorage.setItem("role", userRole);
    setSuccess("Google Authentication successful! Redirecting...");
    setTimeout(() => {
      navigate(ROLE_DESTINATIONS[userRole] ?? "/books", { replace: true });
    }, 1000);
  };

  const handleGoogleError = (errMsg) => {
    setError(errMsg);
  };

  const toggleCategory = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");

    if (!email || email.trim() === "") {
      setError("Please enter your email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setOtpLoading(true);
    try {
      const res = await requestOTP(email.trim(), isForgotPassword ? "reset" : "register");
      setOtpStep(2);
      setCooldown(60);
      setSuccess(res.message || "Verification code sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");

    if (!verificationToken) {
      setError("Please verify the email verification code first.");
      setOtpStep(1);
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword({
        email: email.trim().toLowerCase(),
        verification_token: verificationToken,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      });

      setSuccess(res.message || "Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        setIsForgotPassword(false);
        setIsRegister(false);
        setOtpStep(1);
        setOtpCode("");
        setVerificationToken("");
        setNewPassword("");
        setNewPasswordConfirm("");
        setSuccess("Password reset successfully. Please log in with your new password.");
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");

    if (!otpCode || otpCode.trim().length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setOtpLoading(true);
    try {
      const res = await verifyOTP(email.trim(), otpCode.trim());
      setVerificationToken(res.verification_token);
      setOtpStep(3);
      setSuccess("Email verified successfully! Please complete your registration details.");
    } catch (err) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0 || otpLoading) return;
    setError("");
    setSuccess("");
    setOtpLoading(true);
    try {
      const res = await requestOTP(email.trim());
      setCooldown(60);
      setSuccess(res.message || "New verification code sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to resend verification code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setOtpStep(1);
    setOtpCode("");
    setVerificationToken("");
    setError("");
    setSuccess("");
  };

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
      const data = await login(username.trim(), password, loginRole);

      if (!data.access || !data.refresh) {
        throw new Error("Invalid response from server");
      }

      localStorage.setItem("token", data.access);
      localStorage.setItem("refreshToken", data.refresh);

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

      // Enforce strict separation between Student and Librarian portals
      if (loginRole === "student" && userRole === "librarian") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("role");
        setError("This is a Librarian account. Please click the 'Librarian Login' button above.");
        return;
      }

      if (loginRole === "librarian" && userRole === "student") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("role");
        localStorage.removeItem("approval_status");
        setError("This is a Student account. Please click the 'Student Login' button above.");
        return;
      }

      localStorage.setItem("role", userRole);
      if (data.approval_status) {
        localStorage.setItem("approval_status", data.approval_status);
      }
      setSuccess("Login successful! Redirecting...");
      navigate(ROLE_DESTINATIONS[userRole] ?? "/Books", { replace: true });
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

    if (!verificationToken) {
      setError("Please verify your email address before completing registration.");
      setOtpStep(1);
      return;
    }

    if (!studentId || studentId.trim() === "") {
      setError("Student ID is required");
      return;
    }

    if (studentId.length < 2) {
      setError("Student ID must be at least 2 characters");
      return;
    }
    
    if (!department || department.trim() === "") {
      setError("Please select your department");
      return;
    }

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
        const userData = {
          role: 'student',
          password,
          password_confirm: passwordConfirm,
          email: email.trim().toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          department: department.trim(),
          verification_token: verificationToken,
        };
        userData.username = studentId.trim();
        userData.student_id = studentId.trim();
      
        if (year && year !== "") {
          userData.year = parseInt(year, 10);
        }

        if (selectedCategories.length > 0) {
          userData.preferred_categories = selectedCategories.join(", ");
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
          await res.text();
          throw new Error(`Failed to fetch profile: ${res.status} ${res.statusText}`);
        }
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format from server");
      }
      
      const profile = await res.json();
      
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
      
      const approvalStatus = data.approval_status || profile.profile?.approval_status || profile.approval_status || "approved";
      localStorage.setItem("role", userRole);
      localStorage.setItem("approval_status", approvalStatus);

      if (approvalStatus === "pending") {
        setSuccess("Registration submitted! Your account is pending approval from your department librarian.");
      } else {
        setSuccess("Registration successful! Redirecting...");
      }
      
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
      
      if (typeof err === 'string') {
        errorMsg = err;
      } else if (err instanceof Error) {
        errorMsg = err.message || "Registration failed";
        if (err.data) {
          const errorFields = ['student_id', 'username', 'password', 'password_confirm', 
                              'department', 'year', 'email', 'first_name', 'last_name', 'verification_token'];
          
          for (const field of errorFields) {
            if (err.data[field]) {
              errorMsg = Array.isArray(err.data[field]) ? err.data[field][0] : err.data[field];
              break;
            }
          }
        }
      } else {
        const errorFields = ['student_id', 'username', 'password', 'password_confirm', 
                            'department', 'year', 'email', 'first_name', 'last_name', 'verification_token'];
        
        for (const field of errorFields) {
          if (err[field]) {
            errorMsg = Array.isArray(err[field]) ? err[field][0] : err[field];
            break;
          }
        }
        
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
    <div className="min-h-screen bg-slate-950 bg-gradient-to-br from-slate-950 via-[#0B1528] to-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans antialiased text-slate-800">
      {/* Dual Column Layout Container */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-800/60 grid grid-cols-1 lg:grid-cols-12"
      >
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Premium University Library Branding & Value Proposition     */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 via-[#0D1A30] to-slate-950 text-white p-8 sm:p-10 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-slate-800/80">
          {/* Subtle decorative background watermark */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Branding Section */}
          <div className="relative z-10">
            {/* Library Crest Badge */}
            <div className="flex items-center gap-3.5 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-950/50 border border-blue-400/30">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6 text-amber-300"
                >
                  <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c1.05 0 2.039.206 2.946.577a.75.75 0 001.054-.693V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase block">
                  Academic Portal
                </span>
                <h2 className="text-lg font-extrabold tracking-tight text-white leading-tight">
                  Department Library
                </h2>
              </div>
            </div>

            {/* Headline & Description */}
            <div className="space-y-3 mb-10">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                Your University’s <br />
                <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
                  Digital Library Hub
                </span>
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Discover academic resources, track physical books in your department, and unlock AI-powered recommendations tailored to your studies.
              </p>
            </div>

            {/* Value Highlights List */}
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 text-sm mt-0.5">
                  📚
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Curated Department Catalogs</h4>
                  <p className="text-xs text-slate-400 leading-normal">
                    Direct access to specialized textbooks, reference books, and faculty publications.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 text-sm mt-0.5">
                  ✨
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Personalized AI Recommender</h4>
                  <p className="text-xs text-slate-400 leading-normal">
                    Smart recommendations tailored to your reading interests and academic syllabus.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 text-indigo-400 text-sm mt-0.5">
                  ⚡
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">Instant Borrow Requests</h4>
                  <p className="text-xs text-slate-400 leading-normal">
                    Reserve books online with instant librarian verification and return reminders.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Academic Assurance Tagline */}
          <div className="relative z-10 pt-8 mt-8 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Secure Institutional Access
            </span>
            <span className="text-slate-600">v2.0 Library Hub</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Authentication Card (Login / Register / Password Reset)     */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
          <div>
            {/* Top Navigation & Status Bar */}
            <div className="flex items-center justify-between gap-3 mb-6">
              {/* Compact Signing-in-as Selector (Login Mode Only) */}
              {!isRegister && !isForgotPassword ? (
                <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs">
                  <span className="text-slate-400 font-semibold px-2 hidden sm:inline">Signing in as:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole("student");
                      setError("");
                      setSuccess("");
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                      loginRole === "student"
                        ? "bg-white text-blue-700 shadow-sm border border-slate-200/60"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>🎓</span>
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginRole("librarian");
                      setError("");
                      setSuccess("");
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                      loginRole === "librarian"
                        ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>📚</span>
                    <span>Librarian</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setIsForgotPassword(false);
                    setError("");
                    setSuccess("");
                    setOtpStep(1);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Sign In
                </button>
              )}

              {/* Mode Switch Button (Top Right) */}
              {!isForgotPassword && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError("");
                    setSuccess("");
                    setOtpStep(1);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {isRegister ? "Existing Account? Sign in" : "New student? Register"}
                </button>
              )}
            </div>

            {/* Header Title Section */}
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {isForgotPassword
                  ? "Reset your password"
                  : isRegister
                  ? "Create library account"
                  : loginRole === "librarian"
                  ? "Librarian Portal"
                  : "Student Portal"}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {isForgotPassword
                  ? "Enter your verified university email to receive a recovery code"
                  : isRegister
                  ? "Verify your student email to access department library resources"
                  : loginRole === "librarian"
                  ? "Sign in with your staff credentials to manage catalogs & circulation"
                  : "Sign in with your Student ID or username to continue"}
              </p>
            </div>

            {/* Notification Feedback Banners */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-5 p-3.5 bg-rose-50 text-rose-700 text-xs sm:text-sm rounded-xl border border-rose-200 flex items-start gap-2.5"
                >
                  <svg className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="leading-snug">{error}</span>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-5 p-3.5 bg-emerald-50 text-emerald-800 text-xs sm:text-sm rounded-xl border border-emerald-200 flex items-start gap-2.5"
                >
                  <svg className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="leading-snug">{success}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ========================================================================= */}
            {/* VIEW A: FORGOT PASSWORD FLOW                                              */}
            {/* ========================================================================= */}
            {isForgotPassword ? (
              <div className="space-y-5">
                {/* Step Progress Bar */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        otpStep > 1 ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                      }`}
                    >
                      {otpStep > 1 ? "✓" : "1"}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">Email</span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-3 ${otpStep > 1 ? "bg-emerald-500" : "bg-slate-200"}`} />
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        otpStep > 2
                          ? "bg-emerald-600 text-white"
                          : otpStep === 2
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {otpStep > 2 ? "✓" : "2"}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">Verify</span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-3 ${otpStep > 2 ? "bg-emerald-500" : "bg-slate-200"}`} />
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        otpStep === 3 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      3
                    </span>
                    <span className="text-xs font-semibold text-slate-700">New Password</span>
                  </div>
                </div>

                {/* Step 1: Email */}
                {otpStep === 1 && (
                  <form onSubmit={handleSendOTP} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        University Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value.trim())}
                        placeholder="e.g. student@college.edu"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                      />
                    </div>
                    <button
                      disabled={otpLoading || !email.trim()}
                      className="w-full bg-slate-900 hover:bg-blue-900 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 disabled:opacity-50"
                      type="submit"
                    >
                      {otpLoading ? "Sending Recovery Code..." : "Send Verification Code"}
                    </button>
                  </form>
                )}

                {/* Step 2: Code Verification */}
                {otpStep === 2 && (
                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-700">
                      <span>Code sent to: <strong>{email}</strong></span>
                      <button
                        type="button"
                        onClick={handleChangeEmail}
                        className="text-blue-600 font-semibold hover:underline"
                      >
                        Change
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Enter 6-Digit Code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        required
                        autoFocus
                        className="w-full text-center tracking-widest text-2xl font-mono font-bold py-3 px-4 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                      />
                    </div>
                    <button
                      disabled={otpLoading || otpCode.length !== 6}
                      className="w-full bg-slate-900 hover:bg-blue-900 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      type="submit"
                    >
                      {otpLoading ? "Verifying..." : "Verify Code & Continue"}
                    </button>
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={cooldown > 0 || otpLoading}
                        className="text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50"
                      >
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Verification Code"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Step 3: Password Update */}
                {otpStep === 3 && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 4 characters"
                        required
                        minLength={4}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        required
                        minLength={4}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                      />
                    </div>
                    <button
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      type="submit"
                    >
                      {loading ? "Updating..." : "Save New Password"}
                    </button>
                  </form>
                )}
              </div>
            ) : isRegister ? (
              /* ========================================================================= */
              /* VIEW B: 3-STEP STUDENT REGISTRATION ONBOARDING                            */
              /* ========================================================================= */
              <div className="space-y-5">
                {/* Step Indicator */}
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        otpStep > 1 ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                      }`}
                    >
                      {otpStep > 1 ? "✓" : "1"}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">Email</span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-3 ${otpStep > 1 ? "bg-emerald-500" : "bg-slate-200"}`} />
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        otpStep > 2
                          ? "bg-emerald-600 text-white"
                          : otpStep === 2
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {otpStep > 2 ? "✓" : "2"}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">Verify</span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-3 ${otpStep > 2 ? "bg-emerald-500" : "bg-slate-200"}`} />
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        otpStep === 3 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      3
                    </span>
                    <span className="text-xs font-semibold text-slate-700">Profile</span>
                  </div>
                </div>

                {/* Step 1: Institutional Email */}
                {otpStep === 1 && (
                  <form onSubmit={handleSendOTP} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        University Student Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value.trim())}
                        placeholder="e.g. student@university.edu"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                      />
                      <small className="text-slate-400 text-xs mt-1 block">
                        A secure 6-digit verification code will be dispatched to this address.
                      </small>
                    </div>

                    <button
                      disabled={otpLoading || !email.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50"
                      type="submit"
                    >
                      {otpLoading ? "Sending Code..." : "Send Verification Code"}
                    </button>

                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px bg-slate-200 flex-1" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        or register with
                      </span>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    <GoogleAuthButton
                      isRegister={true}
                      extraData={{
                        department: department || undefined,
                        year: year || undefined,
                        role: "student",
                      }}
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      disabled={loading || otpLoading}
                    />
                  </form>
                )}

                {/* Step 2: Verification Code */}
                {otpStep === 2 && (
                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs text-blue-900">
                      <span>Code sent to: <strong>{email}</strong></span>
                      <button
                        type="button"
                        onClick={handleChangeEmail}
                        className="text-blue-600 font-semibold hover:underline"
                      >
                        Change
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Enter 6-Digit Code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="123456"
                        required
                        autoFocus
                        className="w-full text-center tracking-widest text-2xl font-mono font-bold py-3 px-4 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                      />
                    </div>

                    <button
                      disabled={otpLoading || otpCode.length !== 6}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      type="submit"
                    >
                      {otpLoading ? "Verifying..." : "Verify Code & Proceed"}
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={cooldown > 0 || otpLoading}
                        className="text-xs text-slate-500 hover:text-blue-600 disabled:opacity-50 font-medium"
                      >
                        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Verification Code"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Step 3: Full Profile Details & Interests */}
                {otpStep === 3 && (
                  <form onSubmit={handleRegister} className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Student ID / Roll Number *
                      </label>
                      <input
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value.trim())}
                        placeholder="e.g. CS2026-089"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          First Name *
                        </label>
                        <input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value.trim())}
                          placeholder="First Name"
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Last Name *
                        </label>
                        <input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value.trim())}
                          placeholder="Last Name"
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Department *
                        </label>
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                        >
                          <option value="">Select Department</option>
                          {departments.map((dept) => {
                            const name = typeof dept === "object" ? dept.name : dept;
                            const key = typeof dept === "object" ? dept.id : dept;
                            return (
                              <option key={key} value={name}>
                                {name}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Academic Year
                        </label>
                        <select
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                        >
                          <option value="">Year (Optional)</option>
                          {YEARS.map((y) => (
                            <option key={y} value={y}>
                              Year {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Reading Interests Pills */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                          Reading Interests
                        </label>
                        <span className="text-[11px] text-amber-600 font-semibold">Personalizes AI Recommendations</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 max-h-32 overflow-y-auto">
                        {POPULAR_CATEGORIES.map((cat) => {
                          const isSelected = selectedCategories.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => toggleCategory(cat)}
                              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                                isSelected
                                  ? "bg-blue-600 text-white shadow-sm font-semibold"
                                  : "bg-white text-slate-700 border border-slate-200 hover:border-blue-300"
                              }`}
                            >
                              {isSelected ? `✓ ${cat}` : `+ ${cat}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min. 4 chars"
                          required
                          minLength={4}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Confirm Password *
                        </label>
                        <input
                          type="password"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          placeholder="Re-enter password"
                          required
                          minLength={4}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-50 mt-2"
                      type="submit"
                    >
                      {loading ? "Creating Account..." : "Complete Registration"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* ========================================================================= */
              /* VIEW C: STANDARD LOGIN FORM                                               */
              /* ========================================================================= */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    {loginRole === "librarian" ? "Librarian Username" : "Student ID or Username"}
                  </label>
                  <div className="relative">
                    <svg
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={
                        loginRole === "librarian"
                          ? "Enter your Librarian username"
                          : "Enter your Student ID / Username"
                      }
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all font-medium"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setIsRegister(false);
                        setError("");
                        setSuccess("");
                        setOtpStep(1);
                        setOtpCode("");
                        setVerificationToken("");
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <svg
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 transition-all"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  className={`w-full text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50 ${
                    loginRole === "librarian"
                      ? "bg-slate-900 hover:bg-indigo-950 shadow-slate-900/10"
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                  }`}
                  type="submit"
                >
                  {loading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <>
                      <span>{loginRole === "librarian" ? "Sign In to Librarian Portal" : "Sign In to Student Portal"}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>

                <div className="my-4 flex items-center gap-3">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    or continue with
                  </span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                <GoogleAuthButton
                  isRegister={false}
                  extraData={{
                    role: loginRole,
                  }}
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  disabled={loading}
                />
              </form>
            )}
          </div>

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Need assistance? Contact your department library administrator.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
