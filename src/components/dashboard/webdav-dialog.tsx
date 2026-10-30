"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { HardDrive, Monitor, Apple, Smartphone, Terminal, Check, Copy, Shield, Cloud } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/lib/store"

interface WebdavDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WebdavDialog({ open, onOpenChange }: WebdavDialogProps) {
  const user = useAuthStore((s) => s.user)
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)
  const [hostUrl, setHostUrl] = React.useState("https://trive.app")

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setHostUrl(window.location.origin)
    }
  }, [])

  const webdavUrl = `${hostUrl}/api/dav`
  const username = user?.telegramUsername || user?.phone || user?.telegramId || "your-username"

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const windowsCmd = `net use T: "${webdavUrl}" /user:${username} * /persistent:yes`
  const rcloneConfig = `[trive]
type = webdav
url = ${webdavUrl}
vendor = other
user = ${username}
pass = <your-admin-password>`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-brand/20 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="p-6 pb-4 shrink-0 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <HardDrive className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Mount as Local Network Drive
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                  WebDAV Native
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Access all your TriVE files directly inside Windows File Explorer, macOS Finder, or Mobile without opening a browser.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {/* Connection Summary Card */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-2.5">
            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Cloud className="size-3.5 text-brand" />
              Your Universal WebDAV Endpoint
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-background font-mono text-xs text-foreground border border-border overflow-x-auto select-all">
                {webdavUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 h-9"
                onClick={() => copyToClipboard(webdavUrl, "url")}
              >
                {copiedKey === "url" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                Copy URL
              </Button>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
              <span><strong>Username:</strong> {username}</span>
              <span><strong>Password:</strong> Your Account Password</span>
              <span><strong>Encryption:</strong> AES-256-GCM Zero-Knowledge</span>
            </div>
          </div>

          {/* OS Selector Tabs */}
          <Tabs defaultValue="windows" className="w-full">
            <TabsList className="grid grid-cols-4 w-full h-10 p-1 bg-muted/50 rounded-lg">
              <TabsTrigger value="windows" className="gap-1.5 text-xs font-medium">
                <Monitor className="size-3.5" />
                Windows
              </TabsTrigger>
              <TabsTrigger value="macos" className="gap-1.5 text-xs font-medium">
                <Apple className="size-3.5" />
                macOS
              </TabsTrigger>
              <TabsTrigger value="mobile" className="gap-1.5 text-xs font-medium">
                <Smartphone className="size-3.5" />
                Android & iOS
              </TabsTrigger>
              <TabsTrigger value="rclone" className="gap-1.5 text-xs font-medium">
                <Terminal className="size-3.5" />
                Rclone
              </TabsTrigger>
            </TabsList>

            {/* Windows Tab */}
            <TabsContent value="windows" className="space-y-4 pt-3">
              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground">Option 1: Instant Command Prompt (1-Click Mount)</p>
                <div className="flex items-center gap-2">
                  <pre className="flex-1 p-3 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-[11px] overflow-x-auto select-all">
                    {windowsCmd}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-10"
                    onClick={() => copyToClipboard(windowsCmd, "cmd")}
                  >
                    {copiedKey === "cmd" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
                <p className="pt-2 font-semibold text-foreground">Option 2: Native File Explorer GUI</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Open <strong>This PC</strong> in File Explorer.</li>
                  <li>Click <strong>...</strong> menu at the top $\rightarrow$ Select <strong>Map network drive</strong>.</li>
                  <li>Choose drive letter (e.g. <code>T:</code>) and paste the URL above.</li>
                  <li>Check <em>"Connect using different credentials"</em> $\rightarrow$ Click Finish and log in.</li>
                </ol>
              </div>
            </TabsContent>

            {/* macOS Tab */}
            <TabsContent value="macos" className="space-y-3 pt-3 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground">Native macOS Finder Integration</p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1">
                <li>Open <strong>Finder</strong> on your Mac.</li>
                <li>Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Cmd + K</kbd> (or select <strong>Go $\rightarrow$ Connect to Server</strong>).</li>
                <li>In the Server Address field, paste: <code>{webdavUrl}</code></li>
                <li>Click <strong>Connect</strong> $\rightarrow$ Choose <strong>Registered User</strong>.</li>
                <li>Enter your username and password, then check <em>"Remember this password in my keychain"</em>.</li>
                <li><strong>Result:</strong> TriVE mounts directly on your Desktop and in Finder's sidebar Locations!</li>
              </ol>
            </TabsContent>

            {/* Mobile Tab */}
            <TabsContent value="mobile" className="space-y-3 pt-3 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground">Mobile File Manager Support (Android & iOS)</p>
              <p>You can connect TriVE directly into your smartphone without opening the web browser:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-1">
                <li><strong>Android:</strong> Install <em>Solid Explorer</em> or <em>CX File Explorer</em> $\rightarrow$ Tap <strong>Add Storage</strong> $\rightarrow$ Select <strong>WebDAV</strong> $\rightarrow$ Paste your URL and log in.</li>
                <li><strong>iOS / iPhone:</strong> Install <em>Documents by Readdle</em> or <em>FE File Explorer</em> $\rightarrow$ Tap <strong>+ Add Connection</strong> $\rightarrow$ Choose <strong>WebDAV Server</strong>.</li>
              </ul>
              <p className="pt-1 text-[11px] text-brand">Enjoy high-speed media streaming and instant photo backup from your phone!</p>
            </TabsContent>

            {/* Rclone Tab */}
            <TabsContent value="rclone" className="space-y-3 pt-3 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground">Rclone Virtual Drive Mount</p>
              <p>Mount TriVE with full local disk caching on Linux, Mac, or Windows:</p>
              <div className="flex items-center gap-2">
                <pre className="flex-1 p-3 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-[11px] overflow-x-auto select-all">
                  {rcloneConfig}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-10"
                  onClick={() => copyToClipboard(rcloneConfig, "rclone")}
                >
                  {copiedKey === "rclone" ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
              <p className="font-mono text-[11px]">Command: <code>rclone mount trive: Z: --vfs-cache-mode full</code></p>
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-4 bg-muted/20 border-t border-border/40 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Shield className="size-3.5 text-brand" />
            Zero-Knowledge: All streaming is client-decrypted on the fly.
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
