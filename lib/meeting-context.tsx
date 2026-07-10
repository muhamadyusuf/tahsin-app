// Context global video meeting. Dipasang di root layout sehingga meeting
// tetap tersambung saat pengguna berpindah layar (menilai santri, membuka
// mushaf, dsb.) — dalam mode mini, meeting tampil sebagai jendela kecil
// melayang; mode full menutupi seluruh layar.
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import MeetingRoom from "@/components/MeetingRoom";

export type ActiveMeeting = {
  pertemuanId: Id<"kelas_pertemuan">;
  userId: Id<"users">;
  displayName: string;
  title: string;
  isHost: boolean;
};

export type MeetingViewMode = "full" | "mini";

type MeetingContextValue = {
  active: ActiveMeeting | null;
  mode: MeetingViewMode;
  joinMeeting: (meeting: ActiveMeeting) => void;
  minimize: () => void;
  expand: () => void;
  endMeeting: () => void;
};

const MeetingContext = createContext<MeetingContextValue>({
  active: null,
  mode: "full",
  joinMeeting: () => {},
  minimize: () => {},
  expand: () => {},
  endMeeting: () => {},
});

export function useMeeting() {
  return useContext(MeetingContext);
}

// Menjaga meeting mengikuti status pertemuan: bila ustadz mengakhiri
// pertemuan (status bukan lagi "ongoing"), semua peserta otomatis keluar.
function MeetingWatcher({
  meeting,
  onEnded,
}: {
  meeting: ActiveMeeting;
  onEnded: () => void;
}) {
  const pertemuan = useQuery(api.kelasPertemuan.getById, {
    id: meeting.pertemuanId,
  });
  React.useEffect(() => {
    if (pertemuan && pertemuan.status !== "ongoing") onEnded();
  }, [pertemuan, onEnded]);
  return null;
}

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveMeeting | null>(null);
  const [mode, setMode] = useState<MeetingViewMode>("full");

  const joinMeeting = useCallback((meeting: ActiveMeeting) => {
    setActive(meeting);
    setMode("full");
  }, []);
  const minimize = useCallback(() => setMode("mini"), []);
  const expand = useCallback(() => setMode("full"), []);
  const endMeeting = useCallback(() => setActive(null), []);

  const value = useMemo(
    () => ({ active, mode, joinMeeting, minimize, expand, endMeeting }),
    [active, mode, joinMeeting, minimize, expand, endMeeting]
  );

  return (
    <MeetingContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {active && (
          <>
            <MeetingWatcher meeting={active} onEnded={endMeeting} />
            <View
              style={mode === "full" ? st.fullOverlay : st.miniOverlay}
              pointerEvents="auto"
            >
              {/* MeetingRoom tetap ter-mount saat ganti mode — koneksi WebRTC,
                  share layar, dan rekaman tidak terputus. */}
              <MeetingRoom
                pertemuanId={active.pertemuanId}
                userId={active.userId}
                displayName={active.displayName}
                title={active.title}
                isHost={active.isHost}
                mode={mode}
                onMinimize={minimize}
                onExpand={expand}
                onLeave={endMeeting}
              />
            </View>
          </>
        )}
      </View>
    </MeetingContext.Provider>
  );
}

const st = StyleSheet.create({
  fullOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  miniOverlay: {
    position: "absolute",
    right: 12,
    bottom: 100,
    width: 150,
    height: 210,
    zIndex: 1000,
    elevation: 1000,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
