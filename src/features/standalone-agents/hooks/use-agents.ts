"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export function useUserAgents() {
  const trpc = useTRPC();
  const query = useQuery(trpc.standaloneAgents.list.queryOptions());

  return {
    agents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
