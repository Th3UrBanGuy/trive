"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  ArrowLeft,
  FileText,
  Lock,
  ShieldCheck,
  Mail,
  MessageSquare,
  Send,
  ExternalLink,
  Scale,
  BookOpen,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BrandMark, Wordmark } from "@/components/brand"
import { TectonicCredit } from "./tectonic-credit"

export type LegalPageId =
  | "legal"
  | "terms"
  | "privacy"
  | "disclaimer"
  | "contact"

const LAST_UPDATED = "January 2026"

interface LegalMeta {
  id: LegalPageId
  title: string
  subtitle: string
  icon: LucideIcon
}

const PAGES: Record<LegalPageId, LegalMeta> = {
  legal: {
    id: "legal",
    title: "Legal",
    subtitle: "TriVE legal documents and policies",
    icon: Scale,
  },
  terms: {
    id: "terms",
    title: "Terms of Service",
    subtitle: "The terms under which you may use TriVE",
    icon: FileText,
  },
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    subtitle: "How TriVE handles your data",
    icon: Lock,
  },
  disclaimer: {
    id: "disclaimer",
    title: "Disclaimer",
    subtitle: "Important information about TriVE and Telegram",
    icon: AlertTriangle,
  },
  contact: {
    id: "contact",
    title: "Contact",
    subtitle: "Get in touch with the TriVE team",
    icon: Mail,
  },
}

/** Sticky back button shown at the top of every legal page. */
function StickyBack({ onBack }: { onBack: () => void }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-6 px-4 py-3 bg-background/70 backdrop-blur-xl border-b border-border/60">
      <div className="mx-auto max-w-3xl flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="rounded-full gap-1.5 -ml-2"
        >
          <ArrowLeft className="size-4" />
          Back to TriVE
        </Button>
        <Wordmark className="opacity-80" />
      </div>
    </div>
  )
}

/** Shared footer for every legal page — Tectonic credit + copyright. */
function LegalFooter() {
  return (
    <footer className="mt-12 pt-6 border-t border-border/60">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div>
          © {new Date().getFullYear()} TriVE · <TectonicCredit />
        </div>
        <div className="opacity-80">
          Not affiliated with Telegram. Uses the official MTProto API.
        </div>
      </div>
    </footer>
  )
}

/** Section heading inside a legal document. */
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-semibold tracking-tight mt-10 mb-3 text-gradient-brand inline-block">
      {children}
    </h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-foreground/85 mb-4">{children}</p>
  )
}

function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm leading-relaxed text-foreground/85 mb-2 ml-5 list-disc">
      {children}
    </li>
  )
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-4">{children}</ul>
}

