import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

export default function WorkflowDefinitionForm({ onSave, onCancel }) {
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("organization");
  const [organizationId, setOrganizationId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!key.trim() || !name.trim() || !scope) return;
    if (scope === "organization" && !organizationId.trim()) return;
    setSaving(true);
    try {
      await callFn("registerWorkflowDefinition", {
        key: key.trim(), name: name.trim(), description: description.trim(),
        scope, organizationId: scope === "organization" ? organizationId.trim() : "",
      });
      toast({ title: t("workflow.saved") });
      onSave?.();
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("workflow.field.key")}</Label>
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. approval.review" />
      </div>
      <div className="space-y-2">
        <Label>{t("workflow.field.name")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{t("workflow.field.description")}</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("workflow.field.scope")}</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="platform">{t("workflow.scope_platform")}</SelectItem>
              <SelectItem value="organization">{t("workflow.scope_organization")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {scope === "organization" && (
          <div className="space-y-2">
            <Label>{t("workflow.field.organizationId")}</Label>
            <Input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>{t("workflow.cancel")}</Button>
        <Button onClick={submit} disabled={saving}>{saving ? t("workflow.saving") : t("workflow.save")}</Button>
      </div>
    </div>
  );
}