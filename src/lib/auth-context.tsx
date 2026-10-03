import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  clearAuthSessionCookies,
  ensureAuthSessionFromCookies,
  refreshStoredAuthSession,
} from "@/lib/auth-session";

type AppRole = "admin" | "general_manager" | "manager" | "employee";

interface Profile {
  id: string;
  full_name: string;
  job_title: string | null;
  email: string | null;
  department: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const SUPER_ADMIN_EMAILS = ["ctraining801@gmail.com"];

  const loadProfileAndRoles = async (uid: string, overrideEmail?: string | null) => {
    try {
      const [{ data: prof }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, job_title, email, department").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      setProfile(prof ?? null);
      const assignedRoles = ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role);
      const emailToCheck = (prof?.email || overrideEmail || user?.email || "").toLowerCase().trim();
      if (emailToCheck && SUPER_ADMIN_EMAILS.includes(emailToCheck)) {
        const topRoles: AppRole[] = ["admin", "general_manager", "manager"];
        for (const tr of topRoles) {
          if (!assignedRoles.includes(tr)) assignedRoles.push(tr);
        }
      }
      setRoles(assignedRoles);
    } catch (err) {
      console.warn("[AuthProvider] Non-fatal loadProfileAndRoles error:", err);
    }
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        refreshStoredAuthSession(newSession);
        // defer to avoid deadlock
        setTimeout(() => {
          loadProfileAndRoles(newSession.user.id, newSession.user.email);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    // Then check existing session
    ensureAuthSessionFromCookies()
      .then((existing) => {
        setSession(existing);
        setUser(existing?.user ?? null);
        if (existing?.user) {
          loadProfileAndRoles(existing.user.id, existing.user.email).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("[AuthProvider] Non-fatal ensureAuthSession error:", err);
        setLoading(false);
      });

    // Auto-refresh roles when tab becomes visible again (no need for F5)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) loadProfileAndRoles(data.user.id, data.user.email);
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  const signOut = async () => {
    await clearAuthSessionCookies();
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) await loadProfileAndRoles(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, loading, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
