"use client"

import * as React from "react"
import { QrCodeModel, Ecc } from "@/lib/qrcodegen"

export interface QRCodeProps extends React.SVGProps<SVGSVGElement> {
  value: string
  size?: number
  border?: number
  color?: string
  bgColor?: string
  logoUrl?: string
  logoSize?: number
  className?: string
}

export function QRCodeSvg({
  value,
  size = 200,
  border = 2,
  color = "#0284c7",
  bgColor = "transparent",
  logoUrl,
  logoSize = 36,
  className,
  ...props
}: QRCodeProps) {
  const qr = React.useMemo(() => {
    try {
      return QrCodeModel.encodeText(value, Ecc.MEDIUM)
    } catch {
      return null
    }
  }, [value])

  if (!qr) return null

  const qrSize = qr.size
  const totalSize = qrSize + border * 2

  // Build SVG path for dark modules
  const pathParts: string[] = []
  for (let y = 0; y < qrSize; y++) {
    for (let x = 0; x < qrSize; x++) {
      if (qr.getModule(x, y)) {
        pathParts.push(`M${x + border},${y + border}h1v1h-1z`)
      }
    }
  }
  const svgPath = pathParts.join(" ")

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      {bgColor !== "transparent" && (
        <rect width={totalSize} height={totalSize} fill={bgColor} rx={border} />
      )}
      <path d={svgPath} fill={color} fillRule="evenodd" />
    </svg>
  )
}
