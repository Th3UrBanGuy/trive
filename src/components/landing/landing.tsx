"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Cloud,
  HardDrive,
  ShieldCheck,
  Scissors,
  FolderLock,
  Share2,
  UserCog,
  Menu,
  X,
  Sun,
  Moon,
  ArrowRight,
  Check,
  ChevronDown,
  Sparkles,
  Lock,
  Server,
  Zap,
  Download,
  WifiOff,
  MonitorSmartphone,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Wordmark, BrandMark } from "@/components/brand"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { InstallBanner } from "@/components/pwa/install-banner"
import { useInstallPromptState } from "@/components/pwa/use-install-prompt"
import { TectonicCredit } from "@/components/legal/tectonic-credit"
import { cn } from "@/lib/utils"

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="size-9" />
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="rounded-full"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#security", label: "Security" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
]

function Navbar({
  onLaunch,
  onInstall,
}: {
  onLaunch: () => void
  onInstall: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const { canInstall, iosInstall, installed } = useInstallPromptState()
  // The install icon button is meaningful only when an install path exists.
  const showInstallBtn = !installed && (canInstall || iosInstall)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled ? "py-2" : "py-3"
      )}
    >
      <div className="container mx-auto px-4">
        <div
          className={cn(
            "flex items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300",
            scrolled ? "glass-strong shadow-lg" : "bg-transparent"
          )}
        >
          <Wordmark />
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="link-underline relative px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {showInstallBtn && (
              <Button
                variant="outline"
                size="icon"
                onClick={onInstall}
                aria-label="Install TriVE app"
                title="Install TriVE app"
                className="btn-premium relative rounded-full border-brand/30 text-brand hover:bg-brand/10 hover:text-brand"
              >
                <Download className="size-4" />
              </Button>
            )}
            <Button onClick={onLaunch} className="btn-premium relative bg-brand-gradient rounded-full gap-1.5">
              Launch App
              <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              className="rounded-full"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="relative md:hidden mt-2 glass-strong rounded-2xl p-2"
            >
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2.5 text-sm rounded-md hover:bg-accent"
                >
                  {l.label}
                </a>
              ))}
              {showInstallBtn && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpen(false)
                    onInstall()
                  }}
                  className="w-full mt-2 rounded-full gap-1.5 border-brand/30 text-brand hover:bg-brand/10 hover:text-brand"
                >
                  <Download className="size-4" />
                  Install App
                </Button>
              )}
              <Button
                onClick={() => {
                  setOpen(false)
                  onLaunch()
                }}
                className="w-full mt-2 rounded-full"
              >
                Launch App
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

