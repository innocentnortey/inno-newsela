// Mirrors OpenAPI components Role, User, SignInRequest, Session (CON-1 session card).
import { z } from "zod";
import { Timestamp } from "./common.ts";

export const Role = z.enum(["author", "reviewer", "approver"]);
export type Role = z.infer<typeof Role>;

export const User = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.email(),
  role: Role,
  synthetic: z.boolean(),
});
export type User = z.infer<typeof User>;

export const SignInRequest = z
  .object({
    email: z.email(),
    password: z.string().min(1).max(200),
  })
  .strict();
export type SignInRequest = z.infer<typeof SignInRequest>;

export const Session = z.object({
  user: User,
  expires_at: Timestamp,
});
export type Session = z.infer<typeof Session>;
