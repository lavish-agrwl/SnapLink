import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { HealthStatus } from "../types/api";

export function useHealth() {
  return useQuery<HealthStatus>({
    queryKey: ["health"],
    queryFn: api.getHealth,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
