import { PageTitle } from "@/components/shell/page-title";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDb } from "@/db";
import { monthSpent } from "@/lib/ai/budget";
import { AI_PROVIDERS, resolveModelChoice } from "@/lib/ai/providers";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { ENABLED_LANGUAGES, LANGUAGE_LABELS } from "@/lib/languages";
import { getLanguageProfile, getPricingRows, getUserSettings, recentUsage } from "@/lib/settings";
import {
  saveAiSettingsAction,
  saveBudgetsAction,
  saveLanguageProfileAction,
  savePricingAction,
} from "./actions";
import { AppearanceSettings } from "./appearance";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings · LangLearner" };

const selectClass =
  "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none";

const usd = (n: number, digits = 4) => `$${n.toFixed(digits)}`;

export default async function SettingsPage() {
  const user = await requireUser();
  const db = await getDb();
  const settings = await getUserSettings(db, user.id);
  const language = ENABLED_LANGUAGES[0];
  const profile = await getLanguageProfile(db, user.id, language);
  const smart = resolveModelChoice("smart", settings);
  const fast = resolveModelChoice("fast", settings);
  const modelIds = [...new Set([smart.modelId, fast.modelId])];
  const pricingRows = await getPricingRows(db, modelIds);
  const pricing = modelIds.map((id) => ({ id, row: pricingRows.find((r) => r.modelId === id) }));
  const needsVerification = pricing.some((p) => !p.row?.verified);
  const spent = await monthSpent(db, user.id);
  const usage = await recentUsage(db, user.id, 20);

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Settings</PageTitle>

      {needsVerification && (
        <div
          role="status"
          className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
        >
          <strong>Verify prices.</strong> Model prices below are placeholders or missing. Check them
          against your provider&apos;s pricing page and save each row — budgets depend on them.
        </div>
      )}

      <Card id="appearance">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Follows your device by default. Saved on this device only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppearanceSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language profile</CardTitle>
          <CardDescription>
            {LANGUAGE_LABELS[language].english} ({LANGUAGE_LABELS[language].native}) — exam{" "}
            {profile?.exam ?? "TOPIK"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm action={saveLanguageProfileAction} name="Language profile">
            <input type="hidden" name="language" value={language} />
            <Label htmlFor="targetLevel">Target TOPIK level</Label>
            <select
              id="targetLevel"
              name="targetLevel"
              defaultValue={profile?.targetLevel?.toString() ?? ""}
              className={selectClass}
            >
              <option value="">Not set</option>
              {[1, 2, 3, 4, 5, 6].map((l) => (
                <option key={l} value={l}>
                  Level {l} ({l <= 2 ? "TOPIK I" : "TOPIK II"})
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              TOPIK I: levels 1–2, TOPIK II: levels 3–6.
            </p>
          </SettingsForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI</CardTitle>
          <CardDescription>
            Leave empty to use the server defaults shown as placeholders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm action={saveAiSettingsAction} name="AI">
            <Label htmlFor="aiProvider">Provider</Label>
            <select
              id="aiProvider"
              name="aiProvider"
              defaultValue={settings.aiProvider ?? ""}
              className={selectClass}
            >
              <option value="">Default ({env.AI_PROVIDER})</option>
              {AI_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Label htmlFor="aiModelSmart">Smart model (generation)</Label>
            <Input
              id="aiModelSmart"
              name="aiModelSmart"
              defaultValue={settings.aiModelSmart ?? ""}
              placeholder={env.AI_MODEL_SMART}
            />
            <Label htmlFor="aiModelFast">Fast model (verification, small tasks)</Label>
            <Input
              id="aiModelFast"
              name="aiModelFast"
              defaultValue={settings.aiModelFast ?? ""}
              placeholder={env.AI_MODEL_FAST}
            />
          </SettingsForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>USD per million tokens for the configured models.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {pricing.map(({ id, row }) => (
            <SettingsForm key={id} action={savePricingAction} name={`Pricing ${id}`}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm break-all">{id}</span>
                {row?.verified ? (
                  <Badge variant="secondary">verified</Badge>
                ) : (
                  <Badge variant="destructive">{row ? "unverified" : "missing"}</Badge>
                )}
              </div>
              <input type="hidden" name="modelId" value={id} />
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`in-${id}`}>Input</Label>
                  <Input
                    id={`in-${id}`}
                    name="inputPerMtok"
                    inputMode="decimal"
                    required
                    defaultValue={row?.inputPerMtok ?? ""}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`out-${id}`}>Output</Label>
                  <Input
                    id={`out-${id}`}
                    name="outputPerMtok"
                    inputMode="decimal"
                    required
                    defaultValue={row?.outputPerMtok ?? ""}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`cache-${id}`}>Cache read</Label>
                  <Input
                    id={`cache-${id}`}
                    name="cacheReadPerMtok"
                    inputMode="decimal"
                    defaultValue={row?.cacheReadPerMtok ?? ""}
                  />
                </div>
              </div>
            </SettingsForm>
          ))}
        </CardContent>
      </Card>

      <Card id="budgets">
        <CardHeader>
          <CardTitle>Budgets</CardTitle>
          <CardDescription>
            Spent this month: <strong>{usd(spent)}</strong> of {usd(settings.budgetMonthlyUsd, 2)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <SettingsForm action={saveBudgetsAction} name="Budgets">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="budgetPerRequestUsd">Per request (USD)</Label>
                <Input
                  id="budgetPerRequestUsd"
                  name="budgetPerRequestUsd"
                  inputMode="decimal"
                  required
                  defaultValue={settings.budgetPerRequestUsd}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="budgetMonthlyUsd">Monthly (USD)</Label>
                <Input
                  id="budgetMonthlyUsd"
                  name="budgetMonthlyUsd"
                  inputMode="decimal"
                  required
                  defaultValue={settings.budgetMonthlyUsd}
                />
              </div>
            </div>
          </SettingsForm>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Last AI calls</h3>
            {usage.length === 0 ? (
              <p className="text-muted-foreground text-sm">No AI calls yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Tokens in/out</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="whitespace-nowrap">
                          {u.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                        </TableCell>
                        <TableCell>{u.task}</TableCell>
                        <TableCell>
                          <Badge variant={u.status === "ok" ? "secondary" : "destructive"}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {u.inputTokens}/{u.outputTokens}
                        </TableCell>
                        <TableCell className="text-right">{usd(u.costUsd)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
