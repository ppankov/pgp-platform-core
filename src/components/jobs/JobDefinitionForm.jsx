import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

const EMPTY_SCHEMA = JSON.stringify({ type: "object", properties: {} }, null, 2);

export default function JobDefinitionForm({ onSave, onCancel }) {
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [handlerKey, setHandlerKey] = useState("system.health_check");
  const [payloadSchema, setPayloadSchema] = useState(EMPTY_SCHEMA);
  const [resultSchema, setResultSchema] = useState(EMPTY_SCHEMA);
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [backoffType, setBackoffType] = useState("none");
  const [parseErr, setParseErr] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!key.trim() || !name.trim()) return;
    let ps, rs;
    try { ps = JSON.parse(payloadSchema); setParseErr(""); } catch (e) { setParseErr("payloadSchema: " + e.message); return; }
    try { rs = JSON.parse(resultSchema); } catch (e) { setParseErr("resultSchema: " + e.message); return; }
    setSaving(true);
    try {
      const retryPolicy = { maxAttempts: Number(maxAttempts) || 1, backoffType };
      await callFn("registerJobDefinition", {
        key: key.trim(), name: name.trim(), description, handlerKey,
        payloadSchema: ps, resultSchema: rs, defaultRetryPolicy: retryPolicy, active: true,
      });
      toast({ title: t("jobs.saved") });
      onSave?.();
    } catch (e) {
      toast({ variant: "destructive", title: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("jobs.field.key")}</Label>
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="system.health_check" />
        </div>
        <div className="space-y-2">
          <Label>{t("jobs.field.name")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("jobs.field.description")}</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{t("jobs.field.handlerKey")}</Label>
        <Select value={handlerKey} onValueChange={setHandlerKey}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="system.health_check">{t("jobs.handler_system_health_check")} (system.health_check)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("jobs.field.payload")}</Label>
          <Textarea value={payloadSchema} onChange={(e) => setPayloadSchema(e.target.value)} rows={6} className="font-mono text-xs" spellCheck={false} />
        </div>
        <div className="space-y-2">
          <Label>{t("jobs.field.result")}</Label>
          <Textarea value={resultSchema} onChange={(e) => setResultSchema(e.target.value)} rows={6} className="font-mono text-xs" spellCheck={false} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("jobs.field.maxAttempts")}</Label>
          <Input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("jobs.field.backoffType")}</Label>
          <Select value={backoffType} onValueChange={setBackoffType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("jobs.backoff_none")}</SelectItem>
              <SelectItem value="fixed">{t("jobs.backoff_fixed")}</SelectItem>
              <SelectItem value="exponential">{t("jobs.backoff_exponential")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {parseErr && <p className="text-xs text-destructive">{parseErr}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>{t("jobs.cancel")}</Button>
        <Button onClick={submit} disabled={saving}>{saving ? t("jobs.saving") : t("jobs.save")}</Button>
      </div>
    </div>
  );
}