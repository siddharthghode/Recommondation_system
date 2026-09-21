import apiClient from "./axios";

export const login = async (username, password, role) => {
  const payload = { username, password };
  if (role) payload.role = role;
  const data = await apiClient.post("/auth/login/", payload);
  if (data?.access) localStorage.setItem("token", data.access);
  if (data?.refresh) localStorage.setItem("refresh_token", data.refresh);
  return data;
};

export const register = (userData) => apiClient.post("/auth/register/", userData);

export const googleLogin = async (payload) => {
  const body = typeof payload === "string" ? { credential: payload } : payload;
  const data = await apiClient.post("/auth/google/", body);
  if (data?.access) localStorage.setItem("token", data.access);
  if (data?.refresh) localStorage.setItem("refresh_token", data.refresh);
  return data;
};

export const requestOTP = (email, purpose = "register") =>
  apiClient.post("/auth/otp/request/", { email, purpose });

export const verifyOTP = (email, otp) =>
  apiClient.post("/auth/otp/verify/", { email, otp });

export const getOTPStatus = (email) =>
  apiClient.get(`/auth/otp/status/?email=${encodeURIComponent(email)}`);

export const resetPassword = (resetData) =>
  apiClient.post("/auth/password-reset/", resetData);

export const refreshToken = async () => {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) throw new Error("No refresh token available");
  const data = await apiClient.post("/auth/refresh/", { refresh });
  if (data?.access) localStorage.setItem("token", data.access);
  return data;
};

export const getDepartments = () => apiClient.get("/auth/departments/");
