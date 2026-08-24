"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import api, { setCsrfToken } from "@/lib/api";
import type { User } from "@/types/user";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {
    throw new Error("AuthProvider not mounted");
  },
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // The token lives in an httpOnly cookie now — this page has no way to read
  // it directly, so on load it asks the backend "who am I" and lets the
  // cookie (sent automatically by the browser) answer. A missing/expired/
  // invalid cookie just 401s, which we treat as "not logged in" rather than
  // an error worth surfacing.
  useEffect(() => {
    api
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data.user);
        setCsrfToken(data.csrfToken || null);
      })
      .catch(() => {
        setUser(null);
        setCsrfToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const { data } = await api.post("/auth/login", { email, password });
    setCsrfToken(data.csrfToken || null);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    // Fire-and-forget — the cookie is httpOnly so there's no client-side
    // "just delete it" option; the server clears it. We still update local
    // state immediately so the UI doesn't wait on the network round trip.
    api.post("/auth/logout").catch(() => {});
    setCsrfToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
