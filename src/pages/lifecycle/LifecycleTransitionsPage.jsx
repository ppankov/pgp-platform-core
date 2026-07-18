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
import LifecycleTransitionForm from "@/components/lifecycle/LifecycleTransitionForm";
import { t } from "@/lib/i18n";

const stateTitle = (states, id) => states.find((s) => s.id === id)?.title || "—";

export default function LifecycleTransitionsPage() {
  const [params, setParams] = useSearchParams();
  const lifecycleId = params.get("lifecycle") || "";
  const [definitions, setDefinitions] = useState(null);
  const [states, setStates] = useState([]);
  const [transitions, setTransitions] = useState(null);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    base44.entities.LifecycleDefinition.list().then(setDefinitions);
  }, []);

  const load = (id) => {
    if (!id) { setStates([]); setTransitions([]); return; }
    Promise.all([
      base44.entities.LifecycleState.filter({ lifecycleId: id }).catch(() => []),
      base44.entities.LifecycleTransition.filter({ lifecycleId: id }).catch(() => []),
    ]).then(([s, tr]) => {
      setStates(s);
      setTransitions(tr);
    });
  };
  useEffect(() => {
    load(lifecycleId);
  }, [lifecycleId]);

  const onSelectLifecycle = (id) => setParams(id ? { lifecycle: id } : {});
  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleEdit = (tr) => { setEditing(tr); setOpen(true); };
  const handleSaved = () => { setOpen(false); load(lifecycleId); };
  const handleDelete = async (tr) => {
    if (!window.confirm(t("lifecycle.confirm_delete"))) return;
    await callFn("deleteLifecycleTransition", { id: tr.id });
    load(lifecycleId);
  };

  return (
    <div className="space-y-6">
      <ModuleHeader title={t("lifecycle.transitions")} description={t("lifecycle.subtitle")} />

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
          ) : transitions === null ? (
            <p className="text-sm text-muted-foreground">{t("lifecycle.loading")}</p>
          ) : states.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("lifecycle.empty")}</p>
          ) : (
            <>
              <div className="flex justify-end">
                <Button onClick={handleNew} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t("lifecycle.new")}
                </Button>
              </div>
              {transitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("lifecycle.empty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("lifecycle.field.from_state")}</TableHead>
                      <TableHead>{t("lifecycle.field.to_state")}</TableHead>
                      <TableHead>{t("lifecycle.field.allowed_roles")}</TableHead>
                      <TableHead>{t("lifecycle.field.requires_approval")}</TableHead>
                      <TableHead className="text-right">{t("lifecycle.manage")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transitions.map((tr) => (
                      <TableRow key={tr.id}>
                        <TableCell className="font-medium">{stateTitle(states, tr.fromState)}</TableCell>
                        <TableCell className="font-medium">{stateTitle(states, tr.toState)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(tr.allowedRoles || []).map((r) => (
                              <Badge key={r} variant="outline" className="text-[10px]">
                                {t(`role.${r}`)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tr.requiresApproval ? (
                            <Badge variant="default">{t("lifecycle.field.requires_approval")}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(tr)} aria-label={t("lifecycle.edit")}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(tr)} aria-label={t("lifecycle.delete")}>
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
              {editing ? t("lifecycle.edit") : t("lifecycle.new")} — {t("lifecycle.transitions")}
            </DialogTitle>
          </DialogHeader>
          {open && lifecycleId && (
            <LifecycleTransitionForm
              lifecycleId={lifecycleId}
              states={states}
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