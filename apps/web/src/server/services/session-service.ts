import { createHash, randomBytes } from "node:crypto";
import type { WebSettings } from "@ls/config/settings";
import { DomainRefusal } from "@ls/core/errors";
import type { AuditLog } from "@ls/core/ports/audit";
import type { Clock } from "@ls/core/ports/clock";
import type { RequestUser, Sha256 } from "@ls/core/ports/common";
import type { IdGenerator } from "@ls/core/ports/ids";
import type { SessionRepo } from "@ls/core/ports/sessions";
import type { TxRunner } from "@ls/core/ports/tx";
import type { Logger } from "@ls/obs/logger";
import type { Session, SignInRequest } from "@ls/schema/api/session";
import { hash_password, verify_password } from "../http/passwords.ts";

export interface RequestMeta {
  request_id: string;
  ip_hash: string | null;
}
export interface SignInOutcome {
  session: Session;
  cookie_token: string;
  expires_at: Date;
}

const sha256_hex = (s: string): Sha256 => createHash("sha256").update(s).digest("hex");
// Verified against when the email is unknown, so CPU time does not reveal list membership.
const DUMMY_HASH = hash_password("x");
const REFUSAL_SLEEP_MS = 1000;

export class SessionService {
  // Expiry travels with the RequestUser that require() returned; with_route hands that same object on.
  private readonly expiry = new WeakMap<RequestUser, Date>();

  constructor(
    private readonly sessions: SessionRepo,
    private readonly audit: AuditLog,
    private readonly tx: TxRunner,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly settings: WebSettings,
    private readonly logger: Logger,
  ) {
    void this.ids;
  }

  async sign_in(req: SignInRequest, meta: RequestMeta): Promise<SignInOutcome> {
    const found = await this.sessions.find_user_by_email(req.email);
    const ok = verify_password(found === null ? DUMMY_HASH : found.password_hash, req.password);
    if (found === null || !ok) {
      const code = found === null ? "NOT_ON_ALLOW_LIST" : "INVALID_CREDENTIALS";
      const message = found === null ? "That email isn't on the staff list." : "That email and password don't match";
      // Hash only: never the email, password or token.
      const email_hash = sha256_hex(this.settings.audit_hash_salt.reveal() + req.email.toLowerCase());
      this.logger.warn("session.sign_in_refused", { request_id: meta.request_id, extra: { code, email_hash } });
      await this.clock.sleep(REFUSAL_SLEEP_MS);
      throw new DomainRefusal(code, message);
    }
    const token = randomBytes(32).toString("base64url");
    const token_hash = sha256_hex(token);
    const now = this.clock.now();
    const expires_at = new Date(now.getTime() + this.settings.session_ttl_hours * 3600_000);
    const user = found.user;
    await this.tx.with_tx(async (t) => {
      await this.sessions.create_session(user.user_id, token_hash, expires_at, t);
      await this.audit.append(
        {
          actor_id: user.user_id,
          action: "session.sign_in",
          target_kind: "session",
          target_id: token_hash.slice(0, 16),
          version_hash: null,
          reason: null,
          details: { user_id: user.user_id },
          request_id: meta.request_id as never,
          store_id: null,
        },
        t,
      );
    });
    return {
      session: {
        user: { user_id: user.user_id, name: user.name, email: user.email, role: user.role, synthetic: user.synthetic },
        expires_at: expires_at.toISOString(),
      },
      cookie_token: token,
      expires_at,
    };
  }

  async require(cookie_token: string | null, request_id: string): Promise<RequestUser> {
    if (cookie_token === null || cookie_token === "") throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
    const ctx = await this.sessions.resolve(sha256_hex(cookie_token), this.clock.now());
    if (ctx === null) throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
    const user = { ...ctx.user, request_id } as unknown as RequestUser;
    this.expiry.set(user, ctx.session.expires_at);
    return user;
  }

  async get_session(user: RequestUser): Promise<Session> {
    const expires_at = this.expiry.get(user);
    if (expires_at === undefined) throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
    return {
      user: { user_id: user.user_id, name: user.name, email: user.email, role: user.role, synthetic: user.synthetic },
      expires_at: expires_at.toISOString(),
    };
  }

  // revoke has no tx parameter in the port, so it commits first (fail-closed); the audit row follows.
  async sign_out(user: RequestUser, cookie_token: string): Promise<void> {
    const h = sha256_hex(cookie_token);
    await this.sessions.revoke(h, this.clock.now());
    await this.tx.with_tx(async (t) => {
      await this.audit.append(
        {
          actor_id: user.user_id,
          action: "session.sign_out",
          target_kind: "session",
          target_id: h.slice(0, 16),
          version_hash: null,
          reason: null,
          details: { user_id: user.user_id },
          request_id: user.request_id,
          store_id: null,
        },
        t,
      );
    });
  }
}
