import { describe, expect, it } from "vitest";
import { redactUrl, toPostgresJsConfig } from "./url";

describe("toPostgresJsConfig", () => {
  it("drops provider-specific params that postgres.js would send to the server", () => {
    const cfg = toPostgresJsConfig(
      "postgres://postgres.ref:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x&pgbouncer=true",
    );
    expect(cfg.url).toBe(
      "postgres://postgres.ref:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require",
    );
    expect(cfg.ssl).toBeUndefined();
  });

  it("requires SSL for remote hosts when the URL does not say", () => {
    expect(toPostgresJsConfig("postgresql://u:p@db.example.com:6543/postgres").ssl).toBe("require");
    expect(toPostgresJsConfig("postgresql://u:p@localhost:5432/postgres").ssl).toBeUndefined();
  });

  it("keeps URL-encoded passwords intact", () => {
    const cfg = toPostgresJsConfig("postgresql://u:p%40ss%23w@h.example.com:6543/db?supa=x");
    expect(new URL(cfg.url).password).toBe("p%40ss%23w");
  });
});

describe("redactUrl", () => {
  it("masks the password", () => {
    expect(redactUrl("postgresql://u:secret@h:6543/db")).toBe("postgresql://u:***@h:6543/db");
  });
});
