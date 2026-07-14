import React from "react";
import CourseList from "@/components/CourseList";

export default function UlumulQuranScreen() {
  return (
    <CourseList
      type="ulumul_quran"
      title="Ulumul Qur'an"
      subtitle="Ilmu-ilmu tentang Al-Qur'an"
      loadingText="Memuat materi ulumul qur'an..."
      emptyDesc="Materi Ulumul Qur'an akan ditambahkan oleh admin"
    />
  );
}
