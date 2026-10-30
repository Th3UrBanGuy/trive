"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  Activity,
  BarChart3,
  Download,
  HardDrive,
  ShieldCheck,
  Upload,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import { useStorage } from "./use-storage"
import { formatBytes, formatDate } from "@/lib/file-utils"
import { cn } from "@/lib/utils"

export function AnalyticsView() {
  const { data, isLoading } = useStorage()

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    )
  }

  const total = data.totalUsed || 1
  const pieData = data.byType.map((b) => ({
    name: b.label,
    value: b.size,
    color: b.color,
  }))
  const trendData = data.uploadTrend.map((t) => ({
    date: new Date(t.date).toLocaleDateString(undefined, {
      weekday: "short",
    }),
    size: Math.round((t.size / (1024 * 1024)) * 100) / 100,
  }))

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="size-5 text-brand" />
          Storage analytics
        </h2>
        <p className="text-sm text-muted-foreground">
          A snapshot of your vault, broken down by type and activity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min">
        {/* Big stat card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="md:col-span-2 glass-strong rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-aurora opacity-30 pointer-events-none" />
          <div className="relative">
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
              <HardDrive className="size-3.5" />
              Total used
            </div>
            <div className="mt-2 text-4xl md:text-5xl font-semibold tracking-tight">
              {formatBytes(data.totalUsed)}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              across{" "}
              <span className="text-foreground font-medium">
                {data.fileCount}
              </span>{" "}
              file{data.fileCount === 1 ? "" : "s"} in{" "}
              <span className="text-foreground font-medium">
                {data.folderCount}
              </span>{" "}
              folder{data.folderCount === 1 ? "" : "s"} — of unlimited.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Stat icon={Upload} label="Encrypted" value="AES-256-GCM" />
              <Stat icon={ShieldCheck} label="Stored as" value="ciphertext" />
            </div>
          </div>
        </motion.div>

        {/* Donut chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="glass relative rounded-2xl p-5"
        >
          <div className="text-xs text-muted-foreground mb-2">By type</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={68}
                  paddingAngle={2}
                  stroke="none"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatBytes(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {pieData.slice(0, 4).map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between text-xs"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: p.color }}
                  />
                  <span className="text-muted-foreground">{p.name}</span>
                </span>
                <span className="font-medium">{formatBytes(p.value)}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bar chart - upload trend */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="md:col-span-2 glass relative rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-muted-foreground">
              Upload trend (last 7 days)
            </div>
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Upload className="size-3" />
              MB per day
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                  opacity={0.4}
                />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "color-mix(in oklch, var(--brand) 8%, transparent)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `${v} MB`}
                />
                <Bar
                  dataKey="size"
                  fill="var(--brand)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top types list */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="glass relative rounded-2xl p-5"
        >
          <div className="text-xs text-muted-foreground mb-3">Top types</div>
          <div className="space-y-2.5">
            {data.byType.slice(0, 5).map((t) => {
              const pct = Math.max(2, Math.round((t.size / total) * 100))
              return (
                <div key={t.type}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize">{t.label}</span>
                    <span className="text-muted-foreground">
                      {formatBytes(t.size)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: t.color }}
                    />
                  </div>
                </div>
              )
            })}
            {data.byType.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6">
                Nothing uploaded yet.
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent activity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="md:col-span-3 glass relative rounded-2xl p-5"
        >
          <div className="text-xs text-muted-foreground mb-3 inline-flex items-center gap-1.5">
            <Activity className="size-3.5" />
            Recent activity
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.recentActivity.slice(0, 9).map((a) => (
              <div
                key={a.id}
                className={cn(
                  "glass-panel rounded-lg p-2.5 flex items-start gap-2"
                )}
              >
                <div className="size-6 rounded-md bg-brand/15 text-brand flex items-center justify-center mt-0.5">
                  <ActivityIcon action={a.action} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">
                    {a.details || a.action}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatDate(a.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            {data.recentActivity.length === 0 && (
              <div className="text-xs text-muted-foreground col-span-full text-center py-6">
                No activity yet.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="glass-panel rounded-lg px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-brand" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ActivityIcon({ action }: { action: string }) {
  const a = action.toLowerCase()
  if (a.includes("upload")) return <Upload className="size-3" />
  if (a.includes("download")) return <Download className="size-3" />
  if (a.includes("create")) return <HardDrive className="size-3" />
  return <Activity className="size-3" />
}
