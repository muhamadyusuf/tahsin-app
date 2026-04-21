import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";

type TabKey = "tilawah" | "talaqi";

export default function MonitoringScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("tilawah");

  const allUsers = useQuery(api.users.listAll, {});

  // We query all users' data in bulk — in a real app you'd have server aggregation
  // For now we show per-user breakdown

  return (
    <View style={st.container}>
      {/* Tab Switch */}
      <View style={st.tabRow}>
        <Pressable
          style={[st.tab, activeTab === "tilawah" && st.tabActive]}
          onPress={() => setActiveTab("tilawah")}
        >
          <FontAwesome
            name="book"
            size={14}
            color={activeTab === "tilawah" ? "#fff" : Colors.textSecondary}
          />
          <Text
            style={[st.tabText, activeTab === "tilawah" && st.tabTextActive]}
          >
            Tilawah
          </Text>
        </Pressable>
        <Pressable
          style={[st.tab, activeTab === "talaqi" && st.tabActive]}
          onPress={() => setActiveTab("talaqi")}
        >
          <FontAwesome
            name="comments"
            size={14}
            color={activeTab === "talaqi" ? "#fff" : Colors.textSecondary}
          />
          <Text
            style={[st.tabText, activeTab === "talaqi" && st.tabTextActive]}
          >
            Talaqi
          </Text>
        </Pressable>
      </View>

      {!allUsers ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === "tilawah" ? (
        <TilawahMonitoring users={allUsers} />
      ) : (
        <TalaqiMonitoring users={allUsers} />
      )}
    </View>
  );
}

/* ── Tilawah Monitoring ──────────────────────── */

function TilawahMonitoring({ users }: { users: any[] }) {
  const santriUsers = users.filter((u) => u.role === "santri");

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={st.summaryCard}>
        <FontAwesome name="book" size={20} color={Colors.primary} />
        <Text style={st.summaryTitle}>Ringkasan Tilawah</Text>
        <Text style={st.summaryValue}>{santriUsers.length} santri terdaftar</Text>
      </View>

      {santriUsers.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyText}>Belum ada data santri</Text>
        </View>
      ) : (
        santriUsers.map((user) => (
          <TilawahUserCard key={user._id} user={user} />
        ))
      )}
    </ScrollView>
  );
}

function TilawahUserCard({ user }: { user: any }) {
  const tilawah = useQuery(api.tilawah.getByUser, { userId: user._id });
  const khatam = useQuery(api.tilawah.getKhatamProgress, {
    userId: user._id,
  });

  const totalPages = tilawah?.reduce((s, t) => s + t.jumlahHalaman, 0) ?? 0;

  return (
    <View style={st.userCard}>
      <View style={st.userCardHeader}>
        <View style={st.avatar}>
          <Text style={st.avatarText}>
            {user.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.userName}>{user.name}</Text>
          <Text style={st.userEmail}>{user.email}</Text>
        </View>
      </View>
      <View style={st.statsRow}>
        <View style={st.miniStat}>
          <Text style={st.miniStatValue}>{tilawah?.length ?? 0}</Text>
          <Text style={st.miniStatLabel}>Bacaan</Text>
        </View>
        <View style={st.miniStat}>
          <Text style={st.miniStatValue}>{totalPages}</Text>
          <Text style={st.miniStatLabel}>Halaman</Text>
        </View>
        <View style={st.miniStat}>
          <Text style={st.miniStatValue}>{khatam?.khatamCount ?? 0}</Text>
          <Text style={st.miniStatLabel}>Khatam</Text>
        </View>
      </View>
    </View>
  );
}

/* ── Talaqi Monitoring ──────────────────────── */

function TalaqiMonitoring({ users }: { users: any[] }) {
  const ustadzUsers = users.filter((u) => u.role === "ustadz");

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={st.summaryCard}>
        <FontAwesome name="comments" size={20} color="#7B1FA2" />
        <Text style={st.summaryTitle}>Ringkasan Talaqi</Text>
        <Text style={st.summaryValue}>{ustadzUsers.length} ustadz terdaftar</Text>
      </View>

      {ustadzUsers.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyText}>Belum ada data ustadz</Text>
        </View>
      ) : (
        ustadzUsers.map((user) => (
          <TalaqiUstadzCard key={user._id} user={user} />
        ))
      )}
    </ScrollView>
  );
}

function TalaqiUstadzCard({ user }: { user: any }) {
  const sessions = useQuery(api.talaqi.getByUstadz, { ustadzId: user._id });

  const hadir = sessions?.filter((s) => s.presensi).length ?? 0;
  const totalSessions = sessions?.length ?? 0;

  return (
    <View style={st.userCard}>
      <View style={st.userCardHeader}>
        <View style={[st.avatar, { backgroundColor: "#F3E5F5" }]}>
          <Text style={[st.avatarText, { color: "#7B1FA2" }]}>
            {user.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.userName}>{user.name}</Text>
          <Text style={st.userEmail}>{user.email}</Text>
        </View>
      </View>
      <View style={st.statsRow}>
        <View style={st.miniStat}>
          <Text style={st.miniStatValue}>{totalSessions}</Text>
          <Text style={st.miniStatLabel}>Sesi</Text>
        </View>
        <View style={st.miniStat}>
          <Text style={st.miniStatValue}>{hadir}</Text>
          <Text style={st.miniStatLabel}>Hadir</Text>
        </View>
        <View style={st.miniStat}>
          <Text style={st.miniStatValue}>
            {totalSessions > 0
              ? Math.round((hadir / totalSessions) * 100)
              : 0}
            %
          </Text>
          <Text style={st.miniStatLabel}>Kehadiran</Text>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  tabRow: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  summaryValue: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  userCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  userCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: Colors.primary },
  userName: { fontSize: 14, fontWeight: "600", color: Colors.text },
  userEmail: { fontSize: 12, color: Colors.textSecondary },

  statsRow: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: 10,
    gap: 8,
  },
  miniStat: {
    flex: 1,
    alignItems: "center",
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
  },
  miniStatLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  empty: { alignItems: "center", padding: 40 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
});
