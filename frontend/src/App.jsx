import { useCallback, useEffect, useRef, useState } from "react";
import { clearSessionToken, request } from "./api.js";
import Dashboard from "./components/Dashboard.jsx";
import LandingPage from "./components/LandingPage.jsx";
import UsernameSetup from "./components/UsernameSetup.jsx";

export default function App() {
  const today = new Date();
  const [authState, setAuthState] = useState("loading");
  const [authError, setAuthError] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [monthData, setMonthData] = useState(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [status, setStatus] = useState({ message: "", type: "" });
  const requestId = useRef(0);

  const enterAuthenticatedApp = useCallback(async () => {
    const profile = await request("/tracker/profile/username/");
    setAuthState(profile.is_complete ? "authenticated" : "setup");
  }, []);

  const loadMonth = useCallback(async () => {
    const id = ++requestId.current;
    setMonthLoading(true);
    setStatus({ message: "Loading month…", type: "loading" });
    try {
      const data = await request(`/tracker/month/${visibleMonth.getFullYear()}/${visibleMonth.getMonth() + 1}/`);
      if (id !== requestId.current) return;
      setMonthData(data);
      setStatus(data.trackers.length ? { message: "", type: "" } : { message: "No active trackers yet. Add one to begin.", type: "empty" });
    } catch (error) {
      if (id === requestId.current) setStatus({ message: `${error.message}. Select a month to retry.`, type: "error" });
    } finally {
      if (id === requestId.current) setMonthLoading(false);
    }
  }, [visibleMonth]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      const callbackUrl = new URL(window.location.href);
      if (callbackUrl.searchParams.has("error")) {
        setAuthError("Google sign-in was cancelled or could not be completed. Please try again.");
      }
      if (callbackUrl.searchParams.has("social") || callbackUrl.searchParams.has("error")) {
        callbackUrl.searchParams.delete("social");
        callbackUrl.searchParams.delete("error");
        callbackUrl.searchParams.delete("error_process");
        window.history.replaceState({}, "", callbackUrl);
      }
      try {
        let session;
        try {
          session = await request("/_allauth/app/v1/auth/session");
        } catch (error) {
          if (![401, 403, 410].includes(error.status)) throw error;
          session = await request("/_allauth/browser/v1/auth/session");
        }
        if (!session?.data?.user) throw Object.assign(new Error("Not authenticated"), { status: 401 });
        if (active) {
          setAuthError("");
          await enterAuthenticatedApp();
        }
      } catch (error) {
        if (active) setAuthState("unauthenticated");
      }
    }
    bootstrap();
    const unauthenticated = () => { setMonthData(null); setAuthState("unauthenticated"); };
    window.addEventListener("lifelog:unauthenticated", unauthenticated);
    return () => { active = false; window.removeEventListener("lifelog:unauthenticated", unauthenticated); };
  }, [enterAuthenticatedApp]);

  useEffect(() => { if (authState === "authenticated") loadMonth(); }, [authState, loadMonth]);

  async function signOut() {
    try {
      try {
        await request("/_allauth/app/v1/auth/session", { method: "DELETE" });
      } catch (error) {
        if (![401, 403, 410].includes(error.status)) throw error;
        await request("/_allauth/browser/v1/auth/session", { method: "DELETE" });
      }
    } catch (error) {
      if (![401, 410].includes(error.status)) setStatus({ message: error.message, type: "error" });
    } finally {
      clearSessionToken();
      setMonthData(null);
      setAuthState("unauthenticated");
    }
  }

  if (authState === "loading") return <div className="auth-view"><main className="landing-main"><section className="access-section"><div className="access-copy"><p className="landing-kicker"><span>01</span> LIFELOG</p><h2>Opening your log…</h2></div></section></main></div>;
  if (authState === "unauthenticated") return <LandingPage initialError={authError} onAuthenticated={enterAuthenticatedApp} />;
  if (authState === "setup") return <UsernameSetup onComplete={enterAuthenticatedApp} onSignOut={signOut} />;
  return <Dashboard visibleMonth={visibleMonth} setVisibleMonth={setVisibleMonth} monthData={monthData} setMonthData={setMonthData} loading={monthLoading} status={status} loadMonth={loadMonth} onSignOut={signOut} />;
}
