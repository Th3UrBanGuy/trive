import crypto from "crypto"

export interface TelegramWidgetAuthData {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number | string
  hash: string
}

/**
 * Validates data received from Telegram Login Widget
 * Spec: https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramWidgetAuth(data: TelegramWidgetAuthData, botToken: string): boolean {
  if (!botToken || !data || !data.hash) return false

  const { hash, ...fields } = data

  // Expiration check (default allow up to 24 hours)
  const authDate = Number(fields.auth_date)
  if (isNaN(authDate) || Date.now() / 1000 - authDate > 86400) {
    return false
  }

  // Build sorted data check string
  const checkArr: string[] = []
  Object.keys(fields)
    .sort()
    .forEach((k) => {
      const val = (fields as any)[k]
      if (val !== undefined && val !== null && val !== "") {
        checkArr.push(`${k}=${val}`)
      }
    })

  const dataCheckString = checkArr.join("\n")
  const secretKey = crypto.createHash("sha256").update(botToken).digest()
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash, "utf-8"), Buffer.from(hash, "utf-8"))
  } catch {
    return false
  }
}

/**
 * Validates initData received from Telegram Mini Apps / WebApp
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export function verifyTelegramWebAppAuth(
  initData: string,
  botToken: string
): { valid: boolean; user?: any } {
  if (!botToken || !initData) return { valid: false }

  try {
    const params = new URLSearchParams(initData)
    const hash = params.get("hash")
    if (!hash) return { valid: false }

    params.delete("hash")

    const checkArr: string[] = []
    Array.from(params.keys())
      .sort()
      .forEach((k) => {
        const val = params.get(k)
        if (val !== null) {
          checkArr.push(`${k}=${val}`)
        }
      })

    const dataCheckString = checkArr.join("\n")
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest()
    const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

    const valid = crypto.timingSafeEqual(Buffer.from(computedHash, "utf-8"), Buffer.from(hash, "utf-8"))
    if (!valid) return { valid: false }

    const userStr = params.get("user")
    const user = userStr ? JSON.parse(userStr) : null
    return { valid: true, user }
  } catch {
    return { valid: false }
  }
}
