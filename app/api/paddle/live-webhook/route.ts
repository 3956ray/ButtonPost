import { handlePaddleWebhook } from '@/lib/paddle/webhook-handler'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return handlePaddleWebhook(request, 'production')
}
