import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import React, { type ReactNode } from "react";
import { AuthContextProvider } from "../context/auth-context";
import { NotificationsProvider } from "../context/notification-context";
import { OfflineContextProvider } from "../context/offline-context";
import { persistOptions, queryClient } from "./react-query";
export function Providers({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <AuthContextProvider>
        <NotificationsProvider>
          <OfflineContextProvider>{children}</OfflineContextProvider>
        </NotificationsProvider>
      </AuthContextProvider>
    </PersistQueryClientProvider>
  );
}
