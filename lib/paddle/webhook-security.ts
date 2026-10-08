import 'server-only'

const PADDLE_IPS_URL = 'https://api.paddle.com/ips'
const CACHE_TTL_MS = 15 * 60 * 1000

type PaddleIpsResponse = {
  data?: {
    ipv4_cidrs?: unknown
  }
}

let cached:
  | {
      expiresAt: number
      ips: Set<string>
    }
  | null = null

function sourceIp(request: Request) {
  const forwarded =
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip')

  return forwarded?.split(',')[0]?.trim() || null
}

async function livePaddleIpv4Set() {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ips
  }

  const response = await fetch(PADDLE_IPS_URL, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      'Could not refresh Paddle live webhook IP allowlist.',
    )
  }

  const body = (await response.json()) as PaddleIpsResponse
  const cidrs = body.data?.ipv4_cidrs

  if (!Array.isArray(cidrs)) {
    throw new Error('Paddle live webhook IP response was invalid.')
  }

  const ips = new Set<string>()

  for (const cidr of cidrs) {
    if (
      typeof cidr === 'string' &&
      /^\d{1,3}(?:\.\d{1,3}){3}\/32$/.test(cidr)
    ) {
      ips.add(cidr.slice(0, -3))
    }
  }

  if (!ips.size) {
    throw new Error('Paddle live webhook IP allowlist was empty.')
  }

  cached = {
    ips,
    expiresAt: Date.now() + CACHE_TTL_MS,
  }

  return ips
}

export async function verifyLivePaddleWebhookSource(
  request: Request,
) {
  const ip = sourceIp(request)

  if (!ip) {
    return {
      allowed: false,
      ip: null,
      reason: 'missing_ip',
    } as const
  }

  const ips = await livePaddleIpv4Set()

  return {
    allowed: ips.has(ip),
    ip,
    reason: ips.has(ip) ? 'allowed' : 'not_allowlisted',
  } as const
}
