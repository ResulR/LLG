import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "@/routes/Login";
import Dashboard from "@/routes/Dashboard";
import Doctors from "@/routes/Doctors";
import DoctorDetails from "@/routes/DoctorDetails";
import Works from "@/routes/Works";
import Payments from "@/routes/Payments";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider } from "@/context/AuthContext";

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />


      <Route
        path="/doctors"
        element={
          <ProtectedRoute>
            <Doctors />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctors/:id"
        element={
          <ProtectedRoute>
            <DoctorDetails />
          </ProtectedRoute>
        }
      />


      <Route
        path="/works"
        element={
          <ProtectedRoute>
            <Works />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <Payments />
          </ProtectedRoute>
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />
    </Routes>
  );
}

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <BrowserRouter basename="/dentaltrack">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