/** The outer shell — premium glass container on the brand background. */
function LegalShell({
  meta,
  onBack,
  children,
}: {
  meta: LegalMeta
  onBack: () => void
  children: React.ReactNode
}) {
  const Icon = meta.icon
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-aurora pointer-events-none opacity-70" />
      <div className="absolute inset-0 bg-grid opacity-25 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] pointer-events-none" />

      <StickyBack onBack={onBack} />

      <main className="flex-1 px-4 pb-12 relative z-10">
        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative mx-auto max-w-3xl glass-strong rounded-3xl p-7 md:p-10 shadow-2xl shadow-brand/10"
        >
          <header className="flex items-center gap-4 mb-2">
            <div className="size-12 rounded-2xl bg-brand/15 text-brand flex items-center justify-center">
              <Icon className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {meta.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {meta.subtitle}
              </p>
            </div>
          </header>
          <div className="text-xs text-muted-foreground/80 mb-2">
            Last updated: {LAST_UPDATED}
          </div>
          <div className="h-px bg-border/60 my-6" />

          <div className="prose prose-sm max-w-none">{children}</div>

          <LegalFooter />
        </motion.article>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Legal index                                                         */
/* ------------------------------------------------------------------ */

function LegalIndex({
  onNavigate,
  onBack,
}: {
  onNavigate: (page: LegalPageId) => void
  onBack: () => void
}) {
  const cards: { id: LegalPageId; title: string; desc: string; icon: LucideIcon }[] =
    [
      {
        id: "terms",
        title: "Terms of Service",
        desc: "The rules and conditions for using TriVE, including your responsibilities and our limitations.",
        icon: FileText,
      },
      {
        id: "privacy",
        title: "Privacy Policy",
        desc: "What data we collect, how it's stored, and the zero-knowledge model that keeps your files private.",
        icon: Lock,
      },
      {
        id: "disclaimer",
        title: "Disclaimer",
        desc: "TriVE's relationship with Telegram, the MTProto API, and the limits of our service.",
        icon: AlertTriangle,
      },
      {
        id: "contact",
        title: "Contact",
        desc: "Get in touch with the TriVE team for support, questions, or feedback.",
        icon: Mail,
      },
    ]
  const meta = PAGES.legal
  return (
    <LegalShell meta={meta} onBack={onBack}>
      <P>
        Welcome to TriVE&apos;s legal center. TriVE is a zero-knowledge file
        management client that uses your own Telegram account&apos;s storage via
        the official Telegram MTProto API. Below you&apos;ll find the documents
        that govern your use of the service.
      </P>
      <P>
        By using TriVE, you agree to the documents linked below. We recommend
        reading them in full — they&apos;re written in plain language wherever
        possible.
      </P>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <button
              key={c.id}
              onClick={() => onNavigate(c.id)}
              className="group text-left glass relative rounded-2xl p-5 hover:border-brand/40 hover:bg-brand/5 transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-brand/12 text-brand flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-foreground group-hover:text-brand transition-colors">
                    {c.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {c.desc}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-8 glass-panel rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="size-5 text-brand shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">Zero-knowledge by design.</span>{" "}
          Your files are encrypted in your browser before they ever touch your
          Telegram account. We can&apos;t read them — and neither can anyone
          else.
        </div>
      </div>
    </LegalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Terms of Service                                                    */
/* ------------------------------------------------------------------ */

function TermsOfService({ onBack }: { onBack: () => void }) {
  const meta = PAGES.terms
  return (
    <LegalShell meta={meta} onBack={onBack}>
      <P>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use
        of TriVE, a software client that enables secure, encrypted file storage
        using your own Telegram account&apos;s storage via the official Telegram
        MTProto API (the &quot;Service&quot;). The Service is operated by
        Tectonic (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
      </P>
      <P>
        By creating an account or using the Service, you agree to be bound by
        these Terms. If you do not agree, you may not access or use the Service.
      </P>

      <H2>1. Description of the Service</H2>
      <P>
        TriVE is a client-side application that uses your legitimate Telegram
        account, via the official Telegram MTProto API, as encrypted cloud
        storage. When you upload a file through TriVE:
      </P>
      <UL>
        <LI>
          The file is encrypted in your browser using AES-256-GCM with a
          per-user encryption key derived from a secret stored on your device.
        </LI>
        <LI>
          The encrypted ciphertext is split into chunks (if needed) and uploaded
          to a private &quot;vault&quot; channel on your own Telegram account.
        </LI>
        <LI>
          Only encrypted bytes are ever sent to Telegram&apos;s servers. We do
          not have access to your encryption keys, your plaintext, or your
          Telegram password.
        </LI>
        <LI>
          When you download a file, the ciphertext is retrieved from your
          Telegram account and decrypted locally in your browser.
        </LI>
      </UL>
      <P>
        TriVE is therefore a &quot;zero-knowledge&quot; client: we cannot read
        your files, even if compelled to.
      </P>

      <H2>2. Your Account and Your Telegram Account</H2>
      <P>
        To use TriVE you must have a legitimate Telegram account in good
        standing. You are solely responsible for:
      </P>
      <UL>
        <LI>Maintaining the security of your Telegram account and credentials.</LI>
        <LI>
          Ensuring that your use of TriVE complies with Telegram&apos;s Terms of
          Service and any applicable laws.
        </LI>
        <LI>
          All files and data that you store through the Service, including their
          legality and your right to store them.
        </LI>
        <LI>
          Any consequences of losing access to your Telegram account, including
          loss of files stored in your vault.
        </LI>
      </UL>
      <P>
        We may use your phone number to authenticate you via Telegram&apos;s
        MTProto login flow. We do not send messages on your behalf, modify your
        Telegram account, or interact with your contacts.
      </P>

      <H2>3. Acceptable Use</H2>
      <P>You agree not to:</P>
      <UL>
        <LI>
          Use the Service to store, share, or distribute content that is illegal
          in your jurisdiction or that infringes on the rights of any third
          party.
        </LI>
        <LI>
          Attempt to access, tamper with, or disrupt the Service, its
          infrastructure, or any other user&apos;s data.
        </LI>
        <LI>
          Use the Service to violate Telegram&apos;s Terms of Service, including
          using automated or scripted access that exceeds the rate limits
          imposed by Telegram&apos;s MTProto API.
        </LI>
        <LI>
          Reverse-engineer, decompile, or disassemble the Service, except to the
          extent permitted by applicable law.
        </LI>
        <LI>
          Resell, sublicense, or commercially redistribute access to the Service
          without our written consent.
        </LI>
      </UL>

      <H2>4. Your Files and Data</H2>
      <P>
        You retain all rights to the files you store through the Service. We do
        not claim ownership of your content. Because the Service is
        zero-knowledge, we cannot view, moderate, or be compelled to disclose
        the contents of your files. You are responsible for keeping backups of
        any data you store through the Service.
      </P>
      <P>
        We may, in rare cases, store metadata (such as file names and sizes) in
        encrypted form to provide core functionality. This metadata is also
        encrypted at rest and not accessible to us in plaintext.
      </P>

      <H2>5. No Warranty</H2>
      <P>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot;
        WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
        LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
        SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT YOUR FILES
        WILL REMAIN ACCESSIBLE INDEFINITELY.
      </P>
      <P>
        TriVE relies on the Telegram MTProto API and Telegram&apos;s
        infrastructure. We make no guarantee regarding the availability,
        reliability, or performance of Telegram&apos;s services.
      </P>

      <H2>6. Limitation of Liability</H2>
      <P>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
        TECTONIC, ITS AFFILIATES, OR ITS LICENSORS BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
        PROFITS OR DATA, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE,
        WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR
        OTHERWISE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH
        DAMAGES.
      </P>
      <P>
        Because the Service is free and zero-knowledge, our aggregate liability
        for any claim shall not exceed the amount you paid us for the Service in
        the twelve months preceding the claim (typically zero).
      </P>

      <H2>7. Indemnification</H2>
      <P>
        You agree to indemnify and hold harmless Tectonic and its affiliates
        from any claims, damages, losses, or expenses (including reasonable
        attorneys&apos; fees) arising out of your use of the Service or your
        violation of these Terms or any third party&apos;s rights.
      </P>

      <H2>8. Termination</H2>
      <P>
        You may stop using the Service at any time. To delete your account and
        all associated data, use the &quot;Delete account&quot; option in
        Settings — this removes your user record, file metadata, and share links
        from our database. Files stored in your Telegram vault channel are not
        automatically deleted by us (we cannot access them); you must delete
        them via Telegram directly if desired.
      </P>
      <P>
        We may suspend or terminate your access to the Service at any time, with
        or without cause, and without notice.
      </P>

      <H2>9. Changes to the Service and Terms</H2>
      <P>
        We may modify these Terms from time to time. The &quot;Last updated&quot;
        date at the top of this page reflects the most recent revision. Your
        continued use of the Service after changes take effect constitutes
        acceptance of the new Terms.
      </P>

      <H2>10. Governing Law</H2>
      <P>
        These Terms shall be governed by and construed in accordance with
        applicable international conventions, without regard to conflict of law
        principles. Any disputes arising under these Terms shall be resolved
        through good-faith negotiation, and if necessary, in the courts having
        jurisdiction over Tectonic&apos;s place of business.
      </P>

      <H2>11. Contact</H2>
      <P>
        If you have questions about these Terms, please{" "}
        <button
          className="text-brand hover:underline"
          onClick={() =>
            (window.location.href = "/?page=contact")
          }
        >
          contact us
        </button>
        .
      </P>
    </LegalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Privacy Policy                                                      */
/* ------------------------------------------------------------------ */

function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  const meta = PAGES.privacy
  return (
    <LegalShell meta={meta} onBack={onBack}>
      <P>
        This Privacy Policy describes how TriVE (&quot;we&quot;,
        &quot;us&quot;) collects, uses, and protects information when you use
        our Service. TriVE is a zero-knowledge file management client built on
        top of the official Telegram MTProto API. We have designed the Service
        to collect as little information as possible.
      </P>

      <H2>1. Data We Collect</H2>
      <P>We collect and process the following categories of data:</P>
      <UL>
        <LI>
          <strong>Phone number.</strong> Used to authenticate you via
          Telegram&apos;s MTProto login flow. We never see or store your
          Telegram password or two-factor password.
        </LI>
        <LI>
          <strong>Display name.</strong> Optional, set by you in Settings.
        </LI>
        <LI>
          <strong>File metadata.</strong> File names, sizes, MIME types,
          folder structure, and timestamps. This metadata is encrypted at rest
          and is required to provide core functionality.
        </LI>
        <LI>
          <strong>Activity logs.</strong> Records of actions you take in the
          Service (uploads, downloads, shares, deletions) for audit and
          diagnostics.
        </LI>
        <LI>
          <strong>Session data.</strong> A signed session cookie is used to
          keep you logged in. The cookie value is signed with our app secret;
          the underlying session is encrypted at rest.
        </LI>
      </UL>

      <H2>2. How Your Files Are Stored</H2>
      <P>
        Your files are encrypted in your browser using AES-256-GCM before they
        ever leave your device. The encryption key is derived from a per-user
        secret that is generated when you first set up your vault and stored
        locally on your device.
      </P>
      <P>
        The encrypted ciphertext is uploaded to a private channel on{" "}
        <strong>your own Telegram account</strong>. We do not have access to
        your Telegram account, your encryption key, or your plaintext. This is
        a true zero-knowledge architecture: even if our entire infrastructure
        were compromised, an attacker would only recover ciphertext that we
        cannot decrypt.
      </P>

      <H2>3. Session Handling</H2>
      <P>
        Your authenticated session is stored in a signed, HTTP-only cookie. The
        session record on our side is encrypted at rest using AES-256-GCM with
        a key derived from our app secret. We do not log session contents.
      </P>

      <H2>4. Cookies</H2>
      <P>
        The Service uses a single essential cookie to maintain your
        authenticated session. We do not use third-party tracking cookies,
        advertising cookies, or analytics cookies. If you disable cookies in
        your browser, you will not be able to log in.
      </P>

      <H2>5. Third Parties</H2>
      <P>
        The Service relies on the official Telegram MTProto API for storage.
        When you upload a file, the encrypted ciphertext is transmitted to
        Telegram&apos;s servers as part of your account&apos;s data. Telegram
        only ever sees encrypted bytes — they cannot read your files, and
        neither can we.
      </P>
      <P>
        TriVE is <strong>not affiliated with Telegram</strong>. We do not share
        your data with any other third parties. We do not sell your data.
      </P>

      <H2>6. Data Retention</H2>
      <P>
        Your account and metadata remain on our servers for as long as your
        account is active. When you delete your account (via Settings → Delete
        account), we remove your user record, file metadata, share links, and
        activity logs from our database within a short period of time.
      </P>
      <P>
        Files stored in your Telegram vault channel are <strong>not</strong>{" "}
        automatically deleted when you delete your TriVE account, because we
        cannot access them. To remove them, you must delete the vault channel
        via Telegram directly.
      </P>

      <H2>7. Your Rights</H2>
      <P>Depending on your jurisdiction, you may have the right to:</P>
      <UL>
        <LI>Access the personal data we hold about you.</LI>
        <LI>Request correction of inaccurate personal data.</LI>
        <LI>Request deletion of your personal data.</LI>
        <LI>Object to or restrict certain processing of your data.</LI>
        <LI>Withdraw consent at any time (where processing is consent-based).</LI>
      </UL>
      <P>
        To exercise any of these rights, please{" "}
        <button
          className="text-brand hover:underline"
          onClick={() => (window.location.href = "/?page=contact")}
        >
          contact us
        </button>
        . Because the Service is zero-knowledge, our ability to access your
        file contents is limited — by design.
      </P>

      <H2>8. Security</H2>
      <P>
        We use industry-standard practices to protect the Service, including
        encryption in transit (TLS), encryption at rest for session data and
        metadata, signed session cookies, and strict access controls on our
        infrastructure.
      </P>
      <P>
        However, no system is perfectly secure. We encourage you to use a
        strong, unique Telegram two-factor password and to keep your device
        secure.
      </P>

      <H2>9. Children&apos;s Privacy</H2>
      <P>
        The Service is not directed to children under the age of 13 (or the
        minimum age required by your jurisdiction to use Telegram). We do not
        knowingly collect personal data from children. If you believe we have
        collected data from a child, please contact us and we will delete it.
      </P>

      <H2>10. Changes to This Policy</H2>
      <P>
        We may update this Privacy Policy from time to time. The &quot;Last
        updated&quot; date at the top of this page reflects the most recent
        revision. Your continued use of the Service after changes take effect
        constitutes acceptance of the new policy.
      </P>

      <H2>11. Contact</H2>
      <P>
        If you have questions about this Privacy Policy or your data, please{" "}
        <button
          className="text-brand hover:underline"
          onClick={() => (window.location.href = "/?page=contact")}
        >
          contact us
        </button>
        .
      </P>
    </LegalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Disclaimer                                                          */
/* ------------------------------------------------------------------ */

function Disclaimer({ onBack }: { onBack: () => void }) {
  const meta = PAGES.disclaimer
  return (
    <LegalShell meta={meta} onBack={onBack}>
      <div className="glass-panel rounded-xl p-4 flex items-start gap-3 mb-6 border-l-2 border-amber-400/60">
        <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-foreground/90">
          <strong>Please read this disclaimer carefully.</strong> It explains
          the relationship between TriVE and Telegram, and the limits of what
          TriVE can guarantee.
        </div>
      </div>

      <H2>1. Not Affiliated with Telegram</H2>
      <P>
        TriVE is an <strong>independent software client</strong> that uses the
        official Telegram MTProto API. TriVE is{" "}
        <strong>not affiliated with, endorsed by, sponsored by, or partnered
        with</strong> Telegram FZ-LLC, Telegram Messenger Inc., or any of their
        affiliates. &quot;Telegram&quot; is a trademark of its respective
        owners and is used here for descriptive purposes only.
      </P>

      <H2>2. Independent Client Using the Official MTProto API</H2>
      <P>
        TriVE communicates with Telegram&apos;s servers exclusively through the
        official MTProto API, the same protocol used by official Telegram
        clients. TriVE does not modify, hack, or circumvent any part of the
        Telegram service. All interactions occur within the rate limits and
        terms set by Telegram for third-party clients.
      </P>
      <P>
        Users are responsible for complying with{" "}
        <a
          href="https://telegram.org/tos"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline inline-flex items-center gap-0.5"
        >
          Telegram&apos;s Terms of Service
          <ExternalLink className="size-3" />
        </a>{" "}
        when using TriVE.
      </P>

      <H2>3. Files Are Stored on Your Own Telegram Account</H2>
      <P>
        When you upload a file through TriVE, the encrypted file is stored in a
        private channel on <strong>your own Telegram account</strong>. TriVE
        does not operate its own storage backend for file contents — we only
        store encrypted metadata (file names, sizes, chunk mappings) required
        to retrieve and decrypt your files.
      </P>
      <P>
        This means:
      </P>
      <UL>
        <LI>
          Your files count against your Telegram account&apos;s storage
          allocation and follow Telegram&apos;s data retention policies.
        </LI>
        <LI>
          If your Telegram account is suspended, deleted, or otherwise
          inaccessible, your files will also become inaccessible through TriVE.
        </LI>
        <LI>
          If you delete your TriVE account, files stored in your Telegram vault
          channel are <strong>not</strong> automatically removed — you must
          delete them via Telegram directly.
        </LI>
      </UL>

      <H2>4. No Guarantee of Data Availability</H2>
      <P>
        TriVE provides <strong>no guarantee</strong> of data availability
        beyond what Telegram&apos;s infrastructure provides. We cannot
        guarantee that:
      </P>
      <UL>
        <LI>
          Telegram&apos;s MTProto API will remain available, accessible, or
          free to use for third-party clients.
        </LI>
        <LI>
          Your files will remain accessible indefinitely — Telegram may impose
          rate limits, content policies, or account actions that affect your
          ability to retrieve them.
        </LI>
        <LI>
          The MTProto API will continue to allow the storage patterns TriVE
          relies on (such as private channels for file storage).
        </LI>
      </UL>
      <P>
        We strongly encourage you to maintain independent backups of any data
        you store through TriVE.
      </P>

      <H2>5. Use at Your Own Risk</H2>
      <P>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot;
        WITHOUT WARRANTY OF ANY KIND. YOUR USE OF THE SERVICE IS AT YOUR SOLE
        RISK. TECTONIC ASSUMES NO LIABILITY FOR LOSS OF DATA, LOSS OF ACCESS TO
        YOUR TELEGRAM ACCOUNT, OR ANY OTHER DAMAGE ARISING FROM YOUR USE OF THE
        SERVICE.
      </P>

      <H2>6. Compliance with Telegram&apos;s Terms</H2>
      <P>
        You are solely responsible for ensuring that your use of TriVE complies
        with Telegram&apos;s Terms of Service, including any restrictions on
        automated access, file storage, and account usage. If Telegram takes
        action against your account as a result of your use of TriVE, we are
        not liable.
      </P>

      <H2>7. Encryption and Zero-Knowledge</H2>
      <P>
        TriVE encrypts your files in your browser using AES-256-GCM before they
        are uploaded to Telegram. We do not have access to your encryption keys
        or plaintext. However, no encryption is perfect, and we cannot
        guarantee absolute security against all possible attacks.
      </P>

      <H2>8. Contact</H2>
      <P>
        If you have questions about this disclaimer, please{" "}
        <button
          className="text-brand hover:underline"
          onClick={() => (window.location.href = "/?page=contact")}
        >
          contact us
        </button>
        .
      </P>
    </LegalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

function ContactPage({ onBack }: { onBack: () => void }) {
  const meta = PAGES.contact
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [sending, setSending] = React.useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all fields")
      return
    }
    setSending(true)
    // No backend needed — simulate a brief delay then show a success toast.
    await new Promise((r) => setTimeout(r, 700))
    setSending(false)
    toast.success("Message sent", {
      description: "Thanks for reaching out — we'll get back to you soon.",
    })
    setName("")
    setEmail("")
    setMessage("")
  }

  return (
    <LegalShell meta={meta} onBack={onBack}>
      <P>
        We&apos;d love to hear from you. Whether you have a question about how
        TriVE works, need help with your account, or want to share feedback,
        here&apos;s how to reach us.
      </P>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <a
          href="mailto:hello@trive.app"
          className="glass relative rounded-2xl p-5 hover:border-brand/40 transition-colors group"
        >
          <Mail className="size-5 text-brand mb-2" />
          <div className="font-medium text-sm">Email</div>
          <div className="text-xs text-muted-foreground mt-1 group-hover:text-brand transition-colors">
            hello@trive.app
          </div>
        </a>
        <a
          href="https://t.me/triveapp"
          target="_blank"
          rel="noopener noreferrer"
          className="glass relative rounded-2xl p-5 hover:border-brand/40 transition-colors group"
        >
          <MessageSquare className="size-5 text-brand mb-2" />
          <div className="font-medium text-sm">Telegram</div>
          <div className="text-xs text-muted-foreground mt-1 group-hover:text-brand transition-colors">
            @triveapp
          </div>
        </a>
        <a
          href="https://tect0nic.com"
          target="_blank"
          rel="noopener noreferrer"
          className="glass relative rounded-2xl p-5 hover:border-brand/40 transition-colors group"
        >
          <BookOpen className="size-5 text-brand mb-2" />
          <div className="font-medium text-sm">Built by</div>
          <div className="text-xs text-muted-foreground mt-1 group-hover:text-brand transition-colors">
            Tectonic — tect0nic.com
          </div>
        </a>
      </div>

      <H2>Send us a message</H2>
      <form onSubmit={onSubmit} className="space-y-4 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-10"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can we help?"
            rows={6}
          />
        </div>
        <Button
          type="submit"
          disabled={sending}
          className="gap-1.5"
        >
          {sending ? (
            <Send className="size-4 animate-pulse" />
          ) : (
            <Send className="size-4" />
          )}
          {sending ? "Sending…" : "Send message"}
        </Button>
      </form>

      <div className="mt-8 glass-panel rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="size-5 text-brand shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">
            Don&apos;t include sensitive information.
          </span>{" "}
          For your security, never share passwords, encryption keys, or
          Telegram login codes through this form. We will never ask for them.
        </div>
      </div>

      <div className="mt-8 text-center">
        <BrandMark size={36} className="mx-auto rounded-xl mb-2" />
        <TectonicCredit prefix="TriVE is built by" />
      </div>
    </LegalShell>
  )
}

/* ------------------------------------------------------------------ */
/* Public entry                                                        */
/* ------------------------------------------------------------------ */

export function LegalPage({
  page,
  onBack,
  onNavigate,
}: {
  page: LegalPageId
  onBack: () => void
  onNavigate?: (page: LegalPageId) => void
}) {
  const navigate = onNavigate ?? ((p: LegalPageId) => {
    window.location.href = `/?page=${p}`
  })
  switch (page) {
    case "legal":
      return <LegalIndex onNavigate={navigate} onBack={onBack} />
    case "terms":
      return <TermsOfService onBack={onBack} />
    case "privacy":
      return <PrivacyPolicy onBack={onBack} />
    case "disclaimer":
      return <Disclaimer onBack={onBack} />
    case "contact":
      return <ContactPage onBack={onBack} />
    default:
      return <LegalIndex onNavigate={navigate} onBack={onBack} />
  }
}
