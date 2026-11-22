"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { syncTimezoneAction } from "@/app/(app)/timezone-actions";

/** Posts the browser's IANA timezone once when it differs from the stored value. Renders nothing. */
export function TimezoneSync({ stored }: { stored: string }) {
  const router = useRouter();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected || detected === stored) return;
    sent.current = true;
    syncTimezoneAction(detected)
      .then((r) => {
        if (r.ok) router.refresh();
      })
      .catch(() => {
        // Not critical: days keep using the stored zone.
      });
  }, [stored, router]);
  return null;
}
