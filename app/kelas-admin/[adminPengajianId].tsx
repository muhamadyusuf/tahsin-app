import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Id } from "@/convex/_generated/dataModel";
import KelasAdminPanel from "@/components/KelasAdminPanel";

export default function KelasAdminScreen() {
  const router = useRouter();
  const { adminPengajianId } = useLocalSearchParams<{ adminPengajianId: string }>();

  if (!adminPengajianId) return null;

  return (
    <KelasAdminPanel
      adminPengajianId={adminPengajianId as Id<"admin_pengajian">}
      onBack={() => router.back()}
    />
  );
}
