import { PrismaClient } from "@prisma/client"
import { PrismaLibSQL } from "@prisma/adapter-libsql"
import { createClient } from "@libsql/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const tursoUrl =
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ""
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

  const isTurso =
    (tursoUrl.startsWith("libsql://") || tursoUrl.startsWith("https://")) &&
    !!tursoAuthToken

  if (isTurso) {
    const httpsUrl = tursoUrl.replace("libsql://", "https://")
    const client = createClient({
      url: httpsUrl,
      authToken: tursoAuthToken,
    })
    const adapter = new PrismaLibSQL(client)
    return new PrismaClient({
      adapter,
      log: ["error", "warn"],
    })
  }

  // Fallback to local SQLite file
  return new PrismaClient({
    log: ["error", "warn"],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
