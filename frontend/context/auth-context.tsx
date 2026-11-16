"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  getCurrentUser,
  getUserFacingAuthError,
  loginAccount,
  logoutAccount,
  registerAccount,
  type AuthUser,
} from "@/lib/api";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  login(email: string, password: string): Promise<AuthUser>;
  register(email: string, password: string): Promise<AuthUser>;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getAvailabilityMessage(error: unknown): string {
  return getUserFacingAuthError(
    error,
    "Could not verify your sign-in status. Please try again.",
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    status: "loading",
    error: null,
  });
  const refreshRequest = useRef<Promise<void> | null>(null);

  const refreshUser = useCallback((): Promise<void> => {
    if (refreshRequest.current) return refreshRequest.current;

    setAuthState((current) => {
      if (current.user || current.status === "loading") return current;
      return { user: null, status: "loading", error: null };
    });

    const request = getCurrentUser()
      .then((user) => {
        setAuthState({ user, status: "authenticated", error: null });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          setAuthState({ user: null, status: "unauthenticated", error: null });
          return;
        }

        const message = getAvailabilityMessage(error);
        setAuthState((current) =>
          current.user
            ? { ...current, status: "authenticated", error: message }
            : { user: null, status: "unavailable", error: message },
        );
      })
      .finally(() => {
        refreshRequest.current = null;
      });

    refreshRequest.current = request;
    return request;
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const user = await loginAccount(email, password);
      setAuthState({ user, status: "authenticated", error: null });
      return user;
    },
    [],
  );

  const register = useCallback(
    (email: string, password: string): Promise<AuthUser> =>
      registerAccount(email, password),
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    await logoutAccount();
    setAuthState({ user: null, status: "unauthenticated", error: null });
  }, []);

  const value: AuthContextValue = {
    ...authState,
    isAuthenticated: authState.user !== null,
    isLoading: authState.status === "loading",
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
