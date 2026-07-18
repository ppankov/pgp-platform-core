import React, { useState } from "react";
import { callFn } from "@/lib/function-call";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PLATFORM_ROLES } from "@/lib/permissions";
import { t } from "@/lib/i18n";

export default function LifecycleTransitionForm({ lifecycleId, states, initial, onSave, onCancel }) {
  const [fromState, setFromState] = useState(initial?.fromState || "");
  const [toState, setToState] = useState(initial?.toState || "");
  const [allowedRoles, setAllowedRoles] = useState(initial?.allowedRoles || []);
  const [requiresApproval, setRequiresApproval] = useState(initial?.requiresApproval ?? false);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  const toggleRole = (key) =>
    setAllowedRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { lifecycleId, fromState, toState, allowedRoles, requiresApproval, notes };
    await callFn("saveLifecycleTransition", { id: initial?.id, ...payload });
    setSaving(false);
    onSave();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="lt-from">{t("lifecycle.field.from_state")}</Label>
          <Select value={fromState} onValueChange={setFromState}>
            <SelectTrigger id="lt-from">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lt-to">{t("lifecycle.field.to_state")}</Label>
          <Select value={toState} onValueChange={setToState}>
            <SelectTrigger id="lt-to">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t("lifecycle.field.allowed_roles")}</Label>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORM_ROLES.filter((r) => r.key !== "guest").map((r) => (
            <label key={r.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={allowedRoles.includes(r.key)}
                onCheckedChange={() => toggleRole(r.key)}
              />
              {t(`role.${r.key}`)}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="lt-approval">{t("lifecycle.field.requires_approval")}</Label>
        <Switch id="lt-approval" checked={requiresApproval} onCheckedChange={setRequiresApproval} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lt-notes">{t("lifecycle.field.notes")}</Label>
        <Textarea id="lt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("lifecycle.cancel")}
        </Button>
        <Button type="submit" disabled={saving || !fromState || !toState}>
          {t("lifecycle.save")}
        </Button>
      </div>
    </form>
  );
}