import Link from "next/link";
import { LogOut } from "lucide-react";
import { BottomNav, SideNav } from "@/components/shell/app-nav";
import { LanguageIndicator } from "@/components/shell/language-indicator";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { isLanguage } from "@/lib/languages";
import { getUserSettings } from "@/lib/settings";

// Every page is per-user: never prerender at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const settings = await getUserSettings(await getDb(), user.id);
  const language = isLanguage(settings.activeLanguage) ? settings.activeLanguage : "ko";

  return (
    <div className="flex min-h-dvh flex-1 md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col gap-6 border-r p-4 md:flex">
        <Link href="/" className="text-lg font-semibold">
          LangLearner
        </Link>
        <SideNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <Link href="/" className="font-semibold md:invisible">
            LangLearner
          </Link>
          <div className="flex items-center gap-2">
            <LanguageIndicator language={language} />
            <form action="/auth/signout" method="post">
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title={user.email}
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </header>
        {/* Bottom padding keeps content clear of the mobile tab bar + home indicator. */}
        <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
