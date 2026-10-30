import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://trive.app"),
  title: {
    default: "TriVE — Secure File Management",
    template: "%s · TriVE",
  },
  description:
    "TriVE turns your Telegram account into a zero-knowledge, end-to-end encrypted, virtually unlimited cloud vault. Secure file management powered by Telegram MTProto. Bring your own account. We bring the vault.",
  applicationName: "TriVE",
  creator: "Tectonic",
  publisher: "Tectonic",
  keywords: [
    "TriVE",
    "Telegram",
    "Cloud Storage",
    "Zero-knowledge",
    "AES-256-GCM",
    "MTProto",
    "End-to-end encryption",
    "Secure file management",
  ],
  authors: [{ name: "Tectonic", url: "https://tect0nic.com" }],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TriVE",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "TriVE — Secure File Management powered by Telegram",
    description:
      "Turn your Telegram account into a zero-knowledge, encrypted, infinite cloud vault with TriVE.",
    siteName: "TriVE",
    type: "website",
    url: "https://trive.app",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "TriVE — Secure File Management powered by Telegram",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TriVE — Secure File Management powered by Telegram",
    description:
      "Turn your Telegram account into a zero-knowledge, encrypted, infinite cloud vault with TriVE.",
    images: ["/icon-512.png"],
  },
}

export const viewport: Viewport = {
  themeColor: "#ebeff2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA / mobile meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TriVE" />
        <meta name="apple-mobile-web-app-subtitle" content="Secure File Management" />
        <meta name="application-name" content="TriVE" />
        <meta name="msapplication-TileColor" content="#ebeff2" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <SonnerToaster position="bottom-right" richColors closeButton expand={false} duration={4000} style={{ "--width": "380px" } as React.CSSProperties} />
        </ThemeProvider>
      </body>
    </html>
  )
}
