import { createRemoteJWKSet, jwtVerify } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Config } from "../env.js";
import type { AccessVerifier } from "../ports.js";
import type { AppEnv } from "../app.js";
import { findAdminByEmail } from "../repos/users.js";

/**
 * Valida o JWT do Cloudflare Access (assinatura via JWKS, audience, issuer, exp).
 * Nunca confia em headers de e-mail sem verificação criptográfica.
 */
export class CloudflareAccessVerifier implements AccessVerifier {
  private readonly jwks;
  constructor(
    private readonly teamDomain: string,
    private readonly aud: string,
  ) {
    if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain)) throw new Error("ACCESS_TEAM_DOMAIN inválido");
    if (!aud) throw new Error("ACCESS_AUD ausente");
    this.jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  }
  async verify(token: string): Promise<{ email: string }> {
    const { payload } = await jwtVerify(token, this.jwks, { issuer: this.teamDomain, audience: this.aud, algorithms: ["RS256"] });
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!email) throw new Error("Token sem e-mail");
    return { email };
  }
}

export function createAccessVerifier(config: Config): AccessVerifier | null {
  if (!config.accessTeamDomain || !config.accessAud || config.accessTeamDomain.startsWith("REPLACE")) return null;
  return new CloudflareAccessVerifier(config.accessTeamDomain, config.accessAud);
}

/** Middleware: exige ADMIN autenticado. Bypass de desenvolvimento só em local/test. */
export function requireAdmin(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ctx = c.get("ctx");
    const verifier = c.get("accessVerifier");
    let email: string | null = null;
    const token = c.req.header("Cf-Access-Jwt-Assertion") ?? getCookie(c.req.header("Cookie") ?? "", "CF_Authorization");
    if (token && verifier) {
      try {
        email = (await verifier.verify(token)).email;
      } catch {
        return c.json({ error: { code: "UNAUTHORIZED", message: "Sessão inválida ou expirada." } }, 401);
      }
    } else if (!verifier && ctx.config.adminDevBypassEmail && (ctx.config.environment === "local" || ctx.config.environment === "test")) {
      email = ctx.config.adminDevBypassEmail;
    }
    if (!email) return c.json({ error: { code: "UNAUTHORIZED", message: "Autenticação necessária." } }, 401);
    const admin = await findAdminByEmail(ctx, email);
    if (!admin) return c.json({ error: { code: "FORBIDDEN", message: "Acesso negado." } }, 403);
    c.set("admin", admin);
    await next();
  };
}

function getCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}
