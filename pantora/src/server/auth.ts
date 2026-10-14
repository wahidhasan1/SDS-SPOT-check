import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { getProfile, getSettings } from "./services/users";
import type { UserProfile, UserSettings } from "@/lib/types";

// Demo identity: a random user id stored in an httpOnly cookie. This keeps the
// demo usable without an identity provider. Replace `getCurrentUserId` with a
// call to your auth provider (and map its subject to users.auth_subject) for
// production use.

export const USER_COOKIE = "pantora_uid";
export const ADMIN_COOKIE = "pantora_admin";
const ONE_YEAR = 60 * 60 * 24 * 365;

export const userCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: ONE_YEAR,
};

export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(USER_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const id = await getCurrentUserId();
  if (!id) return null;
  return getProfile(getDb(), id);
}

export interface CurrentUser {
  profile: UserProfile;
  settings: UserSettings;
}

/** For server components: redirects to onboarding when no user is signed in. */
export async function requireUser(): Promise<CurrentUser> {
  const profile = await getCurrentUser();
  if (!profile) redirect("/onboarding");
  return { profile, settings: getSettings(getDb(), profile.id, profile) };
}
