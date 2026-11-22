import { afterEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createSupabaseServerClient: async () => ({ auth: { signInWithOtp } }),
}));
vi.mock("@/lib/request-origin", () => ({ requestOrigin: async () => "http://localhost:3000" }));

import { sendMagicLink } from "./actions";

function form(email: string) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("next", "/");
  return fd;
}

afterEach(() => {
  vi.unstubAllEnvs();
  signInWithOtp.mockClear();
});

describe("sendMagicLink", () => {
  it("sends a link to an allowed email when MAGIC_LINK_LOGIN is on (default)", async () => {
    vi.stubEnv("MAGIC_LINK_LOGIN", "");
    vi.stubEnv("ALLOWED_EMAILS", "me@example.com");
    const r = await sendMagicLink({ status: "idle" }, form("me@example.com"));
    expect(r).toEqual({ status: "sent" });
    expect(signInWithOtp).toHaveBeenCalledOnce();
  });

  it("refuses and sends nothing when MAGIC_LINK_LOGIN=0", async () => {
    vi.stubEnv("MAGIC_LINK_LOGIN", "0");
    vi.stubEnv("ALLOWED_EMAILS", "me@example.com");
    const r = await sendMagicLink({ status: "idle" }, form("me@example.com"));
    expect(r).toEqual({ status: "error", message: "Login by email link is turned off." });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});
