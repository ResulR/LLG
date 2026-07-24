import {
  LayoutDashboard,
  Stethoscope,
  ClipboardList,
  CreditCard,
  LogOut,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

import "@/styles/dashboard.css";

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-layout">

      <aside className="sidebar">
        <div className="brand">
          DentalTrack
        </div>

        <nav>
          <a
            onClick={() => navigate("/dashboard")}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </a>

          <a
            onClick={() => navigate("/doctors")}
          >
            <Stethoscope size={18} />
            Mjekët
          </a>

          <a
            onClick={() => navigate("/works")}
          >
            <ClipboardList size={18} />
            Punët
          </a>

          <a
            onClick={() => navigate("/payments")}
          >
            <CreditCard size={18} />
            Pagesat
          </a>
        </nav>

        <button
          className="logout"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          Dil
        </button>
      </aside>


      <section className="content">

        <header className="topbar">
          <span>
            Paneli kryesor
          </span>

          <small>
            {user?.userId}
          </small>
        </header>

        {children}

      </section>

    </div>
  );
}
