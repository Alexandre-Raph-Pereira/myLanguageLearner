import type { Metadata } from "next";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · LangLearner" };

const ERRORS: Record<string, string> = {
  not_allowed: "This email is not allowed to use this app.",
  callback: "The login link is invalid or expired. Request a new one.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <main className="bg-background relative flex flex-1 flex-col items-center justify-center gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-2">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-display inline-flex items-baseline gap-1 text-3xl font-bold">
          LangLearner
          <span aria-hidden className="bg-brass inline-block size-2 rounded-full" />
        </span>
        <p className="text-muted-foreground text-[15px]">Words, grammar and TOPIK practice.</p>
      </div>
      <section
        aria-labelledby="login-title"
        className="bg-card flex w-full max-w-sm flex-col gap-4 rounded-2xl border p-5 md:p-6"
      >
        <div className="flex flex-col gap-1">
          <h1 id="login-title" className="font-display text-2xl font-medium">
            Log in
          </h1>
          <p className="text-muted-foreground text-[13px]">
            We&apos;ll email you a magic link — no password.
          </p>
        </div>
        {error && (
          <p role="alert" className="bg-wrong-soft text-wrong-text rounded-xl p-3 text-sm">
            {error}
          </p>
        )}
        <LoginForm next={next} />
      </section>
    </main>
  );
}
