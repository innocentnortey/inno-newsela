import type { RoleName, Sha256, UserId } from "./common.ts";
import type { Tx } from "./tx.ts";

export interface AppUserRow {
  user_id: UserId;
  email: string;
  name: string;
  role: RoleName;
  synthetic: boolean;
}

export interface AppUserCredentials {
  user: AppUserRow;
  password_hash: string; // scrypt; never leaves SessionService
}

export interface AppSessionRow {
  token_hash: Sha256;
  user_id: UserId;
  created_at: Date;
  expires_at: Date;
}

export interface SessionContext {
  user: AppUserRow;
  session: AppSessionRow;
}

export interface SessionRepo {
  find_user_by_email(email: string): Promise<AppUserCredentials | null>;
  create_session(user_id: UserId, token_hash: Sha256, expires_at: Date, tx: Tx): Promise<AppSessionRow>;
  resolve(token_hash: Sha256, now: Date): Promise<SessionContext | null>;
  revoke(token_hash: Sha256, now: Date): Promise<void>;
}
