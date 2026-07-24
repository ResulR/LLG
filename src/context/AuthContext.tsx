import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { api } from "@/lib/api";

type User = {
  userId: string;
  iat?: number;
  exp?: number;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const response = await api("/auth/me");

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();

      setUser(data.user);
    } catch {
      setUser(null);
    }
  }

  async function logout() {
    await api("/auth/logout", {
      method: "POST",
    });

    setUser(null);
  }

  useEffect(() => {
    refresh()
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}
