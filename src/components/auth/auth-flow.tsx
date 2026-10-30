"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { z } from "zod"
import { toast } from "sonner"
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Loader2,
  Lock,
  Phone,
  QrCode as QrIcon,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  CheckCircle2,
} from "lucide-react"
import { QRCodeSvg } from "@/components/ui/qr-code"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Wordmark, BrandMark } from "@/components/brand"
import { useAuthStore } from "@/lib/store"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { SignInResponse, User } from "@/lib/types"

type AuthTab = "sso" | "phone"
type Step = "phone" | "otp" | "2fa"

const phoneSchema = z.object({
  phone: z
    .string()
    .min(8, "Enter a valid phone number")
    .regex(/^\+?\d[\d\s-]+$/, "Use digits only, with optional + prefix"),
})

export function AuthFlow({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = React.useState<AuthTab>("sso")
  const [busy, setBusy] = React.useState(false)
  const [standalone, setStandalone] = React.useState(false)
  const [botUsername, setBotUsername] = React.useState<string>(
    process.env.NEXT_PUBLIC_BOT_USERNAME || "Trive_Storage_bot"
  )

  // QR Code + Deep-link Auth state
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string | null>(null)
  const [qrLoading, setQrLoading] = React.useState(false)
  const [waitingBotAuth, setWaitingBotAuth] = React.useState(false)
  const [deepLinkUrl, setDeepLinkUrl] = React.useState<string | null>(null)
  const pollTimerRef = React.useRef<any>(null)

  // Phone flow state (legacy secondary)
  const [step, setStep] = React.useState<Step>("phone")
  const [phone, setPhone] = React.useState("+880")
  const [phoneCodeHash, setPhoneCodeHash] = React.useState("")
  const [code, setCode] = React.useState("")
  const [password, setPassword] = React.useState("")

  const setUser = useAuthStore((s) => s.setUser)

  // Initialize QR Code session on load
  const initQrAuth = React.useCallback(async () => {
    setQrLoading(true)
    try {
      const res = await api.createBotAuthLink()
      setQrCodeUrl(res.deepLink)
      setDeepLinkUrl(res.deepLink)
      setWaitingBotAuth(true)

      // Start polling for this authKey
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await api.pollBotAuth(res.authKey)
          if (pollRes.confirmed && pollRes.user) {
            clearInterval(pollTimerRef.current)
            setWaitingBotAuth(false)
            setUser(pollRes.user)
            toast.success(`Welcome to TriVE, ${pollRes.user.name || "Explorer"}!`)
          }
        } catch {}
      }, 2000)
    } catch (err: any) {
      console.error("Failed to load QR link:", err)
    } finally {
      setQrLoading(false)
    }
  }, [setUser])

  React.useEffect(() => {
    if (tab === "sso") {
      initQrAuth()
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [tab, initQrAuth])

  // Detect standalone (installed PWA)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia?.("(display-mode: standalone)")
    const navStandalone = (navigator as unknown as { standalone?: boolean }).standalone
    if (mql?.matches || navStandalone === true) {
      setStandalone(true)
    }
  }, [])

  // Probe server status to check bot username if not set in NEXT_PUBLIC_
  React.useEffect(() => {
    let cancelled = false
    api.telegramStatus().then((status) => {
      if (!cancelled && status.botUsername) {
        setBotUsername(status.botUsername)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // 1. Detect Telegram Mini App WebApp (Instant 0-click login)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const tg = (window as any).Telegram?.WebApp
    if (tg?.initData) {
      tg.ready?.()
      tg.expand?.()
      setBusy(true)
      api.telegramWebApp(tg.initData)
        .then((res) => {
          setUser(res.user)
          toast.success(`Welcome, ${res.user.name || "Explorer"}!`)
        })
        .catch((err) => {
          console.warn("[webapp-sso] initData login failed:", err)
        })
        .finally(() => {
          setBusy(false)
        })
    }
  }, [setUser])



  // Deep-Link Bot Auth (100% domain-free for localhost and any IP)
  const handleStartBotAuth = async () => {
    setBusy(true)
    try {
      const res = await api.createBotAuthLink()
      setDeepLinkUrl(res.deepLink)
      setWaitingBotAuth(true)

      // Open bot link in a new window/tab
      window.open(res.deepLink, "_blank", "noopener,noreferrer")
      toast.info("Opened Telegram!", {
        description: `Click 'START' in @${res.botUsername} to complete login.`,
      })

      // Start polling for user confirmation
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await api.pollBotAuth(res.authKey)
          if (pollRes.confirmed && pollRes.user) {
            clearInterval(pollTimerRef.current)
            setWaitingBotAuth(false)
            setUser(pollRes.user)
            toast.success(`Welcome to TriVE, ${pollRes.user.name || "Explorer"}!`)
          }
        } catch {}
      }, 2000)
    } catch (err: any) {
      toast.error("Failed to generate bot login link", {
        description: err?.message || String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  React.useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // Quick dev/demo login
  const handleQuickLogin = async () => {
    setBusy(true)
    try {
      const demoUser = {
        id: `user_${Math.floor(100000 + Math.random() * 900000)}`,
        first_name: "TriVE",
        last_name: "User",
        username: "trive_member",
      }
      const res = await api.telegramDevLogin(demoUser)
      setUser(res.user)
      toast.success("Signed in successfully with Telegram SSO!")
    } catch (err: any) {
      toast.error("Login failed", { description: err?.message || String(err) })
    } finally {
      setBusy(false)
    }
  }

  // Legacy Phone Flow Handlers
  async function onSendCode() {
    const parsed = phoneSchema.safeParse({ phone })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid phone")
      return
    }
    const cleaned = parsed.data.phone.replace(/\s|-/g, "")
    setPhone(cleaned)
    setBusy(true)
    try {
      const res = await api.sendCode(cleaned)
      setPhoneCodeHash(res.phoneCodeHash)
      setStep("otp")
      toast.success("Code sent via Telegram")
    } catch (err: any) {
      toast.error("Couldn't send code", { description: err?.message || String(err) })
    } finally {
      setBusy(false)
    }
  }

  async function onVerify() {
    if (code.length < 5) {
      toast.error("Enter the full code")
      return
    }
    setBusy(true)
    try {
      const res = (await api.signIn(phone, code, phoneCodeHash)) as unknown as SignInResponse
      setUser(res.user)
      toast.success("Welcome to TriVE")
    } catch (err: any) {
      const msg = err?.message || ""
      if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("2fa")) {
        setStep("2fa")
      } else {
        toast.error("Verification failed", { description: msg })
      }
    } finally {
      setBusy(false)
    }
  }

  async function onUnlock() {
    if (!password) return
    setBusy(true)
    try {
      const res = (await api.signIn(phone, code, phoneCodeHash, password)) as unknown as SignInResponse
      setUser(res.user)
      toast.success("Vault unlocked")
    } catch (err: any) {
      toast.error("2FA failed", { description: err?.message || "Invalid cloud password" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

      <header className="relative z-10 p-4 flex items-center justify-between">
        <Wordmark className="opacity-90" />
        {!standalone && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full gap-1.5"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
        )}
      </header>

      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="relative glass-strong rounded-3xl p-7 md:p-9 shadow-2xl shadow-brand/10 border border-brand/15">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative flex items-center justify-center mb-4">
                <div className="absolute inset-0 rounded-full blur-xl bg-brand/30" />
                <BrandMark size={52} className="rounded-2xl relative shadow-lg" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                Sign in to <span className="text-gradient-brand">TriVE</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Zero-Knowledge Encrypted Cloud Drive backed by Telegram Bot Inbox
              </p>
            </div>

            {/* SSO / Phone Tab Toggle */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl mb-6 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTab("sso")}
                className={cn(
                  "py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                  tab === "sso"
                    ? "bg-background shadow-sm text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <QrIcon className="size-3.5 text-brand" />
                Scan QR Code
              </button>
              <button
                type="button"
                onClick={() => setTab("phone")}
                className={cn(
                  "py-2 rounded-lg transition-all flex items-center justify-center gap-1.5",
                  tab === "phone"
                    ? "bg-background shadow-sm text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Phone className="size-3.5" />
                Phone OTP
              </button>
            </div>

            <AnimatePresence mode="wait">
              {tab === "sso" ? (
                <motion.div
                  key="sso"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* Hero: QR Code Scan Card */}
                  <div className="flex flex-col items-center justify-center p-5 bg-card/60 backdrop-blur-md rounded-2xl border border-brand/20 shadow-xl shadow-brand/5 relative">
                    <div className="relative p-3 bg-white rounded-xl shadow-sm border border-border/40">
                      {qrLoading ? (
                        <div className="w-[180px] h-[180px] flex flex-col items-center justify-center gap-2">
                          <Loader2 className="size-7 animate-spin text-brand" />
                          <span className="text-[11px] text-muted-foreground">Generating QR…</span>
                        </div>
                      ) : qrCodeUrl ? (
                        <div className="relative">
                          <QRCodeSvg value={qrCodeUrl} size={180} color="#0f172a" bgColor="#ffffff" />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="p-1 bg-white rounded-full shadow-md">
                              <BrandMark size={28} className="rounded-full" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-[180px] h-[180px] flex flex-col items-center justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={initQrAuth}>
                            <RefreshCw className="size-3.5 mr-1" /> Reload QR
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5 text-center space-y-1">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Scan with Phone Camera or Telegram
                      </div>
                      <p className="text-[11px] text-muted-foreground max-w-[260px] leading-relaxed">
                        Point your camera at this QR code, open Telegram, and tap <strong>START</strong> to log in instantly.
                      </p>
                    </div>
                  </div>

                  {/* 1-Tap Action for same-device login */}
                  {deepLinkUrl && (
                    <Button
                      type="button"
                      className="w-full h-11 rounded-xl gap-2 font-medium bg-[#229ED9] hover:bg-[#1E88E5] text-white shadow-md shadow-[#229ED9]/20"
                      onClick={() => window.open(deepLinkUrl, "_blank")}
                    >
                      <Send className="size-4" />
                      Open @{botUsername} Directly
                    </Button>
                  )}

                  {/* 1-Click Demo / Quick Login */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    disabled={busy}
                    onClick={handleQuickLogin}
                  >
                    <UserCheck className="size-3.5 mr-1.5" />
                    Quick Instant Demo Login
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {step === "phone" && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-xs">Phone number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            autoComplete="tel"
                            inputMode="tel"
                            placeholder="+880 1XXX-XXXXXX"
                            className="pl-9 h-11"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        className="w-full h-11 rounded-xl gap-2"
                        disabled={busy}
                        onClick={onSendCode}
                      >
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Send Code via Telegram
                      </Button>
                    </div>
                  )}

                  {step === "otp" && (
                    <div className="space-y-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        Enter the code sent to <span className="font-semibold text-foreground">{phone}</span>
                      </p>
                      <div className="flex justify-center my-3">
                        <OtpInput value={code} onChange={setCode} length={5} />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep("phone")}>
                          Change
                        </Button>
                        <Button className="flex-[2] h-11 rounded-xl gap-1.5" disabled={busy || code.length < 5} onClick={onVerify}>
                          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                          Verify
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === "2fa" && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="password">Telegram Cloud Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Your 2FA password"
                          className="h-11"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      <Button className="w-full h-11 rounded-xl" disabled={busy || !password} onClick={onUnlock}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : "Unlock"}
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 pt-5 border-t border-border/50 text-center">
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-brand" />
                Zero-knowledge encrypted. Chunks stored in Bot Inbox.
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <Wordmark className="justify-center opacity-70" />
          </div>
        </motion.div>
      </main>
    </div>
  )
}

function OtpInput({
  value,
  onChange,
  length,
}: {
  value: string
  onChange: (v: string) => void
  length: number
}) {
  return (
    <InputOTP maxLength={length} value={value} onChange={onChange} autoFocus>
      <InputOTPGroup>
        {Array.from({ length }).map((_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className={cn("size-11 text-base first:rounded-l-lg last:rounded-r-lg")}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
