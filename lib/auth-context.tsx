import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useUser } from "@clerk/expo";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
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
  // Fungsi Convex kini memverifikasi JWT Clerk di server, jadi tunggu sampai
  // token benar-benar diterima Convex (bukan hanya isSignedIn dari Clerk)
  // sebelum memanggil query/mutation yang butuh identitas.
  const { isAuthenticated: convexAuthed, isLoading: convexAuthLoading } =
    useConvexAuth();
  const [isReady, setIsReady] = useState(false);
  const [isProvisioningUser, setIsProvisioningUser] = useState(false);

  const userData = useQuery(
    api.users.getByClerkId,
    convexAuthed && user?.id ? { clerkId: user.id } : "skip"
  );

  const upsertUser = useMutation(api.users.upsertUser);
  const setActiveRole = useMutation(api.users.setActiveRole);

  const availableRoles = useQuery(
    api.users.getAvailableRoles,
    userData?._id ? { userId: userData._id } : "skip"
  );

  // Ref (bukan state di dependency) untuk menandai upsert yang sedang jalan.
  // Versi lama memakai cleanup `isCancelled` + isProvisioningUser di deps:
  // begitu setIsProvisioningUser(true) memicu re-run, cleanup menandai
  // isCancelled dan .finally tidak pernah me-reset flag - isLoading macet
  // true dan user baru stuck di splash selamanya.
  const provisioningRef = useRef(false);

  useEffect(() => {
    if (!(isLoaded && isSignedIn && convexAuthed && user && userData === null)) {
      return;
    }
    if (provisioningRef.current) {
      return;
    }

    // First login can race with route guards; keep app in loading state
    // until the Convex user record is provisioned.
    provisioningRef.current = true;
    setIsProvisioningUser(true);

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
    })
      .catch((error) => {
        console.error("Failed to provision user in Convex:", error);
      })
      .finally(() => {
        provisioningRef.current = false;
        setIsProvisioningUser(false);
      });
  }, [isLoaded, isSignedIn, convexAuthed, user, userData, upsertUser]);

  // Sinkronisasi profil sekali per sesi untuk user yang SUDAH ada. upsertUser
  // di atas hanya jalan saat provisioning awal (userData === null), sehingga
  // perubahan seperti promosi email administrator (ADMIN_EMAILS) tidak akan
  // menyentuh akun lama. Sync ringan ini menyelaraskan nama/avatar sekaligus
  // menyembuhkan role (mis. email yang baru dijadikan admin). Fire-and-forget,
  // tidak memblokir UI.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!(isLoaded && isSignedIn && convexAuthed && user && userData)) {
      return;
    }
    if (syncedRef.current) {
      return;
    }
    syncedRef.current = true;

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
    }).catch((error) => {
      console.error("Failed to sync user in Convex:", error);
    });
  }, [isLoaded, isSignedIn, convexAuthed, user, userData, upsertUser]);

  useEffect(() => {
    if (isLoaded) {
      setIsReady(true);
    }
  }, [isLoaded]);

  const value: AuthContextType = {
    isLoading:
      !isReady ||
      (isSignedIn && convexAuthLoading) ||
      (isSignedIn && userData === undefined) ||
      (isSignedIn && userData === null) ||
      isProvisioningUser ||
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
