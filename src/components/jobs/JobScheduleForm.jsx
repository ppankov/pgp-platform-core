import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { callFn } from "@/lib/function-call";
import { t } from "@/lib/i18n";

const EMPTY_PAYLOAD = JSON.stringify({}, null, 2);

export default function JobScheduleForm({ definitions, defaultScope, defaultOrgId, onSave, onCancel }) {
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jobDefinitionId, setJobDefinitionId] = useState(definitions?.[0]?.id || "");
  const [scope, setScope] = useState(defaultScope || "organization");
  const [organizationId, setOrganizationId] = useState(defaultOrgId || "");
  const [scheduleType, setScheduleType] = useState("once");
  const [runAt, setRunAt] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState("60");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [priority, setPriority] = useState("5");
  const [misfirePolicy, setMisfirePolicy] = useState("skip");
  const [maxRuns, setMaxRuns] = useState("");
  const [payload, setPayload] = useState(EMPTY_PAYLOAD);
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [backoffType, setBackoffType] = useState("none");
  const [parseErr, setParseErr] = useState("");
  const [saving, setSaving] = useState(false);

  const canPlatform = scope === "platform";

  const submit = async () => {
    if (!key.trim() || !jobDefinitionId) return;
    if (scope === "organization" && !organizationId.trim()) {
      toast({ variant: "destructive", title: t("jobs.field.organizationId") + " required" });
      return;
    }
    let pl;
    try { pl = JSON.parse(payload); setParseErr(""); } catch (e) { setParseErr("payload: " + e.message); return; }
    setSaving(true);
    try {
      const body = {
        key: key.trim(), name: name.trim() || key.trim(), description,
        jobDefinitionId, scope,
        organizationId: scope === "organization" ? organizationId.trim() : null,
        scheduleType, priority: Number(priority) || 5, misfirePolicy, payload: pl,
        retryPolicy: { maxAttempts: Number(maxAttempts) || 1, backoffType },
      };
      if (scheduleType === "once") body.runAt = runAt ? new Date(runAt).toISOString() : "";
      else {
        body.intervalSeconds = Number(intervalSeconds) || 60;
        if (startAt) body.startAt = new Date(startAt).toISOString();
        if (endAt) body.endAt = new Date(endAt).toISOString();
        if (maxRuns) body.maxRuns = Number(maxRuns);
      }
      await callFn("createJobSchedule", body);
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
          <Input value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("jobs.field.name")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("jobs.field.jobDefinitionId")}</Label>
          <Select value={jobDefinitionId} onValueChange={setJobDefinitionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(definitions || []).map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name} ({d.key})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("jobs.field.scope")}</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="organization">{t("jobs.scope_organization")}</SelectItem>
              <SelectItem value="platform">{t("jobs.scope_platform")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {scope === "organization" && (
        <div className="space-y-2">
          <Label>{t("jobs.field.organizationId")}</Label>
          <Input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("jobs.field.scheduleType")}</Label>
          <Select value={scheduleType} onValueChange={setScheduleType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="once">{t("jobs.schedule_once")}</SelectItem>
              <SelectItem value="interval">{t("jobs.schedule_interval")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("jobs.field.priority")}</Label>
          <Input type="number" min={0} max={10} value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
      </div>
      {scheduleType === "once" ? (
        <div className="space-y-2">
          <Label>{t("jobs.field.runAt")} (UTC)</Label>
          <Input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t("jobs.field.intervalSeconds")}</Label>
            <Input type="number" min={60} value={intervalSeconds} onChange={(e) => setIntervalSeconds(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("jobs.field.startAt")}</Label>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("jobs.field.endAt")}</Label>
            <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("jobs.field.maxRuns")}</Label>
            <Input type="number" min={1} value={maxRuns} onChange={(e) => setMaxRuns(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("jobs.field.misfirePolicy")}</Label>
            <Select value={misfirePolicy} onValueChange={setMisfirePolicy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">{t("jobs.misfire_skip")}</SelectItem>
                <SelectItem value="run_once">{t("jobs.misfire_run_once")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label>{t("jobs.field.payload")}</Label>
        <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={5} className="font-mono text-xs" spellCheck={false} />
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