function HeroMockup() {
  const files = [
    { name: "Q4-Financials.pdf", color: "oklch(0.58 0.24 27)", icon: "📄" },
    { name: "wedding-final.mp4", color: "oklch(0.6 0.22 350)", icon: "🎬" },
    { name: "design-system.zip", color: "oklch(0.55 0.05 280)", icon: "🗜️" },
    { name: "vault-photos", color: "oklch(0.65 0.18 162)", icon: "📁" },
    { name: "podcast-ep-12.mp3", color: "oklch(0.62 0.18 70)", icon: "🎵" },
    { name: "thesis.docx", color: "oklch(0.55 0.16 220)", icon: "📝" },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: -10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      className="relative"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative glass-strong rounded-2xl p-3 shadow-2xl shadow-brand/10 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-destructive/70" />
            <span className="size-3 rounded-full bg-[oklch(0.7_0.19_70)]" />
            <span className="size-3 rounded-full bg-[oklch(0.65_0.18_162)]" />
          </div>
          <div className="text-xs text-muted-foreground">My Files</div>
          <div className="size-3" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.06 }}
              className="glass relative rounded-xl p-2.5 flex flex-col gap-1.5"
            >
              <div
                className="size-8 rounded-lg flex items-center justify-center text-sm"
                style={{
                  background: `color-mix(in oklch, ${f.color} 30%, transparent)`,
                }}
              >
                <span style={{ filter: "saturate(0)" }}>{f.icon}</span>
              </div>
              <div className="text-[10px] truncate font-medium">{f.name}</div>
              <div className="h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${40 + i * 12}%` }}
                />
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-3 px-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>2.4 GB used</span>
          <span className="inline-flex items-center gap-1 text-brand">
            <ShieldCheck className="size-3" />
            Encrypted
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Hero({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      {/* Slow-drifting brand orb behind the hero copy — a premium glow that breathes. */}
      <div
        aria-hidden
        className="animate-drift-slow absolute -top-32 -left-24 size-[36rem] rounded-full pointer-events-none opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, color-mix(in oklch, var(--brand) 26%, transparent), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="animate-drift-slow absolute -bottom-40 right-0 size-[34rem] rounded-full pointer-events-none opacity-40 blur-3xl"
        style={{ animationDelay: "-7s", background: "radial-gradient(circle at 60% 40%, color-mix(in oklch, var(--brand-cyan) 22%, transparent), transparent 65%)" }}
      />
      <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] pointer-events-none" />
      <div className="container mx-auto px-4 pt-16 md:pt-24 pb-12 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 rounded-full glass relative bg-noise px-3 py-1 text-xs mb-5"
            >
              <Sparkles className="size-3.5 text-brand" />
              <span className="text-muted-foreground">
                Secure file management powered by Telegram
              </span>
            </motion.div>
            <div className="eyebrow mb-3 hidden sm:block">Zero-knowledge cloud storage</div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="text-balance text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]"
            >
              Your Telegram,
              <br />
              now <span className="text-gradient-brand">infinite cloud storage</span>.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="text-pretty mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0"
            >
              TriVE combines 1-Click Telegram SSO with a zero-knowledge vault:
              files are AES-256-GCM encrypted and stored directly in your Telegram Bot Inbox.
              No SMS codes or passwords needed.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 flex flex-wrap gap-3 justify-center lg:justify-start"
            >
              <Button size="lg" className="btn-premium relative bg-brand-gradient rounded-full gap-2" onClick={onLaunch}>
                <Sparkles className="size-4" />
                Log In with Telegram SSO
                <ArrowRight className="size-4" />
              </Button>
              <a href="#how">
                <Button
                  size="lg"
                  variant="ghost"
                  className="rounded-full gap-2"
                >
                  See how it works
                  <ChevronDown className="size-4" />
                </Button>
              </a>
            </motion.div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroMockup />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="mt-14 flex flex-wrap items-center justify-center gap-2 md:gap-3"
        >
          {[
            { icon: HardDrive, label: "Unlimited storage" },
            { icon: Scissors, label: "2GB → 4GB auto-chunking" },
            { icon: ShieldCheck, label: "AES-256-GCM" },
            { icon: Lock, label: "Zero-knowledge" },
          ].map((p) => (
            <div
              key={p.label}
              className="glass relative bg-noise rounded-full px-4 py-1.5 text-xs md:text-sm inline-flex items-center gap-1.5 transition-colors hover:border-brand/30"
            >
              <p.icon className="size-3.5 text-brand" />
              {p.label}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

type Feature = {
  icon: React.ElementType
  title: string
  desc: string
  className?: string
  big?: boolean
}

const FEATURES: Feature[] = [
  {
    icon: HardDrive,
    title: "Unlimited storage",
    desc: "Telegram accounts have effectively unlimited cloud storage. Upload as much as your account can hold — no quotas, no plans.",
    className: "md:col-span-2",
    big: true,
  },
  {
    icon: ShieldCheck,
    title: "Zero-knowledge encryption",
    desc: "Files are AES-256-GCM encrypted in your browser with keys derived from your session. Telegram only ever sees ciphertext.",
  },
  {
    icon: Scissors,
    title: "Auto-chunking",
    desc: "Files larger than 2GB are split into encrypted chunks and reassembled transparently on download.",
  },
  {
    icon: FolderLock,
    title: "Private vault channel",
    desc: "TriVE creates a hidden, private channel per account. Your files are isolated in their own encrypted vault.",
  },
  {
    icon: Share2,
    title: "Share links",
    desc: "Generate password-protected, expiring links with optional download caps. Revoke any time.",
  },
  {
    icon: UserCog,
    title: "Bring your own account",
    desc: "Use your own Telegram account for unlimited encrypted storage. Your storage, your rules.",
  },
]

function Features() {
  return (
    <section id="features" className="container mx-auto px-4 py-20 md:py-28">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 rounded-full glass relative bg-noise px-3 py-1 text-xs mb-4">
          <Sparkles className="size-3.5 text-brand" />
          <span className="text-muted-foreground">Features</span>
        </div>
        <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight">
          A premium drive, powered by your Telegram
        </h2>
        <p className="text-pretty mt-4 text-muted-foreground">
          Every feature you&apos;d expect from a modern secure file manager — built
          on top of an account you already own.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.07, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "card-premium rounded-2xl p-6 flex flex-col gap-3 group cursor-default glass bg-noise",
              f.className
            )}
          >
            <div className="size-11 rounded-xl bg-brand/15 text-brand flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:bg-brand/20">
              <f.icon className="size-5" />
            </div>
            <div className="text-lg font-semibold">{f.title}</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {f.desc}
            </div>
            {f.big && (
              <div className="mt-auto pt-4 grid grid-cols-3 gap-2">
                {["2GB+ chunks", "AES-GCM", "BYOA"].map((b) => (
                  <div
                    key={b}
                    className="glass-panel rounded-lg p-2 text-[11px] text-center text-muted-foreground"
                  >
                    {b}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  )
}

const STEPS = [
  {
    n: "01",
    title: "Sign in with your Telegram phone number",
    desc: "We never see your password. Authentication is handled securely by Telegram.",
  },
  {
    n: "02",
    title: "We create your encrypted vault channel",
    desc: "TriVE provisions a private, hidden channel and stores your encrypted session at rest.",
  },
  {
    n: "03",
    title: "Upload, share, and stream",
    desc: "Files are encrypted in-browser, chunked, and streamed to your vault. Download on demand — your files, your account.",
  },
]

function HowItWorks() {
  return (
    <section id="how" className="container mx-auto px-4 py-20 md:py-28">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <div className="inline-flex items-center gap-2 rounded-full glass relative bg-noise px-3 py-1 text-xs mb-4">
          <Zap className="size-3.5 text-brand" />
          <span className="text-muted-foreground">How it works</span>
        </div>
        <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight">
          From phone number to infinite drive in 60 seconds
        </h2>
      </div>
      <div className="relative grid md:grid-cols-3 gap-5">
        <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="card-premium relative glass bg-noise rounded-2xl p-6 flex flex-col gap-3"
          >
            <div className="size-10 rounded-xl bg-brand-gradient text-brand-foreground flex items-center justify-center font-semibold text-sm shadow-md shadow-brand/20">
              {s.n}
            </div>
            <div className="text-base font-semibold">{s.title}</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {s.desc}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function Security() {
  return (
    <section id="security" className="container mx-auto px-4 py-20 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl glass-strong bg-noise p-8 md:p-12"
      >
        <div className="absolute inset-0 bg-aurora opacity-40 pointer-events-none" />
        <div className="grid md:grid-cols-2 gap-8 items-center relative">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full glass relative px-3 py-1 text-xs mb-4">
              <Lock className="size-3.5 text-brand" />
              <span className="text-muted-foreground">Zero-knowledge by design</span>
            </div>
            <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight">
              We can&apos;t read your files.{" "}
              <span className="text-gradient-brand">Neither can Telegram.</span>
            </h2>
            <p className="text-pretty mt-4 text-muted-foreground leading-relaxed">
              Files are encrypted with AES-256-GCM in your browser before they
              leave your device. The keys are derived from your session and
              never transmitted in plaintext. Telegram stores only ciphertext
              chunks — and your session is encrypted at rest with a
              server-side key derived from your account secret.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Client-side AES-256-GCM before upload",
                "Per-chunk IVs, authenticated encryption",
                "Session encrypted at rest",
                "No plaintext ever touches our servers",
              ].map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm">
                  <span className="size-5 rounded-full bg-brand/15 text-brand flex items-center justify-center mt-0.5">
                    <Check className="size-3" />
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="glass relative rounded-2xl p-6 font-mono text-[11px] leading-relaxed">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Server className="size-3.5" />
                vault/4f9c…2a8d.enc
              </div>
              <div className="space-y-1.5 text-muted-foreground">
                <div>
                  <span className="text-brand">salt</span> = sha256(session)
                </div>
                <div>
                  <span className="text-brand">key</span>  = HKDF(salt, pbkdf2(pw))
                </div>
                <div>
                  <span className="text-brand">iv</span>   = random(12B per chunk)
                </div>
                <div>
                  <span className="text-brand">enc</span>  = AES-256-GCM(key, iv, chunk)
                </div>
                <div className="pt-2 border-t border-border mt-2">
                  <span className="text-muted-foreground/60">{"// telegram sees:"}</span>
                </div>
                <div className="text-foreground/80">
                  9f3a 2b7c 8d1e 6f4a 0c5b 2d7e 8a1f 4c9b …
                </div>
                <div className="text-foreground/80">
                  a2f1 7e3d 0b6c 9d4f 1a8e 5b2c 7f3d 0a4b …
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

const FAQ_ITEMS = [
  {
    q: "Is it really unlimited storage?",
    a: "Practically, yes. Telegram accounts have effectively unlimited cloud storage. TriVE streams files into your own private vault channel — the practical ceiling is what your account can hold, which is far beyond any conventional plan.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Files are AES-256-GCM encrypted in your browser before they ever leave your device. Telegram only ever sees ciphertext. We never see your plaintext, and neither does Telegram.",
  },
  {
    q: "What are the file size limits?",
    a: "Telegram allows up to 2GB per message on free accounts and 4GB on Premium. TriVE auto-chunks larger files into encrypted pieces under that limit and reassembles them transparently on download.",
  },
  {
    q: "Do I need Telegram Premium?",
    a: "No. TriVE works on any Telegram account. Premium unlocks 4GB-per-chunk uploads (instead of 2GB), which means fewer chunks and faster transfers for very large files.",
  },
  {
    q: "What happens to my Telegram account?",
    a: "Nothing visible. TriVE creates a private hidden channel used only for storage. Your chats, groups, and contacts are untouched. You can revoke access and wipe the vault at any time from Settings.",
  },
  {
    q: "Can I share files with people who don't have TriVE?",
    a: "Yes. Generate a share link with optional password protection, expiry, and download limits. Anyone with the link can download the decrypted file through a public viewer — no account needed.",
  },
]

function Faq() {
  return (
    <section id="faq" className="container mx-auto px-4 py-20 md:py-28">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 rounded-full glass relative bg-noise px-3 py-1 text-xs mb-4">
          <Sparkles className="size-3.5 text-brand" />
          <span className="text-muted-foreground">FAQ</span>
        </div>
        <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight">
          Frequently asked questions
        </h2>
        <p className="text-pretty mt-4 text-muted-foreground">
          Everything you might want to know before you launch the app.
        </p>
      </div>
      <div className="max-w-3xl mx-auto glass relative bg-noise rounded-2xl p-2 md:p-4">
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="px-4 last:border-b-0"
            >
              <AccordionTrigger className="text-left text-base hover:no-underline">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

function InstallSection({ onInstall }: { onInstall: () => void }) {
  const { canInstall, iosInstall, installed } = useInstallPromptState()
  // Once installed, this section morphs into a quiet "installed" state.
  const ready = !installed && (canInstall || iosInstall)

  return (
    <section id="install" className="container mx-auto px-4 py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl glass-strong bg-noise p-8 md:p-12"
      >
        <div className="absolute inset-0 bg-aurora opacity-30 pointer-events-none" />
        <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 md:gap-8 items-center relative">
          {/* Icon */}
          <div className="size-14 rounded-2xl bg-brand-gradient text-brand-foreground flex items-center justify-center shadow-lg shadow-brand/25">
            <MonitorSmartphone className="size-7" />
          </div>

          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full glass relative px-3 py-1 text-xs mb-3">
              <Download className="size-3.5 text-brand" />
              <span className="text-muted-foreground">Progressive Web App</span>
            </div>
            <h2 className="text-balance text-2xl md:text-3xl font-semibold tracking-tight">
              Install TriVE as an app
            </h2>
            <p className="text-pretty mt-2 text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl">
              Install TriVE as an app — works offline, opens in its own window,
              and feels native. Your vault is one tap away, right on your home
              screen.
            </p>
          </div>

          {/* CTA */}
          <div className="md:flex-shrink-0">
            {installed ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-4 py-2 text-sm font-medium text-brand">
                <Check className="size-4" />
                Installed
              </div>
            ) : ready ? (
              <Button
                size="lg"
                onClick={onInstall}
                className="btn-premium relative rounded-full gap-2 bg-brand-gradient hover:opacity-95"
              >
                <Download className="size-4" />
                Install App
              </Button>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full glass relative px-4 py-2 text-xs text-muted-foreground">
                <WifiOff className="size-3.5" />
                Available on most browsers
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function FinalCTA({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="container mx-auto px-4 py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl p-10 md:p-16 text-center"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-deep), var(--brand), var(--brand-cyan))",
        }}
      >
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        {/* Soft top highlight for depth. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(180deg, color-mix(in oklch, white 14%, transparent), transparent 40%)" }}
        />
        <div className="relative">
          <BrandMark size={56} className="mx-auto mb-6 rounded-2xl" />
          <h2 className="text-balance text-3xl md:text-5xl font-semibold tracking-tight max-w-3xl mx-auto">
            Ready to turn Telegram into your{" "}
            <span className="text-brand-foreground">infinite drive?</span>
          </h2>
          <p className="text-pretty mt-4 text-brand-foreground/80 max-w-xl mx-auto">
            Launch TriVE, sign in with your Telegram number, and start
            uploading in under a minute.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="btn-premium relative mt-8 rounded-full gap-2"
            onClick={onLaunch}
          >
            <Cloud className="size-4" />
            Launch TriVE
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </motion.div>
    </section>
  )
}

function Footer() {
  const goLegal = (page: "legal" | "terms" | "privacy" | "disclaimer" | "contact") => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("page", page)
      window.location.href = url.pathname + url.search
    } catch {
      window.location.href = `/?page=${page}`
    }
  }
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <Wordmark />
            <p className="text-pretty mt-4 text-sm text-muted-foreground max-w-xs">
              Zero-knowledge cloud storage powered by your own Telegram account.
              Encrypted in your browser. Stored as ciphertext.
            </p>
          </div>
          <div>
            <div className="eyebrow mb-3">Product</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#features" className="link-underline relative hover:text-foreground">
                  Features
                </a>
              </li>
              <li>
                <a href="#security" className="link-underline relative hover:text-foreground">
                  Security
                </a>
              </li>
              <li>
                <a href="#how" className="link-underline relative hover:text-foreground">
                  How it works
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">Resources</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#faq" className="link-underline relative hover:text-foreground">
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="https://core.telegram.org/mtproto"
                  target="_blank"
                  rel="noreferrer"
                  className="link-underline relative hover:text-foreground"
                >
                  Learn more
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => goLegal("contact")}
                  className="link-underline relative hover:text-foreground text-left"
                >
                  Contact
                </button>
              </li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">Legal</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button
                  type="button"
                  onClick={() => goLegal("terms")}
                  className="link-underline relative hover:text-foreground text-left"
                >
                  Terms
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => goLegal("privacy")}
                  className="link-underline relative hover:text-foreground text-left"
                >
                  Privacy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => goLegal("disclaimer")}
                  className="link-underline relative hover:text-foreground text-left"
                >
                  Disclaimer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => goLegal("legal")}
                  className="link-underline relative hover:text-foreground text-left"
                >
                  Legal overview
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border/60 text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <span>© {new Date().getFullYear()} TriVE ·</span>
            <TectonicCredit prefix="Built by" />
          </div>
          <div>
            Powered by Telegram. Built by Tectonic.
          </div>
        </div>
      </div>
    </footer>
  )
}

export function Landing({
  onLaunch,
  onInstall,
}: {
  onLaunch: () => void
  onInstall: () => void
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onLaunch={onLaunch} onInstall={onInstall} />
      <main className="flex-1">
        <Hero onLaunch={onLaunch} />
        <Features />
        <HowItWorks />
        <InstallSection onInstall={onInstall} />
        <Security />
        <Faq />
        <FinalCTA onLaunch={onLaunch} />
      </main>
      <Footer />
      {/* Floating install banner — appears only when installable / iOS */}
      <InstallBanner />
    </div>
  )
}
