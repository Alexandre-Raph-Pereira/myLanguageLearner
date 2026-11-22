import { LogOut } from "lucide-react";
import { BottomNav, SideNav } from "@/components/shell/app-nav";
import { LanguageIndicator } from "@/components/shell/language-indicator";
import { SidebarFooter } from "@/components/shell/sidebar-footer";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Wordmark } from "@/components/shell/wordmark";
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
      <aside className="bg-sidebar sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-r px-4 py-6 md:flex">
        <Wordmark className="px-3" />
        <SideNav />
        <SidebarFooter />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 md:px-10 md:pt-4">
          <Wordmark className="md:invisible" />
          <div className="flex items-center gap-1">
            <LanguageIndicator language={language} />
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                title={user.email}
                className="text-muted-foreground hover:bg-track hover:text-foreground focus-visible:ring-ring/50 inline-flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3"
              >
                <LogOut className="size-5" aria-hidden />
              </button>
            </form>
          </div>
        </header>
        {/* Bottom padding keeps content clear of the mobile tab bar + home indicator. */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-10 md:pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
