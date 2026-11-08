import { parseConfig, type RawConfigEnv } from './config'
import { handleRequest } from './handler'
import { workersAiImageProvider, workersAiTextProvider } from './providers'
import type { QuotaGuard } from './quotaGuard'
import { verifyTurnstile } from './turnstile'
import { hashVisitor } from './visitor'

export { QuotaGuard } from './quotaGuard'

export interface Env extends RawConfigEnv {
  AI: Ai
  QUOTA_GUARD: DurableObjectNamespace<QuotaGuard>
}

/** Every request uses the same object, so there's exactly one global budget. */
const QUOTA_GUARD_NAME = 'global'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config = parseConfig(env)
    return handleRequest(request, {
      config,
      quota: env.QUOTA_GUARD.getByName(QUOTA_GUARD_NAME),
      textProvider: workersAiTextProvider(env.AI),
      imageProvider: workersAiImageProvider(env.AI),
      verifyTurnstile: (token, remoteIp) =>
        verifyTurnstile({
          token,
          remoteIp,
          secret: config.turnstileSecretKey,
          expectedHostnames: config.expectedTurnstileHostnames,
        }),
      hashVisitor: (ip) => hashVisitor(ip, config.ipHashSecret),
    })
  },
} satisfies ExportedHandler<Env>
