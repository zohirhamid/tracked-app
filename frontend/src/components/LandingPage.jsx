import { useEffect, useState } from "react";
import { apiUrl, csrfToken, request } from "../api.js";

function GoogleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.39 13.87A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.32-1.87V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.61Z" />
    <path fill="#EA4335" d="M12 6c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.61C7.18 7.76 9.39 6 12 6Z" />
  </svg>;
}

function GoogleAuth({ mode }) {
  const [status, setStatus] = useState("loading");
  const [csrf, setCsrf] = useState("");

  useEffect(() => {
    let active = true;
    async function prepareGoogleRedirect() {
      setStatus("loading");
      try {
        // This request establishes the browser session and CSRF cookie. The
        // redirect endpoint is the source of truth for provider availability;
        // do not disable the button based on the optional provider listing.
        await request("/_allauth/browser/v1/config");
        let token = csrfToken();
        if (!token) {
          const csrfResponse = await request("/auth/csrf/");
          token = csrfResponse?.csrf_token;
        }
        if (!active) return;
        if (!token) throw new Error("Google sign-in could not be initialized.");
        setCsrf(token);
        setStatus("ready");
      } catch {
        if (active) setStatus("unavailable");
      }
    }
    prepareGoogleRedirect();
    return () => { active = false; };
  }, []);

  const callbackUrl = new URL(window.location.href);
  callbackUrl.hash = "";
  callbackUrl.search = "?social=google";

  const label = status === "unavailable"
      ? "GOOGLE SIGN-IN UNAVAILABLE"
      : mode === "signup" ? "SIGN UP WITH GOOGLE" : "SIGN IN WITH GOOGLE";

  return <>
    <div className="google-auth" aria-busy={status === "loading"}>
      <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
      <input type="hidden" name="provider" value="google" />
      <input type="hidden" name="process" value="login" />
      <input type="hidden" name="callback_url" value={callbackUrl.href} />
      <button
        className="social-auth-placeholder"
        data-status={status}
        data-provider="google"
        type="submit"
        formAction={apiUrl("/_allauth/browser/v1/auth/provider/redirect")}
        formMethod="post"
        formNoValidate
        disabled={status !== "ready"}
        title={status === "unavailable" ? "Google OAuth is not configured for this environment." : undefined}
      ><GoogleMark />{label}</button>
    </div>
    <div className="auth-divider"><span /><small>OR CONTINUE WITH EMAIL</small><span /></div>
  </>;
}

