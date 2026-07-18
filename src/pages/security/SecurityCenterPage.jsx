import React from "react";
import { Shield, Lock, KeyRound, ScrollText, AlertTriangle, CheckCircle2, Building2, FileLock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import ModuleHeader from "@/components/shared/ModuleHeader";
import {
  ENTITY_SECURITY_MATRIX, getMatrixCounts, DATASTORE_ROLE_BOUNDARY,
  TENANT_MODEL, VERIFICATION_STATUS,
} from "@/lib/security/entity-security-matrix";

export default function SecurityCenterPage() {
  const counts = getMatrixCounts();
  const immutable = ENTITY_SECURITY_MATRIX.filter((e) =>
    e.immutableConditions && e.immutableConditions !== "none");
  const appendOnly = ENTITY_SECURITY_MATRIX.filter((e) => e.appendOnlyExpectation === true);
  const sensitive = ENTITY_SECURITY_MATRIX.filter((e) =>
    e.sensitiveFields && e.sensitiveFields.length > 0);

  const cards = [
    { icon: Shield, label: "Inventoried Entities", value: counts.inventoriedEntities },
    { icon: Lock, label: "Function-Only Mutation", value: counts.functionOnlyMutationEntities },
    { icon: Building2, label: "Organization-Isolated", value: counts.organizationIsolatedEntities },
    { icon: FileLock, label: "Immutable", value: counts.immutableEntities },
    { icon: ScrollText, label: "Append-Only", value: counts.appendOnlyEntities },
    { icon: KeyRound, label: "Sensitive Reads", value: counts.sensitiveFunctionReadEntities },
  ];

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Security Center"
        description="Registry-derived security posture — read-only. Not runtime attack telemetry."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <c.icon className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <TenantIsolationCard />
      <RoleBoundaryCard />
      <ImmutableCard rows={immutable} />
      <AppendOnlyCard rows={appendOnly} />
      <SensitiveCard rows={sensitive} />
      <EntityMatrixCard />
      <KnownLimitationsCard />
      <VerificationCard unverified={counts.unverifiedControls} deferred={counts.deferredControls} />
    </div>
  );
}

function TenantIsolationCard() {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-4 h-4" />Tenant Isolation</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><span className="text-muted-foreground">Source of truth:</span> {TENANT_MODEL.sourceOfTruth}</p>
        <p><span className="text-muted-foreground">user.organizationId added:</span> {String(TENANT_MODEL.userOrganizationIdAdded)}</p>
        <p><span className="text-muted-foreground">Enforcement:</span> {TENANT_MODEL.organizationIsolationEnforcement}</p>
        <p className="text-xs text-muted-foreground mt-2">{TENANT_MODEL.mechanism}</p>
      </CardContent>
    </Card>
  );
}

function RoleBoundaryCard() {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Datastore Role Boundary</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {DATASTORE_ROLE_BOUNDARY.supportedByDatastoreRLS.map((r) => (
            <Badge key={r} variant="default">{r}</Badge>
          ))}
          {DATASTORE_ROLE_BOUNDARY.applicationRolesNotDatastoreEnforceable.map((r) => (
            <Badge key={r} variant="secondary">{r} (function-only)</Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{DATASTORE_ROLE_BOUNDARY.note}</p>
      </CardContent>
    </Card>
  );
}

function ImmutableCard({ rows }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileLock className="w-4 h-4" />Immutable / Released ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Condition</TableHead><TableHead>Layer</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.entity}>
                <TableCell className="font-medium text-xs">{e.entity}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.immutableConditions}</TableCell>
                <TableCell><Badge variant="secondary">{e.enforcementLayer}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AppendOnlyCard({ rows }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ScrollText className="w-4 h-4" />Append-Only Audit ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Sensitive Fields</TableHead><TableHead>Layer</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.entity}>
                <TableCell className="font-medium text-xs">{e.entity}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(e.sensitiveFields || []).join(", ") || "—"}</TableCell>
                <TableCell><Badge variant="secondary">{e.enforcementLayer}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SensitiveCard({ rows }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Sensitive Data Paths ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Fields</TableHead><TableHead>Read Policy</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.entity}>
                <TableCell className="font-medium text-xs">{e.entity}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(e.sensitiveFields || []).join(", ")}</TableCell>
                <TableCell className="text-xs">{e.directReadPolicy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EntityMatrixCard() {
  return (
    <Card>
      <CardHeader><CardTitle>Entity Access Matrix</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Phase</TableHead><TableHead>Scope</TableHead><TableHead>Write</TableHead><TableHead>Verification</TableHead></TableRow></TableHeader>
          <TableBody>
            {ENTITY_SECURITY_MATRIX.map((e) => (
              <TableRow key={e.entity}>
                <TableCell className="font-medium text-xs">{e.entity}</TableCell>
                <TableCell className="text-xs">{e.phase}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.scopeModel}</TableCell>
                <TableCell><Badge variant={e.functionMutationOnly ? "default" : "secondary"}>{e.functionMutationOnly ? "function-only" : "—"}</Badge></TableCell>
                <TableCell><Badge variant="outline">{e.verificationStatus}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function KnownLimitationsCard() {
  const limited = ENTITY_SECURITY_MATRIX.filter((e) => e.knownLimitations && e.knownLimitations.length > 0);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Known Limitations</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {limited.map((e) => (
          <div key={e.entity}>
            <p className="font-medium text-xs">{e.entity}</p>
            <ul className="ml-4 list-disc text-xs text-muted-foreground">
              {e.knownLimitations.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function VerificationCard({ unverified, deferred }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Verification Status</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><span className="text-muted-foreground">Unverified controls:</span> {unverified}</p>
        <p><span className="text-muted-foreground">Deferred controls:</span> {deferred}</p>
        <p className="text-xs text-muted-foreground mt-2">
          All Core entity enforcement is <strong>Function Enforced</strong>. Datastore RLS is
          NOT claimed — native datastore RLS cannot join OrganizationMember. Direct client
          writes are prohibited; direct sensitive reads are routed through redacting functions.
        </p>
      </CardContent>
    </Card>
  );
}