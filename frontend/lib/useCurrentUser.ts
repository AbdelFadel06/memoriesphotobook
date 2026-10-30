"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ApiError } from "./api";
import { fetchMe } from "./auth";

export const ME_QUERY_KEY = ["me"] as const;

/** Current user for pages behind login; sends the visitor to /login when the session is gone. */
export function useCurrentUser() {
  const router = useRouter();
  const query = useQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe, retry: false });
  const unauthorized = query.error instanceof ApiError && query.error.status === 401;

  useEffect(() => {
    if (unauthorized) router.replace("/login");
  }, [unauthorized, router]);

  return { ...query, unauthorized };
}
