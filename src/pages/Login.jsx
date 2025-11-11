import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";

export default function Login() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = () => {
    // Clear any previous error
    setError("");

    // ✅ Validate non-empty fields
    if (!userId.trim() || !password.trim()) {
      setError("Please enter both User ID and Password.");
      return;
    }

    // ✅ Hardcoded credentials
    const credentials = {
      user01: { password: "user123", role: "user" },
      manager01: { password: "manager123", role: "manager" },
      auditor01: { password: "auditor123", role: "authority" }
    };

    const user = credentials[userId];

    if (user && user.password === password) {
      const role = user.role;

      // ✅ Store role for ProtectedRoute checks
      localStorage.setItem("role", role);

      if (role === "user") {
        navigate("/order");
      } else if (role === "manager") {
        navigate("/dashboard");
      } else {
        alert("You will receive updates by mail. Dashboard access denied.");
      }
    } else {
      setError("Invalid User ID or Password.");
    }
  };

  // ✅ Allow Enter key to submit
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="login-page">
      {/* Top Left Logo */}
      <img src="/renault-group-logo.png" alt="Renault Logo" className="logo" />

      {/* Background watermark */}
      <img src="/Renault-logo.jpg" alt="Background Logo" className="bg-logo" />

      {/* Login Form */}
      <div className="login-box">
        <h2>LOGIN</h2>
        {error && <p className="error-msg">{error}</p>}
        <input
          type="text"
          placeholder="Enter your ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          type="password"
          placeholder="Enter the Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleLogin}>Login</button>
      </div>
    </div>
  );
}
