// Vercel serverless function: lets invite-link visitors use the site owner's key without ever seeing it.
// GET /api/si?path=/search&q=moon  (header x-invite-token: <INVITE_TOKEN>)
// Env vars (Vercel project settings, never in the browser bundle): SI_API_KEY, INVITE_TOKEN

const ALLOWED_PATH = /^\/(search|category\/[a-z_]+\/search|content\/[^?#]+|terms\/[a-z_]+|stats)$/

export async function GET(req: Request): Promise<Response> {
  const { SI_API_KEY, INVITE_TOKEN } = process.env
  if (!SI_API_KEY || !INVITE_TOKEN || req.headers.get('x-invite-token') !== INVITE_TOKEN) {
    return Response.json({ error: { code: 'INVITE_INVALID', message: 'This invite link is invalid or has expired.' } }, { status: 403 })
  }

  const params = new URL(req.url).searchParams
  const path = params.get('path') ?? ''
  if (!ALLOWED_PATH.test(path)) return Response.json({ error: { code: 'BAD_PATH', message: 'Unsupported API path.' } }, { status: 400 })
  params.delete('path')
  params.set('api_key', SI_API_KEY)

  const res = await fetch(`https://api.si.edu/openaccess/api/v1.0${path}?${params}`)
  return new Response(res.body, { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' } })
}
