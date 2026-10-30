"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

/**
 * Storage analytics — polled every 5s so the sidebar StorageCard and the
 * Storage view stay live (instant reflection of uploads / deletes).
 * staleTime: 0 so every refetch hits the server.
 */
export function useStorage() {
  return useQuery({
    queryKey: ["storage"],
    queryFn: () => api.storage(),
    staleTime: 0,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Telegram MTProto status — polled every 15s. Lower frequency than other
 * queries because the value rarely changes during a session.
 */
export function useTelegramStatus() {
  return useQuery({
    queryKey: ["telegram-status"],
    queryFn: () => api.telegramStatus(),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })
}
