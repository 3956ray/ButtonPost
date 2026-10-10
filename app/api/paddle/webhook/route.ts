import { resolvePaddleEnvironment } from '@/lib/paddle/runtime'
import { handlePaddleWebhook } from '@/lib/paddle/webhook-handler'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const environment = resolvePaddleEnvironment(
    new URL(request.url).hostname,
  )

  return handlePaddleWebhook(request, environment)
}
