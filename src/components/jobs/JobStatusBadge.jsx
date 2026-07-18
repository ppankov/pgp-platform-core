import React from "react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

const VARIANTS = {
  queued: "secondary",
  leased: "default",
  running: "default",
  retry_wait: "secondary",
  succeeded: "default",
  cancelled: "secondary",
  dead_letter: "destructive",
};

export default function JobStatusBadge({ status }) {
  const key = `jobs.status_${status}`;
  const label = t(key) !== key ? t(key) : status;
  return <Badge variant={VARIANTS[status] || "secondary"}>{label}</Badge>;
}