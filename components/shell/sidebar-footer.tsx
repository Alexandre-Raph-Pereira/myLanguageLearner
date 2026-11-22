import type { ReactNode } from "react";

/** Bottom slot of the desktop sidebar (plan 00c puts the rank card here). Renders nothing when empty. */
export function SidebarFooter({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div className="bg-card mt-auto rounded-2xl border p-4">{children}</div>;
}
