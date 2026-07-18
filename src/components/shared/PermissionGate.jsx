import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { hasCapability } from "@/lib/permissions";

// Frontend visibility helper — NOT a security boundary.
// Real authorization is always backend-enforced.
export default function PermissionGate({ capability, children, fallback = null }) {
  const { user } = useAuth();
  const role = user?.role || "user";
  if (!hasCapability(role, capability)) return <>{fallback}</>;
  return <>{children}</>;
}