import React from "react";
import CourseList from "@/components/CourseList";

export default function FiqihScreen() {
  return (
    <CourseList
      type="fiqih"
      title="Fiqih"
      subtitle="Hukum-hukum dalam Islam"
      loadingText="Memuat materi fiqih..."
      emptyDesc="Materi Fiqih akan ditambahkan oleh admin"
    />
  );
}
