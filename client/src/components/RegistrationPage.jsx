import { useState, useEffect } from "react";
import { API_BASE, parseApiResponse, formatFetchError } from "../utils/apiError";

const API = API_BASE;

function RegistrationPage({ onGoToLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredUsername, setRegisteredUsername] = useState(null);

  useEffect(() => {
    if (registeredUsername === null) return;
    const timer = setTimeout(() => onGoToLogin(registeredUsername), 2500);
    return () => clearTimeout(timer);
  }, [registeredUsername, onGoToLogin]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          username: username.trim(),
          password,
          role: "User",
          phoneNumber: phoneNumber.trim(),
          dateOfBirth,
          gender,
        }),
      });

      await parseApiResponse(res, "Registration failed.");

      setRegisteredUsername(username.trim());
    } catch (err) {
      setError(formatFetchError(err));
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "input-field w-full";

  if (registeredUsername !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
        <div className="w-full max-w-md soft-card soft-shadow p-8 sm:p-10 text-center">
          <span className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h2 className="font-bold text-2xl text-slate-900">Account created!</h2>
          <p className="text-sm text-slate-500 mt-2">
            Welcome, <span className="font-semibold text-slate-700">{registeredUsername}</span>.
            <br />
            Taking you to the sign-in page...
          </p>
          <div className="flex justify-center mt-6 mb-2">
            <span className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-brand animate-spin" />
          </div>
          <button
            onClick={() => onGoToLogin(registeredUsername)}
            className="w-full btn-primary py-3 mt-4"
          >
            Sign in now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md soft-card soft-shadow p-8 sm:p-10">
        <div className="flex items-center mb-8">
          <img src="/NomlyLogo-Green.png" alt="Nomly" className="h-25" />
        </div>

        <h2 className="font-bold text-2xl text-slate-900">
          Create account
        </h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Register once, then sign in as a User.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reg-fullname" className="block text-sm font-medium text-slate-700 mb-1.5">
              Full name
            </label>
            <input
              id="reg-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="reg-username" className="block text-sm font-medium text-slate-700 mb-1.5">
              Username
            </label>
            <input
              id="reg-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone number
              </label>
              <input
                id="reg-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoComplete="tel"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="reg-dob" className="block text-sm font-medium text-slate-700 mb-1.5">
                Date of birth
              </label>
              <input
                id="reg-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-gender" className="block text-sm font-medium text-slate-700 mb-1.5">
              Gender
            </label>
            <select
              id="reg-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={`${inputClass} bg-white`}
              required
            >
              <option value="" disabled>Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              className={inputClass}
              required
            />
            <p className="text-xs text-slate-400 mt-1">At least 6 characters.</p>
          </div>

          <div>
            <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
              Confirm password
            </label>
            <input
              id="reg-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              className={inputClass}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 whitespace-pre-line">
              {error}
            </p>
          )}

          {/* Mengubah tombol pendaftaran menggunakan tema warna Nomly */}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-sm text-center text-slate-500 mt-6">
          Already registered?{" "}
          <button
            onClick={() => onGoToLogin()}
            className="text-brand font-semibold hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export default RegistrationPage;