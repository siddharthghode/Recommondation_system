import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BASE_URL, authenticatedFetch, login, register, requestOTP, verifyOTP } from "../services/api";
import GoogleAuthButton from "../components/GoogleAuthButton";


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
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [loginRole, setLoginRole] = useState("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

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
      const res = await requestOTP(email.trim());
      setOtpStep(2);
      setCooldown(60);
      setSuccess(res.message || "Verification code sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setOtpLoading(false);
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
      const data = await login(username.trim(), password);

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

      if (loginRole === "librarian" && userRole !== "librarian") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        setError("This account does not have librarian access.");
        return;
      }

      localStorage.setItem("role", userRole);
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
              <div className="space-y-5">
                {/* Step Progress Indicator */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      otpStep > 1 ? 'bg-emerald-500 text-white' : otpStep === 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {otpStep > 1 ? '✓' : '1'}
                    </div>
                    <span className={`text-xs font-semibold ${otpStep === 1 ? 'text-blue-600' : 'text-slate-500'}`}>Email</span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-2 ${otpStep > 1 ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      otpStep > 2 ? 'bg-emerald-500 text-white' : otpStep === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {otpStep > 2 ? '✓' : '2'}
                    </div>
                    <span className={`text-xs font-semibold ${otpStep === 2 ? 'text-blue-600' : 'text-slate-500'}`}>Verify Code</span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-2 ${otpStep > 2 ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  <div className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      otpStep === 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      3
                    </div>
                    <span className={`text-xs font-semibold ${otpStep === 3 ? 'text-blue-600' : 'text-slate-500'}`}>Details</span>
                  </div>
                </div>

                {/* STEP 1: Email Entry & Request OTP */}
                {otpStep === 1 && (
                  <form onSubmit={handleSendOTP} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Student Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value.trim())}
                        placeholder="e.g. student@college.edu"
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                      />
                      <small className="text-gray-500 text-xs mt-1 block">
                        A 6-digit verification code will be sent to this email address.
                      </small>
                    </div>

                    <button
                      disabled={otpLoading || !email.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors duration-200 text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                    >
                      {otpLoading ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : (
                        <>
                          Send Verification Code
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </>
                      )}
                    </button>

                    <div className="my-5 flex items-center gap-3">
                      <div className="h-px bg-slate-200 flex-1" />
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">or sign up with</span>
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

                {/* STEP 2: Enter & Verify OTP */}
                {otpStep === 2 && (
                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between text-xs text-blue-900">
                      <div>
                        Code sent to: <span className="font-semibold text-blue-950">{email}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleChangeEmail}
                        className="text-blue-600 hover:text-blue-800 font-semibold underline ml-2"
                      >
                        Change
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Enter 6-Digit Code</label>
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
                        className="w-full text-center tracking-widest text-xl font-bold py-3 px-4 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                      />
                      <small className="text-gray-500 text-xs mt-1 block text-center">
                        Valid for 10 minutes.
                      </small>
                    </div>

                    <button
                      disabled={otpLoading || otpCode.length !== 6}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors duration-200 text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      type="submit"
                    >
                      {otpLoading ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : (
                        <>
                          Verify Code & Continue
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </>
                      )}
                    </button>

                    <div className="text-center pt-2">
                      {cooldown > 0 ? (
                        <span className="text-xs text-slate-500">
                          Resend code in <span className="font-semibold text-slate-700">{cooldown}s</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          disabled={otpLoading}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                        >
                          Didn't receive code? Resend Code
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {/* STEP 3: Complete Registration Details */}
                {otpStep === 3 && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    {/* Verified Email Banner */}
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 text-xs text-emerald-800">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Verified Email:</span>
                      <span className="font-bold">{email}</span>
                    </div>

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
                      <small className="text-gray-500 text-xs mt-0.5 block">
                        Min 2 characters, unique student identifier.
                      </small>
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
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Department (Required)</label>
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          required
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                        >
                          <option value="">Select Department (Required)</option>
                          {DEPARTMENTS.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Academic Year</label>
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
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password (min 4 characters)"
                          required
                          minLength={4}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
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
                          Complete Registration
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
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

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">or sign in with</span>
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

                <p className="text-center text-slate-400 text-xs mt-4">
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
