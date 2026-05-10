// src/pages/AdminLogin.jsx — Enhanced: matches CandidateLogin style with AnimatedBlobBackground
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff, FiLoader, FiShield } from "react-icons/fi";
import { loginAdmin } from "../api/api";
import AnimatedBlobBackground from "../components/AnimatedBlobBackground";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginAdmin({ email: email.trim(), password });
      if (!data.access_token) throw new Error("No access token received");
      localStorage.setItem("admin_token", data.access_token);
      setLoading(false);
      navigate("/system-admin-portal-2024", { replace: true });
    } catch (err) {
      setLoading(false);
      setError(
        err.response?.data?.detail || err.message || "Invalid email or password."
      );
    }
  };

  return (
    <div className="min-h-screen bg-light flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Same animated blob background as CandidateLogin */}
      <AnimatedBlobBackground />

      {/* Header */}
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-lg">
            <FiShield className="text-4xl text-primary" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-dark">Admin Login</h2>
        <p className="mt-2 text-sm text-slate-500">
          XCalibr Admin Portal — Secure Access
        </p>
      </div>

      {/* Card — identical glass style to CandidateLogin */}
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/80 backdrop-blur-sm py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Admin Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="admin@xcalibr.com"
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary p-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:border-primary focus:ring-primary p-3 pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-700"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-primary hover:bg-primary-dark disabled:bg-slate-400 disabled:cursor-not-allowed transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Authenticating...
                </>
              ) : (
                "Sign In to Admin Portal"
              )}
            </button>
          </form>

          {/* Security notice */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <p className="text-xs text-center text-slate-400">
              🔒 Restricted area. All access is logged and monitored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
