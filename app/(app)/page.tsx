import { HomeDashboard } from "@/components/home/home-dashboard";
import { PageTitle } from "@/components/shell/page-title";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { isLanguage } from "@/lib/languages";
import { getProgressSummary } from "@/lib/progress/summary";
import { getUserSettings } from "@/lib/settings";
import { wordResumeInfo } from "@/lib/words/resume";

export default async function HomePage() {
  const user = await requireUser();
  const db = await getDb();
  const settings = await getUserSettings(db, user.id);
  const language = isLanguage(settings.activeLanguage) ? settings.activeLanguage : "ko";
  const summary = await getProgressSummary(db, user.id, language);
  const resume = await wordResumeInfo();

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Home</PageTitle>
      <HomeDashboard summary={summary} resume={resume} />
    </div>
  );
}
