import { useLocalSearchParams } from "expo-router";
import MushafView from "@/components/MushafView";

export default function MushafScreen() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  const initialPage = page ? parseInt(page, 10) : 0;

  return <MushafView initialPage={initialPage} />;
}
