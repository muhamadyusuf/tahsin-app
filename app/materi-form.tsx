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
import MarkdownRenderer from "@/components/MarkdownRenderer";

const MD_CHEATSHEET = `# Heading 1
## Heading 2
### Heading 3

Teks biasa. **tebal** atau *miring*

> Blockquote / kutipan penting

- Item daftar pertama
- Item daftar kedua

1. Nomor satu
2. Nomor dua

\`kode inline\`

---`;

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
  const [mdTab, setMdTab] = useState<"edit" | "preview">("edit");
  const [showCheatsheet, setShowCheatsheet] = useState(false);

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
      keyboardShouldPersistTaps="handled"
    >
      <Text style={st.heading}>
        {isEdit ? "Edit Materi" : "Tambah Materi Baru"}
      </Text>

      {!isEdit && parentId && (
        <View style={st.infoBadge}>
          <FontAwesome name="sitemap" size={12} color={Colors.info} />
          <Text style={st.infoBadgeText}>
            Mode Sub-bab: materi baru akan dibuat di bawah BAB/Sub-bab terpilih
          </Text>
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

      {/* Markdown editor with live preview */}
      <View style={st.mdSection}>
        {/* Header row */}
        <View style={st.mdHeader}>
          <Text style={st.label}>Konten Materi (Markdown)</Text>
          <Pressable
            style={st.cheatsheetBtn}
            onPress={() => setShowCheatsheet((v) => !v)}
          >
            <FontAwesome name="question-circle" size={14} color={Colors.primary} />
            <Text style={st.cheatsheetBtnText}>
              {showCheatsheet ? "Tutup" : "Panduan MD"}
            </Text>
          </Pressable>
        </View>

        {/* Cheatsheet panel */}
        {showCheatsheet && (
          <View style={st.cheatsheetPanel}>
            <Text style={st.cheatsheetTitle}>Panduan Format Markdown</Text>
            <View style={st.cheatsheetGrid}>
              {[
                { input: "# Judul 1", result: "Heading besar" },
                { input: "## Judul 2", result: "Heading sedang" },
                { input: "**teks**", result: "Teks tebal" },
                { input: "*teks*", result: "Teks miring" },
                { input: "> teks", result: "Kutipan/penting" },
                { input: "- item", result: "Daftar bullet" },
                { input: "1. item", result: "Daftar angka" },
                { input: "`kode`", result: "Kode inline" },
                { input: "---", result: "Garis pemisah" },
              ].map((r) => (
                <View key={r.input} style={st.cheatsheetRow}>
                  <Text style={st.cheatsheetCode}>{r.input}</Text>
                  <Text style={st.cheatsheetArrow}>→</Text>
                  <Text style={st.cheatsheetResult}>{r.result}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Editor / Preview tabs */}
        <View style={st.tabBar}>
          <Pressable
            style={[st.tab, mdTab === "edit" && st.tabActive]}
            onPress={() => setMdTab("edit")}
          >
            <FontAwesome
              name="pencil"
              size={13}
              color={mdTab === "edit" ? Colors.primary : Colors.textSecondary}
            />
            <Text
              style={[st.tabText, mdTab === "edit" && st.tabTextActive]}
            >
              Editor
            </Text>
          </Pressable>
          <Pressable
            style={[st.tab, mdTab === "preview" && st.tabActive]}
            onPress={() => setMdTab("preview")}
          >
            <FontAwesome
              name="eye"
              size={13}
              color={
                mdTab === "preview" ? Colors.primary : Colors.textSecondary
              }
            />
            <Text
              style={[st.tabText, mdTab === "preview" && st.tabTextActive]}
            >
              Preview
            </Text>
          </Pressable>
        </View>

        {mdTab === "edit" ? (
          <TextInput
            style={st.mdInput}
            value={deskripsi}
            onChangeText={setDeskripsi}
            placeholder={`Tulis konten materi dalam format Markdown...\n\nContoh:\n# Pendahuluan\n\nIlmu tajwid adalah...\n\n## Definisi\n\nTajwid berarti...`}
            placeholderTextColor={Colors.textSecondary}
            multiline
            autoCorrect={false}
            autoCapitalize="sentences"
            textAlignVertical="top"
          />
        ) : (
          <View style={st.previewBox}>
            {deskripsi.trim().length === 0 ? (
              <View style={st.previewEmpty}>
                <FontAwesome
                  name="file-text-o"
                  size={28}
                  color={Colors.textSecondary}
                />
                <Text style={st.previewEmptyText}>
                  Belum ada konten — tulis di tab Editor
                </Text>
              </View>
            ) : (
              <MarkdownRenderer content={deskripsi} />
            )}
          </View>
        )}

        <Text style={st.mdHint}>
          {deskripsi.length > 0
            ? `${deskripsi.length} karakter`
            : "Kosong — isi konten materi di atas"}
        </Text>
      </View>

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

  // Markdown editor section
  mdSection: {
    marginTop: 14,
  },
  mdHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cheatsheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
  },
  cheatsheetBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  cheatsheetPanel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  cheatsheetTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 10,
  },
  cheatsheetGrid: {
    gap: 6,
  },
  cheatsheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cheatsheetCode: {
    width: 100,
    fontFamily: "monospace",
    fontSize: 12,
    color: Colors.primaryDark,
    backgroundColor: "#F0F4F0",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cheatsheetArrow: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cheatsheetResult: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 8,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 7,
  },
  tabActive: {
    backgroundColor: Colors.primaryLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  mdInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 260,
    fontFamily: "monospace",
    lineHeight: 22,
  },
  previewBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    minHeight: 180,
  },
  previewEmpty: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  previewEmptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  mdHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "right",
    marginTop: 4,
  },

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

