"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { 
  HardDrive, 
  Monitor, 
  Smartphone, 
  ShieldCheck, 
  Copy, 
  Check, 
  ArrowLeft,
  Terminal,
  Info,
  ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useAuthStore } from "@/lib/store"
import { Wordmark } from "@/components/brand"

export default function ConnectPage() {
  const user = useAuthStore((s) => s.user)
  const [copied, setCopied] = React.useState<string | null>(null)

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(null), 2000)
  }

  const serverUrl = typeof window !== 'undefined' ? `${window.location.origin}/connect` : ''

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="absolute inset-0 bg-aurora opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-grid opacity-20 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/60 glass py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Wordmark />
          <Button variant="ghost" size="sm" asChild className="gap-2 rounded-full">
            <a href="/">
              <ArrowLeft className="size-4" />
              Back to Home
            </a>
          </Button>
        </div>
      </header>

      <main className="flex-1 relative z-10 container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center justify-center size-16 rounded-2xl bg-brand-gradient text-white shadow-xl shadow-brand/20 mb-6"
          >
            <HardDrive className="size-8" />
          </motion.div>
          <h1 className="text-4xl font-semibold tracking-tight mb-4">
            Connect to your <span className="text-gradient-brand">TriVE Vault</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Mount your Telegram-backed storage as a local drive on any device.
            Your files are decrypted on-the-fly and feel completely native.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="glass rounded-2xl p-6 border-brand/20 bg-brand/5">
            <div className="text-xs uppercase tracking-widest text-brand font-semibold mb-4">Step 1</div>
            <h3 className="text-sm font-semibold mb-2">Copy Credentials</h3>
            <p className="text-xs text-muted-foreground">Use the server URL and your TriVE credentials below.</p>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Step 2</div>
            <h3 className="text-sm font-semibold mb-2">Configure Client</h3>
            <p className="text-xs text-muted-foreground">Open your favorite WebDAV client (Explorer, Finder, Cyberduck).</p>
          </div>
          <div className="glass rounded-2xl p-6">
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Step 3</div>
            <h3 className="text-sm font-semibold mb-2">Access Files</h3>
            <p className="text-xs text-muted-foreground">Browse and edit your files directly from your file manager.</p>
          </div>
        </div>

        {/* Credentials Card */}
        <section className="glass-strong rounded-3xl p-6 md:p-8 mb-12 shadow-2xl border-brand/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <ShieldCheck className="size-32 text-brand" />
          </div>
          
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <ShieldCheck className="size-5 text-brand" />
            Connection Details
          </h2>

          <div className="space-y-6 max-w-2xl">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Server Address (WebDAV URL)</Label>
              <div className="flex gap-2">
                <Input readOnly value={serverUrl} className="font-mono bg-background/50 border-brand/20" />
                <Button variant="outline" size="icon" onClick={() => copy(serverUrl, 'url')}>
                  {copied === 'url' ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Username</Label>
                <div className="flex gap-2">
                  <Input readOnly value={user?.phone || "Your Phone Number"} className="font-mono bg-background/50 border-brand/20" />
                  <Button variant="outline" size="icon" onClick={() => copy(user?.phone || "", 'user')}>
                    {copied === 'user' ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                <Input readOnly value="Your Admin Password" title="Use the password you set during TriVE setup" className="font-mono bg-background/50 border-brand/20 italic text-muted-foreground" />
              </div>
            </div>
            
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
               <div className="flex items-start gap-3">
                 <Info className="size-4 text-amber-500 mt-0.5" />
                 <p className="text-[11px] text-amber-700 dark:text-amber-400">
                   <strong>Note:</strong> Most clients require <strong>Basic Authentication</strong>. 
                 </p>
               </div>
               <div className="text-[10px] text-amber-600/80 dark:text-amber-500/80 pl-7 border-t border-amber-500/10 pt-2">
                 <strong>Windows Tip:</strong> If connecting over HTTP (non-secure), Windows may require a registry change (Set <code className="bg-amber-500/10 px-1">BasicAuthLevel</code> to 2 in <code className="bg-amber-500/10 px-1">HKLM\SYSTEM\CurrentControlSet\Services\WebClient\Parameters</code>) or use a client like <strong>Cyberduck</strong>.
               </div>
            </div>
          </div>
        </section>

        {/* Guide Tabs */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">How to connect</h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
             <GuideCard 
               icon={Monitor} 
               title="Windows Explorer"
               instructions={[
                 "Open This PC in File Explorer",
                 "Right click → Add a network location",
                 "Paste the Server URL above",
                 "Enter your phone and admin password"
               ]}
             />
             <GuideCard 
               icon={Monitor} 
               title="macOS Finder"
               instructions={[
                 "In Finder, press ⌘ + K",
                 "Paste the Server URL above",
                 "Select 'Registered User'",
                 "Enter your phone and admin password"
               ]}
             />
             <GuideCard 
               icon={Terminal} 
               title="Linux (rclone/davfs2)"
               instructions={[
                 "rclone config → new remote",
                 "Type: webdav",
                 "URL: [Server URL]",
                 "Vendor: other"
               ]}
             />
             <GuideCard 
               icon={Smartphone} 
               title="iOS (Files App)"
               instructions={[
                 "Open Files → Browse tab",
                 "Tap (...) → Connect to Server",
                 "Paste the Server URL",
                 "Enter your credentials"
               ]}
             />
             <GuideCard 
               icon={Smartphone} 
               title="Android (Solid/Mix)"
               instructions={[
                 "Add New Cloud Storage",
                 "Select WebDAV",
                 "Enter URL and credentials",
                 "Enjoy native file access"
               ]}
             />
             <GuideCard 
               icon={ExternalLink} 
               title="Cyberduck / WinSCP"
               instructions={[
                 "New Connection",
                 "Select WebDAV (HTTPS)",
                 "Paste URL and credentials",
                 "Connect"
               ]}
             />
          </div>
        </div>
      </main>

      <footer className="py-8 border-t border-border/60 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TriVE. Secure File Management powered by Telegram MTProto.
        </p>
      </footer>
    </div>
  )
}

function GuideCard({ icon: Icon, title, instructions }: { icon: any, title: string, instructions: string[] }) {
  return (
    <div className="glass rounded-2xl p-5 border-border/40 hover:border-brand/40 transition-colors group">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-brand/10 group-hover:text-brand transition-colors">
          <Icon className="size-4" />
        </div>
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <ol className="space-y-2">
        {instructions.map((step, i) => (
          <li key={i} className="text-[11px] text-muted-foreground flex gap-2">
            <span className="font-mono text-brand/60 shrink-0">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