function AuthPanel({ initialMode, initialError, onModeChange, onAuthenticated }) {
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setIsSignUp(initialMode === "signup"), [initialMode]);
  useEffect(() => setError(initialError), [initialError]);

  async function submit(event) {
    if (event.nativeEvent.submitter?.dataset.provider === "google") return;
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    const form = new FormData(formElement);
    if (isSignUp && form.get("password") !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await request(isSignUp ? "/_allauth/app/v1/auth/signup" : "/_allauth/app/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      formElement.reset();
      await onAuthenticated();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-panel" id="auth-form" onSubmit={submit} aria-busy={submitting}>
      <p className="index-tag">YOUR LIFELOG</p>
      <h2>{isSignUp ? "Create account" : "Sign in"}</h2>
      <p className="form-copy">{isSignUp ? "Create your account and start logging." : "Welcome back. Sign in to open your log."}</p>
      <GoogleAuth mode={isSignUp ? "signup" : "signin"} />
      <label>Email<input name="email" type="email" autoComplete="email" required disabled={submitting} /></label>
      <label>Password<input name="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} required disabled={submitting} /></label>
      {isSignUp && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required disabled={submitting} /></label>}
      <p className="form-error" role="alert">{error}</p>
      <button className="log-entry-button form-submit" type="submit" disabled={submitting}>{isSignUp ? "CREATE ACCOUNT" : "SIGN IN"}</button>
      <button className="text-button" type="button" onClick={() => { const nextMode = isSignUp ? "signin" : "signup"; setIsSignUp(!isSignUp); onModeChange(nextMode); setError(""); }}>
        {isSignUp ? "Already have an account? Sign in" : "Create an account"}
      </button>
    </form>
  );
}

export default function LandingPage({ initialError = "", onAuthenticated }) {
  const [authMode, setAuthMode] = useState("signin");
  const chooseAuthMode = (mode) => setAuthMode(mode);
  return <>
    <div className="topbar">
      <div className="brand-group"><span className="index-tag">(INDEX) {new Date().getFullYear()}</span><a className="brand-title" href="/">LIFELOG</a></div>
      <nav className="marketing-nav" aria-label="Landing page">
        <a href="#method">METHOD</a>
        <a href="#access" onClick={() => chooseAuthMode("signin")}>SIGN IN</a>
        <a className="marketing-nav-cta" href="#access" onClick={() => chooseAuthMode("signup")}>START TRACKING</a>
      </nav>
    </div>
    <div className="auth-view">
      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="hero-copy">
            <p className="landing-kicker"><span>01</span> A PERSONAL DATA PRACTICE</p>
            <h1 id="landing-title">Build a life<br /><em>you can read.</em></h1>
            <p className="hero-lede">Track the handful of signals that shape your days. No noisy feed, no forced streaks—just a clear record of what happened.</p>
            <div className="hero-actions">
              <a className="landing-primary-button" href="#access" onClick={() => chooseAuthMode("signup")}>START TRACKING <span aria-hidden="true">↗</span></a>
              <a className="landing-text-link" href="#product-preview">SEE THE FORMAT <span aria-hidden="true">↓</span></a>
            </div>
            <p className="hero-note">SET UP IN MINUTES · EDIT INLINE · REVIEW BY MONTH</p>
          </div>
          <div className="product-preview" id="product-preview" aria-label="Illustrative LIFELOG monthly tracker">
            <div className="preview-bar"><span>LIFELOG / OCTOBER</span><span className="preview-live"><i /> LIVE VIEW</span></div>
            <div className="preview-heading"><div><small>MONTH 10 / 12</small><strong>OCTOBER 2026</strong></div><span>18 / 31 DAYS</span></div>
            <div className="preview-grid" role="presentation">
              <div className="preview-cell preview-head">DATE</div><div className="preview-cell preview-head">SLEEP</div><div className="preview-cell preview-head">MOVE</div><div className="preview-cell preview-head">MOOD</div><div className="preview-cell preview-head preview-wide">NOTE</div>
              <div className="preview-cell preview-date">MON 12</div><div className="preview-cell">7H 40M</div><div className="preview-cell preview-good">YES</div><div className="preview-cell">4/5</div><div className="preview-cell preview-wide preview-note">Deep work, clear head.</div>
              <div className="preview-cell preview-date">TUE 13</div><div className="preview-cell">6H 55M</div><div className="preview-cell preview-good">YES</div><div className="preview-cell">3/5</div><div className="preview-cell preview-wide preview-note">Long afternoon.</div>
              <div className="preview-cell preview-date">WED 14</div><div className="preview-cell">8H 10M</div><div className="preview-cell preview-bad">NO</div><div className="preview-cell">4/5</div><div className="preview-cell preview-wide preview-note">Dinner with friends.</div>
              <div className="preview-cell preview-date">THU 15</div><div className="preview-cell">7H 20M</div><div className="preview-cell preview-good">YES</div><div className="preview-cell preview-active">5/5</div><div className="preview-cell preview-wide preview-note">Best energy all week.</div>
              <div className="preview-cell preview-date">FRI 16</div><div className="preview-cell">—</div><div className="preview-cell">—</div><div className="preview-cell">—</div><div className="preview-cell preview-wide preview-note">Click any cell to log.</div>
            </div>
            <div className="preview-summary"><div><small>AVG. SLEEP</small><strong>7H 31M</strong></div><div><small>MOVEMENT</small><strong>75%</strong></div><div><small>AVG. MOOD</small><strong>4.0/5</strong></div></div>
          </div>
        </section>
        <div className="signal-strip" aria-label="Supported tracker formats"><span>BINARY</span><i>+</i><span>NUMBER</span><i>+</i><span>TIME</span><i>+</i><span>DURATION</span><i>+</i><span>RATING</span><i>+</i><span>NOTES</span></div>
        <section className="landing-manifesto" id="method" aria-labelledby="method-title">
          <div className="section-index"><span>02 / METHOD</span><span>LESS NOISE. MORE SIGNAL.</span></div>
          <div className="manifesto-copy"><h2 id="method-title">You don’t need to quantify everything.</h2><p>You need a small set of honest signals, recorded consistently enough to reveal the shape of your days.</p></div>
          <ol className="method-list">
            <li><span>01</span><div><h3>Choose your signals</h3><p>Create columns for what matters now—from sleep and movement to prayer, focus, mood, or a single daily note.</p></div></li>
            <li><span>02</span><div><h3>Log without friction</h3><p>Click a cell, enter the value, move on. Typed fields keep each signal useful without slowing you down.</p></div></li>
            <li><span>03</span><div><h3>Read the month</h3><p>See days together, spot the gaps, and use monthly summaries to notice patterns worth acting on.</p></div></li>
          </ol>
        </section>
        <section className="format-section" aria-labelledby="format-title">
          <div className="section-index"><span>03 / YOUR FORMAT</span><span>BUILT TO CHANGE WITH YOU.</span></div>
          <div className="format-heading"><h2 id="format-title">One grid.<br />Whatever matters.</h2><p>Start small. Add, reorder, or pause trackers as your attention shifts. Your system should follow your life—not the other way around.</p></div>
          <div className="format-cards">
            <article><span>Y / N</span><h3>Did it happen?</h3><p>Binary habits and commitments.</p></article><article><span>0—∞</span><h3>How much?</h3><p>Counts, quantities, and measures.</p></article><article><span>HH:MM</span><h3>When or how long?</h3><p>Times and durations that add context.</p></article><article><span>1—5</span><h3>How did it feel?</h3><p>Ratings for subjective signals.</p></article><article><span>TXT</span><h3>What stood out?</h3><p>Short notes for the texture behind the data.</p></article>
          </div>
        </section>
        <section className="access-section" id="access" aria-labelledby="access-title">
          <div className="access-copy"><p className="landing-kicker"><span>04</span> BEGIN WHERE YOU ARE</p><h2 id="access-title">Start with<br />one signal.</h2><p>The best tracking system is the one quiet enough to keep using.</p></div>
          <AuthPanel initialMode={authMode} initialError={initialError} onModeChange={chooseAuthMode} onAuthenticated={onAuthenticated} />
        </section>
        <footer className="landing-footer"><a className="brand-title" href="/">LIFELOG</a><p>A clearer record of the days that make a life.</p><a href="#landing-title">BACK TO TOP ↑</a></footer>
      </main>
    </div>
  </>;
}
