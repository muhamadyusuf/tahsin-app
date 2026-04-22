import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";

export default function MateriFormScreen() {
  const { id, type, parentId } = useLocalSearchParams<{
    id?: string;
    type?: string;
    parentId?: string;
  }>();
  const router = useRouter();
  const isEdit = !!id;

  const existing = useQuery(
    api.materi.getById,
    id ? { id: id as Id<"materi"> } : "skip"
  );

  const createMateri = useMutation(api.materi.create);
  const updateMateri = useMutation(api.materi.update);

  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [seq, setSeq] = useState("1");
  const [urlCover, setUrlCover] = useState("");
  const [urlVideo, setUrlVideo] = useState("");
  const [isShow, setIsShow] = useState(true);
  const [materiType, setMateriType] = useState<"tahsin" | "ulumul_quran">(
    (type as any) ?? "tahsin"
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (existing) {
      setJudul(existing.judul);
      setDeskripsi(existing.deskripsi ?? "");
      setSeq(String(existing.seq));
      setUrlCover(existing.urlCover ?? "");
      setUrlVideo(existing.urlVideo ?? "");
      setIsShow(existing.isShow);
      setMateriType(existing.type);
    }
  }, [existing]);

  const handleSubmit = async () => {
    if (!judul.trim()) {
      Alert.alert("Error", "Judul materi wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateMateri({
          id: id as Id<"materi">,
          judul: judul.trim(),
          deskripsi: deskripsi.trim() || undefined,
          seq: parseFloat(seq) || 1,
          urlCover: urlCover.trim() || undefined,
          urlVideo: urlVideo.trim() || undefined,
          isShow,
        });
        Alert.alert("Berhasil", "Materi berhasil diperbarui.");
      } else {
        await createMateri({
          judul: judul.trim(),
          deskripsi: deskripsi.trim() || undefined,
          seq: parseFloat(seq) || 1,
          parentId: parentId ? (parentId as Id<"materi">) : undefined,
          urlCover: urlCover.trim() || undefined,
          urlVideo: urlVideo.trim() || undefined,
          isShow,
          type: materiType,
        });
        Alert.alert("Berhasil", "Materi berhasil ditambahkan.");
      }
      router.back();
    } catch {
      Alert.alert("Error", "Gagal menyimpan materi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isEdit && !existing) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={st.heading}>
        {isEdit ? "Edit Materi" : "Tambah Materi Baru"}
      </Text>

      {!isEdit && parentId && (
        <View style={st.infoBadge}>
          <FontAwesome name="sitemap" size={12} color={Colors.info} />
          <Text style={st.infoBadgeText}>Mode Sub-bab: materi baru akan dibuat di bawah BAB/Sub-bab terpilih</Text>
        </View>
      )}

      {!isEdit && (
        <>
          <Text style={st.label}>Tipe Materi</Text>
          <View style={st.typeRow}>
            <Pressable
              style={[st.typeBtn, materiType === "tahsin" && st.typeBtnActive]}
              onPress={() => setMateriType("tahsin")}
            >
              <Text
                style={[
                  st.typeBtnText,
                  materiType === "tahsin" && st.typeBtnTextActive,
                ]}
              >
                Tahsin
              </Text>
            </Pressable>
            <Pressable
              style={[
                st.typeBtn,
                materiType === "ulumul_quran" && st.typeBtnActive,
              ]}
              onPress={() => setMateriType("ulumul_quran")}
            >
              <Text
                style={[
                  st.typeBtnText,
                  materiType === "ulumul_quran" && st.typeBtnTextActive,
                ]}
              >
                Ulumul Quran
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <Text style={st.label}>Judul *</Text>
      <TextInput
        style={st.input}
        value={judul}
        onChangeText={setJudul}
        placeholder="Judul materi"
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={st.label}>Deskripsi</Text>
      <TextInput
        style={[st.input, { height: 80, textAlignVertical: "top" }]}
        value={deskripsi}
        onChangeText={setDeskripsi}
        placeholder="Deskripsi materi (opsional)"
        placeholderTextColor={Colors.textSecondary}
        multiline
      />

      <Text style={st.label}>Urutan (Seq)</Text>
      <TextInput
        style={st.input}
        value={seq}
        onChangeText={setSeq}
        keyboardType="numeric"
        placeholder="1"
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={st.label}>URL Cover Image</Text>
      <TextInput
        style={st.input}
        value={urlCover}
        onChangeText={setUrlCover}
        placeholder="https://..."
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
      />

      <Text style={st.label}>URL Video</Text>
      <TextInput
        style={st.input}
        value={urlVideo}
        onChangeText={setUrlVideo}
        placeholder="https://..."
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="none"
      />

      <View style={st.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.label}>Tampilkan Materi</Text>
          <Text style={st.switchHint}>
            {isShow ? "Materi terlihat oleh pengguna" : "Materi tersembunyi"}
          </Text>
        </View>
        <Switch
          value={isShow}
          onValueChange={setIsShow}
          trackColor={{ false: "#ddd", true: Colors.primaryLight }}
          thumbColor={isShow ? Colors.primary : "#f4f3f4"}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          st.submitBtn,
          pressed && { opacity: 0.85 },
          submitting && { opacity: 0.5 },
        ]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <FontAwesome name="check" size={16} color="#fff" />
            <Text style={st.submitBtnText}>
              {isEdit ? "Simpan Perubahan" : "Tambah Materi"}
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 20,
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E8F2FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  infoBadgeText: {
    flex: 1,
    fontSize: 12,
    color: Colors.info,
    fontWeight: "600",
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeBtnText: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  typeBtnTextActive: { color: "#fff" },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  submitBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
