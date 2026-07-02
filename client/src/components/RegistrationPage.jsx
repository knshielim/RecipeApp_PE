import { useState } from "react";

const API = "http://localhost:5237";

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
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

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
          fullName,
          email,
          username,
          password,
          phoneNumber,
          dateOfBirth,
          gender,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Registration failed.");
      setSuccess(data.message);
      setFullName("");
      setEmail("");
      setUsername("");
      setPassword("");
      setConfirm("");
      setPhoneNumber("");
      setDateOfBirth("");
      setGender("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Focus ring menggunakan warna brand RecipeApp (hijau)
  const inputClass =
    "w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm " +
    "focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-100 p-8 sm:p-10">
        <div className="flex items-center gap-2.5 mb-8">
          <span className="w-9 h-9 rounded-xl bg-green-600 text-white grid place-items-center font-bold text-lg">
            R
          </span>
          <span className="font-semibold text-lg text-slate-900 tracking-tight">
            RecipeApp Portal
          </span>
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
                placeholder="08xxxxxxxxxx"
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
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3.5 py-2.5">
              {success}
            </p>
          )}

          {/* Mengubah tombol pendaftaran menggunakan tema warna RecipeApp */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg
              font-semibold transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-sm text-center text-slate-500 mt-6">
          Already registered?{" "}
          <button
            onClick={onGoToLogin}
            className="text-green-600 font-semibold hover:text-green-700 hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

export default RegistrationPage;