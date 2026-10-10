import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type NotificationSetting = {
  id: string
  destination: string
  active: boolean
}

type PaddleList<T> = { data: T[] }
type PaddleEntity<T> = { data: T }

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error('Missing required environment variable: ' + name)
  return value
}

async function paddle<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const apiKey = required('PADDLE_LIVE_API_KEY')
  const response = await fetch('https://api.paddle.com' + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      'Paddle ' +
        response.status +
        ' ' +
        path +
        ': ' +
        JSON.stringify(body).slice(0, 800),
    )
  }

  return body as T
}

export async function GET(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== 'phase-6i-live-launch' ||
    request.nextUrl.searchParams.get('token') !==
      process.env.PADDLE_FINALIZE_TOKEN
  ) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const current = await paddle<PaddleList<NotificationSetting>>(
    '/notification-settings?per_page=200',
  )

  const productionDestination =
    'https://buttonpost.app/api/paddle/live-webhook'
  const stagingDestination =
    'https://staging.buttonpost.app/api/paddle/webhook'

  let target =
    current.data.find(
      (item) =>
        item.active && item.destination === productionDestination,
    ) ||
    current.data.find(
      (item) =>
        item.active && item.destination === stagingDestination,
    )

  if (!target) {
    return NextResponse.json(
      { error: 'Live ButtonPost notification destination was not found.' },
      { status: 404 },
    )
  }

  if (target.destination !== productionDestination) {
    target = (
      await paddle<PaddleEntity<NotificationSetting>>(
        '/notification-settings/' + encodeURIComponent(target.id),
        {
          method: 'PATCH',
          body: JSON.stringify({
            destination: productionDestination,
            description: 'ButtonPost Live production subscription sync',
          }),
        },
      )
    ).data
  }

  return NextResponse.json({
    ok: true,
    id: target.id,
    destination: target.destination,
    active: target.active,
  })
}
