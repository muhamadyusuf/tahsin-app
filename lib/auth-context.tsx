import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/expo";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { UserRole } from "./constants";

interface UserData {
  _id: Id<"users">;
  clerkId: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  adminPengajianId?: Id<"admin_pengajian">;
  location?: string;
  avatarUrl?: string;
  isActive: boolean;
}

interface AuthContextType {
  isLoading: boolean;
  isAuthenticated: boolean;
  userData: UserData | null;
  role: UserRole | null;
  availableRoles: UserRole[];
  hasMultipleRoles: boolean;
  switchRole: (nextRole: UserRole) => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  isAuthenticated: false,
  userData: null,
  role: null,
  availableRoles: [],
  hasMultipleRoles: false,
  switchRole: async () => {},
  isAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [isReady, setIsReady] = useState(false);

  const userData = useQuery(
    api.users.getByClerkId,
    isSignedIn && user?.id ? { clerkId: user.id } : "skip"
  );

  const upsertUser = useMutation(api.users.upsertUser);
  const setActiveRole = useMutation(api.users.setActiveRole);

  const availableRoles = useQuery(
    api.users.getAvailableRoles,
    userData?._id ? { userId: userData._id } : "skip"
  );

  useEffect(() => {
    if (isLoaded && isSignedIn && user && userData === null) {
      // User is signed in but not yet in Convex — create them
      upsertUser({
        clerkId: user.id,
        name:
          user.fullName ??
          user.firstName ??
          user.emailAddresses[0]?.emailAddress ??
          "User",
        email: user.emailAddresses[0]?.emailAddress ?? "",
        phone: user.phoneNumbers[0]?.phoneNumber,
        avatarUrl: user.imageUrl,
      });
    }
  }, [isLoaded, isSignedIn, user, userData]);

  useEffect(() => {
    if (isLoaded) {
      setIsReady(true);
    }
  }, [isLoaded]);

  const value: AuthContextType = {
    isLoading:
      !isReady ||
      (isSignedIn && userData === undefined) ||
      (!!userData && availableRoles === undefined),
    isAuthenticated: !!isSignedIn && !!userData,
    userData: (userData as UserData) ?? null,
    role: (userData as UserData)?.role ?? null,
    availableRoles: (availableRoles as UserRole[] | undefined) ?? [],
    hasMultipleRoles: ((availableRoles as UserRole[] | undefined)?.length ?? 0) > 1,
    switchRole: async (nextRole: UserRole) => {
      const currentUser = userData as UserData | null | undefined;
      if (!currentUser || currentUser.role === nextRole) {
        return;
      }
      await setActiveRole({ userId: currentUser._id, role: nextRole });
    },
    isAdmin:
      (userData as UserData | null)?.role === "administrator" ||
      (userData as UserData | null)?.role === "admin_pengajian",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
