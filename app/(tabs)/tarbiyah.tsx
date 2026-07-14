import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Colors } from "@/lib/constants";
import { useAuthContext } from "@/lib/auth-context";

type CourseType = "tahsin" | "ulumul_quran" | "fiqih";

type Course = {
  type: CourseType;
  route:
    | "/tarbiyah/tahsin"
    | "/tarbiyah/ulumul-quran"
    | "/tarbiyah/fiqih";
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
  bg: string;
};

const COURSES: Course[] = [
  {
    type: "tahsin",
    route: "/tarbiyah/tahsin",
    title: "Tahsin",
    subtitle: "Pedoman Dauroh Al-Qur'an",
    icon: "graduation-cap",
    color: "#1565C0",
    bg: "#E3F2FD",
  },
  {
    type: "ulumul_quran",
    route: "/tarbiyah/ulumul-quran",
    title: "Ulumul Qur'an",
    subtitle: "Ilmu-ilmu tentang Al-Qur'an",
    icon: "lightbulb-o",
    color: "#C62828",
    bg: "#FFEBEE",
  },
  {
    type: "fiqih",
    route: "/tarbiyah/fiqih",
    title: "Fiqih",
    subtitle: "Hukum-hukum dalam Islam",
    icon: "balance-scale",
    color: "#00695C",
    bg: "#E0F2F1",
  },
];

function CourseCard({
  course,
  completedIds,
}: {
  course: Course;
  completedIds: Set<Id<"materi">>;
}) {
  const router = useRouter();
  const materiList = useQuery(api.materi.list, { type: course.type });

  const totalCount = materiList?.length ?? 0;
  const completedCount = materiList
    ? materiList.filter((m) => completedIds.has(m._id)).length
    : 0;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(course.route)}
    >
      <View style={[styles.iconBox, { backgroundColor: course.bg }]}>
        <FontAwesome name={course.icon} size={24} color={course.color} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{course.title}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {course.subtitle}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%`, backgroundColor: course.color },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {materiList === undefined
            ? "Memuat..."
            : `${completedCount} dari ${totalCount} BAB selesai`}
        </Text>
      </View>
      <FontAwesome
        name="chevron-right"
        size={16}
        color={Colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

export default function TarbiyahScreen() {
  const { userData } = useAuthContext();
  const userProgress = useQuery(
    api.quiz.getUserProgress,
    userData?._id ? { userId: userData._id } : "skip"
  );

  const completedIds = new Set(
    (userProgress ?? [])
      .filter((p) => p.completedAt)
      .map((p) => p.materiId)
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Program Tarbiyah</Text>
        <Text style={styles.headerSubtitle}>
          Pilih program pembelajaran yang ingin Anda ikuti
        </Text>
      </View>

      {COURSES.map((course) => (
        <CourseCard
          key={course.type}
          course={course}
          completedIds={completedIds}
        />
      ))}
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
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 5,
  },
});
