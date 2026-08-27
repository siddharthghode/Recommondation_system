import { useEffect, useRef, useState, useCallback } from "react";
import { googleLogin } from "../services/api";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "375016986672-gm5u85d21g1tlb7vbdv1uvms356surcs.apps.googleusercontent.com";

export default function GoogleAuthButton({
  onSuccess,
  onError,
  isRegister = false,
  extraData = {},
  disabled = false,
}) {
  const googleBtnRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const extraDataStr = JSON.stringify(extraData);

  const handleCredentialResponse = useCallback(
    async (response) => {
      if (!response || !response.credential) {
        if (onError) onError("Failed to obtain Google credentials");
        return;
      }

      setLoading(true);
      try {
        const payload = {
          credential: response.credential,
          ...JSON.parse(extraDataStr),
        };

        const data = await googleLogin(payload);
        if (onSuccess) {
          onSuccess(data);
        }
      } catch (err) {
        console.error("Google Auth error:", err);
        if (onError) {
          onError(
            err.message ||
              err.error ||
              err.detail ||
              "Google authentication failed. Please try again."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [extraDataStr, onError, onSuccess]
  );

  useEffect(() => {
    let script = document.getElementById("google-gsi-script");

    const initializeGoogle = () => {
      setScriptLoaded(true);
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
          });

          if (googleBtnRef.current) {
            googleBtnRef.current.innerHTML = "";
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: "outline",
              size: "large",
              type: "standard",
              shape: "rectangular",
              text: isRegister ? "signup_with" : "signin_with",
              width: "100%",
              logo_alignment: "left",
            });
          }
        } catch (err) {
          console.warn("Google GIS render warning:", err);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.id = "google-gsi-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = initializeGoogle;
        document.body.appendChild(script);
      } else {
        script.addEventListener("load", initializeGoogle);
      }
    }

    return () => {
      if (script) {
        script.removeEventListener("load", initializeGoogle);
      }
    };
  }, [isRegister, handleCredentialResponse]);

  const handleCustomClick = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.log("One tap prompt status:", notification.getNotDisplayedReason());
        }
      });
    } else {
      if (onError) {
        onError("Google Sign-In SDK is loading or unavailable. Please check your network connection.");
      }
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Official Google GIS Button Container */}
      <div
        ref={googleBtnRef}
        className={`w-full flex justify-center min-h-[44px] ${
          loading || disabled ? "opacity-50 pointer-events-none" : ""
        }`}
      />

      {/* Custom Google Button Fallback */}
      {(!scriptLoaded || !googleBtnRef.current?.children?.length) && (
        <button
          type="button"
          onClick={handleCustomClick}
          disabled={loading || disabled}
          className="w-full bg-white hover:bg-slate-50 text-slate-900 font-semibold py-3 px-4 rounded-xl border border-slate-200 shadow-sm transition-all duration-200 text-sm flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <svg className="w-5 h-5 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{isRegister ? "Sign up with Google" : "Sign in with Google"}</span>
        </button>
      )}
    </div>
  );
}
