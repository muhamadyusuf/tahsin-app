import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, Text } from "react-native";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: string },
      ) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;

interface ReCaptchaContextType {
  loaded: boolean;
  getToken: (action: string) => Promise<string | null>;
}

const ReCaptchaContext = createContext<ReCaptchaContextType>({
  loaded: false,
  getToken: async () => null,
});

const RECAPTCHA_HIDE_BADGE_CSS = `.grecaptcha-badge { visibility: hidden !important; display: none !important; }`;

function hideBadge() {
  const badge = document.querySelector<HTMLElement>(".grecaptcha-badge");
  if (badge) {
    badge.style.setProperty("display", "none", "important");
    badge.style.setProperty("visibility", "hidden", "important");
  }
}

export function ReCaptchaProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(Platform.OS !== "web");
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !RECAPTCHA_SITE_KEY) {
      setLoaded(true);
      return;
    }

    if (window.grecaptcha) {
      setLoaded(true);
      return;
    }

    const style = document.createElement("style");
    style.textContent = RECAPTCHA_HIDE_BADGE_CSS;
    document.head.appendChild(style);

    hideBadge();
    const target = document.body ?? document.documentElement;
    const mo = new MutationObserver(() => hideBadge());
    mo.observe(target, { childList: true, subtree: true });

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      hideBadge();
      setLoaded(true);
    };
    document.head.appendChild(script);

    return () => {
      mo.disconnect();
      if (script.parentNode) script.parentNode.removeChild(script);
      if (style.parentNode) style.parentNode.removeChild(style);
    };
  }, []);

  const getToken = useCallback(
    async (action: string): Promise<string | null> => {
      if (Platform.OS !== "web" || !window.grecaptcha || !RECAPTCHA_SITE_KEY) {
        return null;
      }

      return new Promise((resolve) => {
        window.grecaptcha!.ready(() => {
          window
            .grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action })
            .then(resolve);
        });
      });
    },
    [],
  );

  return (
    <ReCaptchaContext.Provider value={{ loaded, getToken }}>
      {children}
    </ReCaptchaContext.Provider>
  );
}

export function RecaptchaAttribution() {
  if (Platform.OS !== "web") return null;

  return (
    <Text
      style={{
        fontSize: 10,
        color: "#999",
        textAlign: "center",
        marginTop: 14,
        lineHeight: 14,
      }}
    >
      Halaman ini dilindungi oleh reCAPTCHA dan{" "}
      <Text
        style={{ color: "#666" }}
        onPress={() =>
          window.open("https://policies.google.com/privacy", "_blank")
        }
      >
        Kebijakan Privasi
      </Text>{" "}
      serta{" "}
      <Text
        style={{ color: "#666" }}
        onPress={() =>
          window.open("https://policies.google.com/terms", "_blank")
        }
      >
        Persyaratan Layanan
      </Text>{" "}
      Google berlaku.
    </Text>
  );
}

export function useReCaptcha() {
  return useContext(ReCaptchaContext);
}
