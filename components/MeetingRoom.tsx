// Ruang video meeting internal (pengganti Jitsi) — UI lintas platform di atas
// useMeetingRoom (WebRTC mesh + signaling Convex).
//
// Dua mode tampilan (dikendalikan lib/meeting-context.tsx):
//   full — menutupi layar, grid peserta + chat + semua kontrol.
//   mini — jendela kecil melayang; meeting tetap tersambung sementara
//          pengguna menilai santri / membuka mushaf / layar lain.
// Fitur host: mute & minta unmute peserta, share layar (web), rekam sesi
// (web) yang otomatis diunggah ke Google Drive.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/lib/constants";
import { useMeetingRoom, MeetingParticipant } from "@/lib/useMeetingRoom";
import {
  VideoView,
  canSwitchCamera,
  canShareScreen,
  canRecord,
} from "@/lib/webrtc";
import type { StreamLike } from "@/lib/webrtc-types";
import type { MeetingViewMode } from "@/lib/meeting-context";

interface Props {
  pertemuanId: Id<"kelas_pertemuan">;
  userId: Id<"users">;
  displayName: string;
  title: string;
  isHost: boolean;
  mode: MeetingViewMode;
  onMinimize: () => void;
  onExpand: () => void;
  onLeave: () => void;
}

type Tile = {
  key: string;
  name: string;
  stream: StreamLike | null;
  isLocal: boolean;
  micOn: boolean;
  camOn: boolean;
  screenOn: boolean;
  isHostTile: boolean;
};

