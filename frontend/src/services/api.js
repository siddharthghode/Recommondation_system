import { apiClient, BASE_URL } from "../api";

export * from "../api";

/**
 * Backward-compatibility wrapper for legacy authenticatedFetch references.
 * Automatically delegates to apiClient and formats a fetch-like response interface.
 */
export const authenticatedFetch = async (url, options = {}) => {
  const method = (options.method || "GET").toLowerCase();
  let data;
  if (options.body) {
    try {
      data = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    } catch {
      data = options.body;
    }
  }

  const relativeUrl = url.startsWith(BASE_URL) ? url.slice(BASE_URL.length) : url;

  const config = {
    method,
    url: relativeUrl,
    headers: options.headers || {},
    signal: options.signal,
    data,
  };

  try {
    const resData = await apiClient(config);
    return {
      ok: true,
      status: 200,
      json: async () => resData,
      text: async () => JSON.stringify(resData),
      data: resData,
    };
  } catch (err) {
    const errorStatus = err?.response?.status || err?.status || 500;
    const errorData = err?.response?.data || err;
    return {
      ok: false,
      status: errorStatus,
      json: async () => errorData,
      text: async () =>
        typeof errorData === "string" ? errorData : JSON.stringify(errorData),
      data: errorData,
    };
  }
};

export default apiClient;
