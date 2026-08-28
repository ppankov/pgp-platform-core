// Phase 1 frontend authorization UX guard.
// Delegates entirely to access-control.js — no duplicated role matrices.
// Backend authorization and RLS remain mandatory in Phase 2.
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContextFacade';
import { ALL_ROUTES } from '@/lib/navigation';
import { getEffectivePlatformRole, canAccessRoute } from '@/lib/access-control';
import NotAuthorized from '@/pages/NotAuthorized';

export default function RoleRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const effectiveRole = getEffectivePlatformRole(user, null);
  const route = ALL_ROUTES.find((r) => r.path === location.pathname);

  if (route && !canAccessRoute(route, { effectiveRole })) {
    return <NotAuthorized />;
  }
  return children;
}