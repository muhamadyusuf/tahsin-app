import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Colors } from "@/lib/constants";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_DATA = [
  {
    question: "Bagaimana cara memulai tilawah?",
    answer:
      "Buka tab Tilawah di halaman utama, pilih surah yang ingin dibaca, lalu mulai membaca. Anda juga bisa membuka Mushaf untuk tampilan halaman penuh.",
  },
  {
    question: "Apa itu Tahsin?",
    answer:
      "Tahsin adalah program perbaikan bacaan Al-Qur'an. Anda bisa mempelajari materi tajwid melalui video dan kuis interaktif di tab Tahsin.",
  },
  {
    question: "Bagaimana cara mengikuti sesi Talaqi?",
    answer:
      "Hubungi admin lembaga pengajian Anda untuk didaftarkan. Setelah terdaftar, jadwal talaqi dengan ustadz akan muncul di tab Talaqi.",
  },
  {
    question: "Bagaimana cara bergabung dengan lembaga pengajian?",
    answer:
      "Buka menu Profil > Lembaga Pengajian untuk melihat daftar lembaga yang tersedia. Hubungi admin lembaga terkait untuk mendaftar.",
  },
  {
    question: "Apakah aplikasi ini gratis?",
    answer:
      "Ya, aplikasi Tahsin sepenuhnya gratis untuk digunakan. Kami berkomitmen untuk memudahkan semua orang dalam belajar Al-Qur'an.",
  },
  {
    question: "Bagaimana cara mengganti qari/suara bacaan?",
    answer:
      "Saat membaca surah atau mushaf, tekan ikon pengaturan audio untuk memilih qari yang Anda inginkan dari 10 qari yang tersedia.",
  },
];

export default function BantuanScreen() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(expanded === index ? null : index);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header info */}
      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <FontAwesome name="life-ring" size={28} color={Colors.primary} />
        </View>
        <Text style={styles.infoTitle}>Pusat Bantuan</Text>
        <Text style={styles.infoDesc}>
          Temukan jawaban untuk pertanyaan umum atau hubungi kami jika butuh
          bantuan lebih lanjut.
        </Text>
      </View>

      {/* FAQ */}
      <Text style={styles.sectionTitle}>Pertanyaan Umum (FAQ)</Text>
      <View style={styles.faqList}>
        {FAQ_DATA.map((faq, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqItem}
            onPress={() => toggleFaq(index)}
            activeOpacity={0.7}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <FontAwesome
                name={expanded === index ? "chevron-up" : "chevron-down"}
                size={14}
                color={Colors.textSecondary}
              />
            </View>
            {expanded === index && (
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Contact */}
      <Text style={styles.sectionTitle}>Hubungi Kami</Text>
      <View style={styles.contactCard}>
        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => Linking.openURL("mailto:support@tahsin.singkat.in")}
        >
          <View style={[styles.contactIcon, { backgroundColor: "#E3F2FD" }]}>
            <FontAwesome name="envelope" size={18} color="#1565C0" />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={styles.contactValue}>support@tahsin.singkat.in</Text>
          </View>
          <FontAwesome
            name="external-link"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => Linking.openURL("https://tahsin.singkat.in")}
        >
          <View style={[styles.contactIcon, { backgroundColor: "#E8F5E9" }]}>
            <FontAwesome name="globe" size={18} color={Colors.primary} />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactLabel}>Website</Text>
            <Text style={styles.contactValue}>tahsin.singkat.in</Text>
          </View>
          <FontAwesome
            name="external-link"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  infoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 6,
  },
  infoDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 12,
  },
  faqList: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  faqItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 10,
  },
  contactCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
});
