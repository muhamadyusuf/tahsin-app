import React from "react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL as string
);

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string;

if (!publishableKey) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
