import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
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

    scriptRef.current = document.createElement("script");
    scriptRef.current.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    scriptRef.current.async = true;
    scriptRef.current.defer = true;
    scriptRef.current.onload = () => setLoaded(true);
    document.head.appendChild(scriptRef.current);

    return () => {
      if (scriptRef.current) {
        document.head.removeChild(scriptRef.current);
      }
    };
  }, []);

  const getToken = useCallback(async (action: string): Promise<string | null> => {
    if (Platform.OS !== "web" || !window.grecaptcha || !RECAPTCHA_SITE_KEY) {
      return null;
    }

    return new Promise((resolve) => {
      window.grecaptcha!.ready(() => {
        window.grecaptcha!
          .execute(RECAPTCHA_SITE_KEY, { action })
          .then(resolve);
      });
    });
  }, []);

  return (
    <ReCaptchaContext.Provider value={{ loaded, getToken }}>
      {children}
    </ReCaptchaContext.Provider>
  );
}

export function useReCaptcha() {
  return useContext(ReCaptchaContext);
}