export default function MeetingRoom({
  pertemuanId,
  userId,
  displayName,
  title,
  isHost,
  mode,
  onMinimize,
  onExpand,
  onLeave,
}: Props) {
  const insets = useSafeAreaInsets();
  const {
    sessionId,
    phase,
    errorMsg,
    localPreviewStream,
    remoteStreams,
    participants,
    micOn,
    camOn,
    screenOn,
    recState,
    unmuteRequested,
    toggleMic,
    toggleCam,
    switchCamera,
    toggleScreenShare,
    startRecording,
    stopRecording,
    acceptUnmute,
    dismissUnmute,
    hostMute,
    hostRequestUnmute,
  } = useMeetingRoom({ pertemuanId, userId, name: displayName, isHost });

  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const [chatOpen, setChatOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // ---- Chat ----
  const messages = useQuery(
    api.meeting.listMessages,
    phase === "joined" ? { pertemuanId } : "skip"
  );
  const sendMessage = useMutation(api.meeting.sendMessage);
  const [chatText, setChatText] = useState("");
  const [readCount, setReadCount] = useState(0);
  const chatScrollRef = useRef<ScrollView>(null);
  const messageCount = messages?.length ?? 0;
  useEffect(() => {
    if (chatOpen) setReadCount(messageCount);
  }, [chatOpen, messageCount]);
  const unreadCount = Math.max(0, messageCount - readCount);

  const handleSendChat = async () => {
    const text = chatText.trim();
    if (!text) return;
    setChatText("");
    try {
      await sendMessage({ pertemuanId, userId, name: displayName, text });
    } catch {}
  };

  const tiles = useMemo<Tile[]>(() => {
    const remoteParticipants = participants.filter(
      (p: MeetingParticipant) => p.sessionId !== sessionId
    );
    return [
      {
        key: sessionId,
        name: `${displayName} (Anda)`,
        stream: localPreviewStream,
        isLocal: true,
        micOn,
        camOn,
        screenOn,
        isHostTile: isHost,
      },
      ...remoteParticipants.map((p: MeetingParticipant) => ({
        key: p.sessionId,
        name: p.name,
        stream: remoteStreams[p.sessionId] ?? null,
        isLocal: false,
        micOn: p.micOn,
        camOn: p.camOn,
        screenOn: p.screenOn ?? false,
        isHostTile: p.isHost ?? false,
      })),
    ];
  }, [
    participants,
    sessionId,
    displayName,
    localPreviewStream,
    remoteStreams,
    micOn,
    camOn,
    screenOn,
    isHost,
  ]);

  const anyRecording =
    recState !== "idle" ||
    participants.some((p: MeetingParticipant) => p.recOn && p.sessionId !== sessionId);

  const handleLeave = async () => {
    // Jangan buang rekaman yang sedang berjalan: hentikan & simpan dulu.
    if (recState === "recording") {
      setLeaving(true);
      await stopRecording();
      setLeaving(false);
    }
    onLeave();
  };

  // ================= MODE MINI =================
  if (mode === "mini") {
    const firstRemote =
      tiles.find((t) => !t.isLocal && t.stream && t.camOn) ??
      tiles.find((t) => !t.isLocal && t.stream);
    const shown = firstRemote ?? tiles[0];
    return (
      <View style={st.miniContainer}>
        <Pressable style={{ flex: 1 }} onPress={onExpand}>
          {shown?.stream && shown.camOn ? (
            <VideoView
              stream={shown.stream}
              style={{ flex: 1 }}
              mirror={shown.isLocal && !shown.screenOn}
              muted={shown.isLocal}
              objectFit="cover"
            />
          ) : (
            <View style={st.miniAvatarWrap}>
              <View style={st.avatar}>
                <Text style={st.avatarText}>
                  {(shown?.name ?? "?").trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
          )}
          {anyRecording && (
            <View style={st.miniRecDot}>
              <Text style={st.recText}>REC</Text>
            </View>
          )}
          <View style={st.miniCountBadge}>
            <FontAwesome name="users" size={9} color="#fff" />
            <Text style={st.miniCountText}>{tiles.length}</Text>
          </View>
        </Pressable>
        <View style={st.miniControls}>
          <Pressable style={st.miniBtn} onPress={onExpand}>
            <FontAwesome name="expand" size={13} color="#fff" />
          </Pressable>
          <Pressable
            style={[st.miniBtn, !micOn && st.ctrlBtnOff]}
            onPress={toggleMic}
          >
            <FontAwesome
              name={micOn ? "microphone" : "microphone-slash"}
              size={13}
              color="#fff"
            />
          </Pressable>
          <Pressable style={[st.miniBtn, st.leaveBtnColor]} onPress={handleLeave}>
            <FontAwesome
              name="phone"
              size={13}
              color="#fff"
              style={{ transform: [{ rotate: "135deg" }] }}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // ================= MODE FULL =================
  const onGridLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setGridSize({ width, height });
  };

  // Grid adaptif; peserta yang share layar mendapat ubin selebar penuh.
  const hasScreenTile = tiles.some((t) => t.screenOn);
  const normalTiles = tiles.filter((t) => !t.screenOn).length;
  const columns = normalTiles <= 1 ? 1 : normalTiles <= 6 ? 2 : 3;
  const rows =
    Math.ceil(normalTiles / columns) + (hasScreenTile ? 0 : 0);
  const tileWidth = gridSize.width > 0 ? gridSize.width / columns : 0;
  const screenTileHeight = hasScreenTile ? gridSize.height * 0.55 : 0;
  const tileHeight =
    gridSize.height > 0
      ? Math.max(
          (gridSize.height - screenTileHeight) / Math.max(rows, 1),
          140
        )
      : 0;

  if (phase === "error") {
    return (
      <View style={[st.container, st.centerFill]}>
        <FontAwesome name="video-camera" size={40} color={Colors.error} />
        <Text style={st.errorTitle}>Gagal bergabung</Text>
        <Text style={st.errorText}>{errorMsg}</Text>
        <Pressable style={st.errorBtn} onPress={onLeave}>
          <Text style={st.errorBtnText}>Kembali</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {anyRecording && (
          <View style={st.recBadge}>
            <View style={st.recDotPulse} />
            <Text style={st.recText}>REC</Text>
          </View>
        )}
        <View style={st.headerBadge}>
          <FontAwesome name="users" size={11} color="#fff" />
          <Text style={st.headerBadgeText}>{tiles.length}</Text>
        </View>
        <Pressable style={st.headerBtn} onPress={onMinimize}>
          <FontAwesome name="compress" size={14} color="#fff" />
        </Pressable>
      </View>

      {/* Banner permintaan unmute dari ustadz */}
      {unmuteRequested && (
        <View style={st.unmuteBanner}>
          <FontAwesome name="microphone" size={14} color="#fff" />
          <Text style={st.unmuteBannerText}>
            Ustadz meminta Anda menyalakan mikrofon
          </Text>
          <Pressable style={st.unmuteAccept} onPress={acceptUnmute}>
            <Text style={st.unmuteAcceptText}>Nyalakan</Text>
          </Pressable>
          <Pressable onPress={dismissUnmute} hitSlop={8}>
            <FontAwesome name="times" size={14} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>
      )}

      {phase === "preparing" ? (
        <View style={st.centerFill}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={st.preparingText}>Menyiapkan kamera & mikrofon…</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={st.gridScroll}
            contentContainerStyle={st.gridContent}
            onLayout={onGridLayout}
          >
            <View style={st.grid}>
              {tiles.map((tile) => (
                <View
                  key={tile.key}
                  style={[
                    st.tile,
                    tileWidth > 0 &&
                      (tile.screenOn
                        ? { width: gridSize.width, height: screenTileHeight || 240 }
                        : { width: tileWidth, height: tileHeight }),
                  ]}
                >
                  {tile.stream && (tile.camOn || tile.screenOn) ? (
                    <VideoView
                      stream={tile.stream}
                      style={st.video}
                      mirror={tile.isLocal && !tile.screenOn}
                      muted={tile.isLocal}
                      objectFit={tile.screenOn ? "contain" : "cover"}
                    />
                  ) : (
                    <View style={st.avatarWrap}>
                      <View style={st.avatar}>
                        <Text style={st.avatarText}>
                          {tile.name.trim().charAt(0).toUpperCase() || "?"}
                        </Text>
                      </View>
                      {!tile.stream && !tile.isLocal && (
                        <Text style={st.connectingText}>Menghubungkan…</Text>
                      )}
                    </View>
                  )}

                  <View style={st.tileFooter}>
                    {!tile.micOn && (
                      <View style={st.micOffBadge}>
                        <FontAwesome
                          name="microphone-slash"
                          size={10}
                          color="#fff"
                        />
                      </View>
                    )}
                    {tile.screenOn && (
                      <FontAwesome name="desktop" size={10} color="#8BC34A" />
                    )}
                    <Text style={st.tileName} numberOfLines={1}>
                      {tile.isHostTile ? "★ " : ""}
                      {tile.name}
                    </Text>
                  </View>

                  {/* Kontrol host: mute / minta unmute peserta */}
                  {isHost && !tile.isLocal && (
                    <Pressable
                      style={st.hostMicBtn}
                      onPress={() =>
                        tile.micOn ? hostMute(tile.key) : hostRequestUnmute(tile.key)
                      }
                    >
                      <FontAwesome
                        name={tile.micOn ? "microphone-slash" : "microphone"}
                        size={12}
                        color="#fff"
                      />
                      <Text style={st.hostMicBtnText}>
                        {tile.micOn ? "Matikan" : "Minta bicara"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Panel chat */}
          {chatOpen && (
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={st.chatPanel}
            >
              <View style={st.chatHeader}>
                <Text style={st.chatTitle}>Chat</Text>
                <Pressable onPress={() => setChatOpen(false)} hitSlop={8}>
                  <FontAwesome name="times" size={16} color="#fff" />
                </Pressable>
              </View>
              <ScrollView
                ref={chatScrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={st.chatMessages}
                onContentSizeChange={() =>
                  chatScrollRef.current?.scrollToEnd({ animated: true })
                }
              >
                {(messages ?? []).map((m) => (
                  <View
                    key={m._id}
                    style={[
                      st.chatBubble,
                      m.userId === userId && st.chatBubbleOwn,
                    ]}
                  >
                    {m.userId !== userId && (
                      <Text style={st.chatSender}>{m.name}</Text>
                    )}
                    <Text style={st.chatText}>{m.text}</Text>
                  </View>
                ))}
                {(messages ?? []).length === 0 && (
                  <Text style={st.chatEmpty}>Belum ada pesan</Text>
                )}
              </ScrollView>
              <View style={st.chatInputRow}>
                <TextInput
                  style={st.chatInput}
                  value={chatText}
                  onChangeText={setChatText}
                  placeholder="Tulis pesan…"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  onSubmitEditing={handleSendChat}
                  returnKeyType="send"
                />
                <Pressable style={st.chatSendBtn} onPress={handleSendChat}>
                  <FontAwesome name="paper-plane" size={14} color="#fff" />
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      )}

      {/* Kontrol bawah */}
      <View style={[st.controls, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[st.ctrlBtn, !micOn && st.ctrlBtnOff]}
          onPress={toggleMic}
          disabled={phase !== "joined"}
        >
          <FontAwesome
            name={micOn ? "microphone" : "microphone-slash"}
            size={18}
            color="#fff"
          />
        </Pressable>
        <Pressable
          style={[st.ctrlBtn, !camOn && st.ctrlBtnOff]}
          onPress={toggleCam}
          disabled={phase !== "joined"}
        >
          <FontAwesome
            name={camOn ? "video-camera" : "eye-slash"}
            size={17}
            color="#fff"
          />
        </Pressable>
        {canSwitchCamera && (
          <Pressable
            style={st.ctrlBtn}
            onPress={switchCamera}
            disabled={phase !== "joined" || !camOn}
          >
            <FontAwesome name="refresh" size={17} color="#fff" />
          </Pressable>
        )}
        {canShareScreen && (
          <Pressable
            style={[st.ctrlBtn, screenOn && st.ctrlBtnActive]}
            onPress={toggleScreenShare}
            disabled={phase !== "joined"}
          >
            <FontAwesome name="desktop" size={16} color="#fff" />
          </Pressable>
        )}
        {isHost && canRecord && (
          <Pressable
            style={[st.ctrlBtn, recState === "recording" && st.ctrlBtnRec]}
            onPress={() =>
              recState === "recording" ? void stopRecording() : startRecording()
            }
            disabled={phase !== "joined" || recState === "uploading"}
          >
            {recState === "uploading" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome
                name={recState === "recording" ? "stop-circle" : "dot-circle-o"}
                size={18}
                color="#fff"
              />
            )}
          </Pressable>
        )}
        <Pressable
          style={st.ctrlBtn}
          onPress={() => setChatOpen((v) => !v)}
          disabled={phase !== "joined"}
        >
          <FontAwesome name="comments" size={17} color="#fff" />
          {unreadCount > 0 && !chatOpen && (
            <View style={st.chatBadge}>
              <Text style={st.chatBadgeText}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[st.ctrlBtn, st.leaveBtnColor]}
          onPress={handleLeave}
          disabled={leaving}
        >
          {leaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <FontAwesome
              name="phone"
              size={18}
              color="#fff"
              style={{ transform: [{ rotate: "135deg" }] }}
            />
          )}
        </Pressable>
      </View>

      {/* Overlay saat menyimpan rekaman menjelang keluar */}
      {leaving && (
        <View style={st.savingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={st.preparingText}>Menyimpan rekaman…</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111418" },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  headerTitle: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  headerBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(244,67,54,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  recDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
  },
  recText: { color: "#FF8A80", fontSize: 10, fontWeight: "800" },

  unmuteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  unmuteBannerText: { flex: 1, color: "#fff", fontSize: 12, fontWeight: "600" },
  unmuteAccept: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unmuteAcceptText: { color: Colors.primary, fontSize: 12, fontWeight: "800" },

  preparingText: { color: "rgba(255,255,255,0.8)", fontSize: 13 },

  gridScroll: { flex: 1 },
  gridContent: { flexGrow: 1 },
  grid: { flex: 1, flexDirection: "row", flexWrap: "wrap" },
  tile: {
    flexGrow: 1,
    minHeight: 140,
    backgroundColor: "#1C2128",
    borderWidth: 1,
    borderColor: "#111418",
    borderRadius: 10,
    overflow: "hidden",
  },
  video: { flex: 1, width: "100%", height: "100%" },
  avatarWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  connectingText: { color: "rgba(255,255,255,0.6)", fontSize: 11 },

  tileFooter: {
    position: "absolute",
    left: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: "85%",
  },
  micOffBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: { color: "#fff", fontSize: 11, fontWeight: "600" },

  hostMicBtn: {
    position: "absolute",
    right: 6,
    top: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  hostMicBtnText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  chatPanel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "80%",
    maxWidth: 320,
    backgroundColor: "#1A1F26",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.08)",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  chatTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  chatMessages: { padding: 12, gap: 8 },
  chatBubble: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chatBubbleOwn: {
    alignSelf: "flex-end",
    backgroundColor: Colors.primary,
  },
  chatSender: { color: "#8BC34A", fontSize: 10, fontWeight: "700", marginBottom: 2 },
  chatText: { color: "#fff", fontSize: 13, lineHeight: 18 },
  chatEmpty: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 13,
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  chatBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  chatBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 8,
    backgroundColor: "#111418",
  },
  ctrlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnOff: { backgroundColor: Colors.error },
  ctrlBtnActive: { backgroundColor: Colors.primary },
  ctrlBtnRec: { backgroundColor: Colors.error },
  leaveBtnColor: { backgroundColor: Colors.error },

  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  errorTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  errorText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  errorBtn: {
    marginTop: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  errorBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // ---- Mini mode ----
  miniContainer: { flex: 1, backgroundColor: "#111418" },
  miniAvatarWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C2128",
  },
  miniRecDot: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniCountBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniCountText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  miniControls: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingVertical: 6,
    backgroundColor: "#111418",
  },
  miniBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
});
