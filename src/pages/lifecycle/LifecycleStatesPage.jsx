import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { callFn } from "@/lib/function-call";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import ModuleHeader from "@/components/shared/ModuleHeader";
import LifecycleStateForm from "@/components/lifecycle/LifecycleStateForm";
import { t } from "@/lib/i18n";

export default function LifecycleStatesPage() {
  const [params, setParams] = useSearchParams();
  const lifecycleId = params.get("lifecycle") || "";
  const [definitions, setDefinitions] = useState(null);
  const [states, setStates] = useState(null);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    base44.entities.LifecycleDefinition.list().then(setDefinitions);
  }, []);

  const loadStates = (id) => {
    if (!id) { setStates([]); return; }
    base44.entities.LifecycleState.filter({ lifecycleId: id }).then(setStates).catch(() => setStates([]));
  };
  useEffect(() => {
    loadStates(lifecycleId);
  }, [lifecycleId]);

  const onSelectLifecycle = (id) => setParams(id ? { lifecycle: id } : {});
  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleEdit = (s) => { setEditing(s); setOpen(true); };
  const handleSaved = () => { setOpen(false); loadStates(lifecycleId); };
  const handleDelete = async (s) => {
    if (!window.confirm(t("lifecycle.confirm_delete"))) return;
    await callFn("deleteLifecycleState", { id: s.id });
    loadStates(lifecycleId);
  };

  const sorted = states ? [...states].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : null;

  return (
    <div className="space-y-6">
      <ModuleHeader title={t("lifecycle.states")} description={t("lifecycle.subtitle")} />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1.5 max-w-sm">
            <label className="text-sm font-medium">{t("lifecycle.select_lifecycle")}</label>
            <Select value={lifecycleId} onValueChange={onSelectLifecycle}>
              <SelectTrigger>
                <SelectValue placeholder={t("lifecycle.select_lifecycle")} />
              </SelectTrigger>
              <SelectContent>
                {(definitions || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!lifecycleId ? (
            <p className="text-sm text-muted-foreground">{t("lifecycle.no_lifecycle")}</p>
          ) : states === null ? (
            <p className="text-sm text-muted-foreground">{t("lifecycle.loading")}</p>
          ) : (
            <>
              <div className="flex justify-end">
                <Button onClick={handleNew} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t("lifecycle.new")}
                </Button>
              </div>
              {sorted.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("lifecycle.empty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("lifecycle.field.order")}</TableHead>
                      <TableHead>{t("lifecycle.field.key")}</TableHead>
                      <TableHead>{t("lifecycle.field.title")}</TableHead>
                      <TableHead>{t("lifecycle.field.color")}</TableHead>
                      <TableHead>{t("lifecycle.initial")} / {t("lifecycle.final")}</TableHead>
                      <TableHead className="text-right">{t("lifecycle.manage")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.order ?? 0}</TableCell>
                        <TableCell className="font-mono text-xs">{s.key}</TableCell>
                        <TableCell className="font-medium">{s.title}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            {s.color ? (
                              <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: s.color }} />
                            ) : null}
                            {s.color || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {s.isInitial && <Badge variant="outline">{t("lifecycle.initial")}</Badge>}
                            {s.isFinal && <Badge variant="secondary">{t("lifecycle.final")}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(s)} aria-label={t("lifecycle.edit")}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} aria-label={t("lifecycle.delete")}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("lifecycle.edit") : t("lifecycle.new")} — {t("lifecycle.states")}
            </DialogTitle>
          </DialogHeader>
          {open && lifecycleId && (
            <LifecycleStateForm
              lifecycleId={lifecycleId}
              initial={editing}
              onSave={handleSaved}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}