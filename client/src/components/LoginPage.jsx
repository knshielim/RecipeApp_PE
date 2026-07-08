import { useState } from "react";
import { API_BASE, parseApiResponse, formatFetchError } from "../utils/apiError";
const API = API_BASE;

const ROLES = [
  {
    id: "User",
    label: "User",
    desc: "Access recipes, pantry, meal plans, and AI assistant.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "Admin",
    label: "Admin",
    desc: "Manage users, recipes, and recipe categories.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function LoginPage({ onLoginSuccess, onGoToRegister, initialUsername = "", justRegistered = false }) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("User");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, role }),
      });

      const data = await parseApiResponse(res, "Login failed.");

      onLoginSuccess(data.token, data.username, data.role);
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-4xl soft-card soft-shadow overflow-hidden grid md:grid-cols-[1.1fr_1.3fr]">

        <div className="bg-brand text-white p-10 flex flex-col justify-between relative overflow-hidden max-md:hidden">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative">
            <div className="flex items-center">
              <img src="/Untitled design.png" alt="Nomly" className="h-30" />
            </div>
            <h1 className="font-bold text-3xl leading-tight mt-12">
              Welcome to
              <br />
              Your Kitchen.
            </h1>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <h2 className="font-bold text-2xl text-slate-900">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Choose your role, then enter your credentials.
          </p>

          {justRegistered && !error && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5 mb-6">
              Account created successfully. Sign in with your new credentials.
            </p>
          )}

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6" role="radiogroup" aria-label="Role">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={role === r.id}
                onClick={() => setRole(r.id)}
                className={`text-left rounded-2xl border-2 p-4 transition focus-visible:outline-none
                  ${role === r.id
                    ? "border-brand bg-brand-light"
                    : "border-slate-200 hover:border-slate-300"}`}
              >
                <span
                  className={`inline-grid place-items-center w-9 h-9 rounded-xl mb-2
                    ${role === r.id ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}
                >
                  {r.icon}
                </span>
                <p className="font-semibold text-slate-900">{r.label}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{r.desc}</p>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-slate-700 mb-1.5">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="input-field w-full"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 whitespace-pre-line">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 disabled:opacity-50 mt-2"
            >
              {loading ? "Signing in..." : `Sign in as ${role}`}
            </button>
          </form>

          <p className="text-sm text-center text-slate-500 mt-6">
            Don&apos;t have an account?{" "}
            <button
              onClick={onGoToRegister}
              className="text-brand font-semibold hover:underline"
            >
              Create account
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}

export default LoginPage;

