import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import OrderPage from "./pages/OrderPage";
import Dashboard from "./pages/Dashboard";
import Stock from "./pages/stock"; // 📦 Import stock page

// ✅ Wrapper to protect routes based on stored role
function ProtectedRoute({ children, allowedRoles }) {
  const role = localStorage.getItem("role");
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Login page */}
        <Route path="/" element={<Login />} />

        {/* User order page */}
        <Route
          path="/order"
          element={
            <ProtectedRoute allowedRoles={["user"]}>
              <OrderPage />
            </ProtectedRoute>
          }
        />

        {/* Manager dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Stock management (manager only) */}
        <Route
          path="/stock-management"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <Stock />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect for unknown paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
