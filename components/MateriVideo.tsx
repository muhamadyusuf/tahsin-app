import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ResizeMode, Video } from "expo-av";
import { Colors } from "@/lib/constants";
import { extractYouTubeId } from "@/lib/youtube";
import YouTubePlayer from "@/components/YouTubePlayer";

interface Props {
  url: string;
}

// Menampilkan video materi langsung di halaman (inline). Untuk YouTube: tampil
// thumbnail dengan tombol play, ditekan → player diputar. Untuk link video
// langsung (mp4, dst.): pemutar dengan kontrol native, tinggal play.
export default function MateriVideo({ url }: Props) {
  const youTubeId = extractYouTubeId(url);
  const [playing, setPlaying] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <FontAwesome name="play-circle" size={16} color={Colors.primary} />
        <Text style={styles.headerText}>Video Penjelasan</Text>
      </View>

      <View style={styles.frame}>
        {youTubeId ? (
          playing ? (
            <YouTubePlayer videoId={youTubeId} style={styles.player} />
          ) : (
            <Pressable
              style={styles.thumbWrap}
              onPress={() => setPlaying(true)}
            >
              <Image
                source={{
                  uri: `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`,
                }}
                style={styles.thumb}
                resizeMode="cover"
              />
              <View style={styles.playOverlay}>
                <View style={styles.playButton}>
                  <FontAwesome name="play" size={22} color="#fff" />
                </View>
              </View>
            </Pressable>
          )
        ) : (
          <Video
            source={{ uri: url }}
            style={styles.player}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            onError={() => {}}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  frame: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  player: { flex: 1, backgroundColor: "#000" },
  thumbWrap: { flex: 1 },
  thumb: { width: "100%", height: "100%" },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 4,
  },
});
