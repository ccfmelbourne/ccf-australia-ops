"use server";

import { redirect } from "next/navigation";
import { destroyUserSession } from "@/lib/user-session";

export async function signOutAction(): Promise<void> {
  await destroyUserSession();
  redirect("/requester-login");
}
