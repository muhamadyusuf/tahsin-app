import { Link, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet } from 'react-native';

import TrapPage from '@/components/TrapPage';
import { Text, View } from '@/components/Themed';
import { useAuthContext } from '@/lib/auth-context';
import { isDecoyPath } from '@/lib/trap-paths';

// Alamat umpan (mis. /wp-admin) ditangani halaman perangkap; selain itu 404 biasa.
export default function NotFoundScreen() {
  const pathname = usePathname();
  if (Platform.OS === 'web' && isDecoyPath(pathname)) {
    return <TrapGate pathname={pathname} />;
  }
  return <PlainNotFound />;
}

// Administrator/pengelola sah yang tak sengaja membuka alamat umpan tidak
// dicatat sebagai penyusup — mereka melihat 404 biasa.
function TrapGate({ pathname }: { pathname: string }) {
  const { isLoading, isAdmin } = useAuthContext();
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }
  if (isAdmin) return <PlainNotFound />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TrapPage path={pathname} />
    </>
  );
}

function PlainNotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: '#2e78b7',
  },
});
