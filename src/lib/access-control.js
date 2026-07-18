// ═══════════════════════════════════════════════════════════════
// TEMPORARY — Phase 1 Frontend Access Resolver
// ═══════════════════════════════════════════════════════════════
// This is a FRONTEND UX GUARD ONLY.
// Backend authorization and RLS remain mandatory in Phase 2.
//
// In Phase 2, role resolution will source from:
//   - platform role assignments
//   - OrganizationMember records
//   - active organization context
//   - granular Permission / RolePermission
//   - backend authorization
//
// Until then, the effective role is derived from the Base44
// built-in user.role field. If the role cannot be resolved to
// a known platform role, protected access is DENIED by default.

import { isRoleAllowed } from '@/lib/navigation';
import { PLATFORM_ROLES, hasCapability } from '@/lib/permissions';

/**
 * Returns the effective platform role key for the current user,
 * or null if it cannot be resolved (deny by default).
 *
 * @param {object} user — current user from AuthContext
 * @param {object} activeOrganizationContext — reserved for Phase 2
 */
export function getEffectivePlatformRole(user, activeOrganizationContext) {
  // Phase 1: activeOrganizationContext is not yet populated.
  const rawRole = user?.role;
  if (!rawRole) return null;
  const known = PLATFORM_ROLES.find((r) => r.key === rawRole);
  return known ? known.key : null;
}

/**
 * Checks whether the access context can access a given route.
 * Route metadata (roles array) is the single source of truth
 * from navigation.js — no duplicated matrices here.
 *
 * Denies by default if role is unresolved or route has no metadata.
 */
export function canAccessRoute(route, accessContext) {
  const role = accessContext?.effectiveRole;
  if (!role) return false;
  if (!route?.roles) return false;
  return isRoleAllowed(route.roles, role);
}

/**
 * Checks a frontend permission key against the capability matrix.
 * Denies by default if role is unresolved.
 */
export function hasFrontendPermission(permissionKey, accessContext) {
  const role = accessContext?.effectiveRole;
  if (!role) return false;
  return hasCapability(role, permissionKey);
}