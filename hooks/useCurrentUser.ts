import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@injured/backend/convex/_generated/api";
import type { Doc } from "@injured/backend/convex/_generated/dataModel";

type CurrentUserDoc = Doc<"users"> | null | undefined;

export function useCurrentUser(): {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: CurrentUserDoc;
} {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.data.users.current) as CurrentUserDoc;

  const isUserLoading = user === undefined || (isAuthenticated && user === null);

  return {
    isLoading: isAuthLoading || isUserLoading,
    isAuthenticated: isAuthenticated && user !== null,
    user,
  };
}


