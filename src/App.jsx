import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminLayout from '@/layouts/AdminLayout';
import Dashboard from '@/pages/Dashboard';
import LifecycleDefinitionsPage from '@/pages/lifecycle/LifecycleDefinitionsPage';
import LifecycleStatesPage from '@/pages/lifecycle/LifecycleStatesPage';
import LifecycleTransitionsPage from '@/pages/lifecycle/LifecycleTransitionsPage';
import LifecycleViewerPage from '@/pages/lifecycle/LifecycleViewerPage';
import EventDeliveriesPage from '@/pages/eventbus/EventDeliveriesPage';
import FailedDeliveriesPage from '@/pages/eventbus/FailedDeliveriesPage';
import EventDeliveryDetailPage from '@/pages/eventbus/EventDeliveryDetailPage';
import PluginCatalogPage from '@/pages/plugins/PluginCatalogPage';
import PluginDetailPage from '@/pages/plugins/PluginDetailPage';
import InstalledPluginsPage from '@/pages/plugins/InstalledPluginsPage';
import PluginInstallationDetailPage from '@/pages/plugins/PluginInstallationDetailPage';
import ConnectorCatalogPage from '@/pages/connectors/ConnectorCatalogPage';
import ConnectorDefinitionDetailPage from '@/pages/connectors/ConnectorDefinitionDetailPage';
import OrganizationConnectionsPage from '@/pages/connectors/OrganizationConnectionsPage';
import ConnectorConnectionDetailPage from '@/pages/connectors/ConnectorConnectionDetailPage';
import WorkflowCatalogPage from '@/pages/workflows/WorkflowCatalogPage';
import WorkflowDefinitionDetailPage from '@/pages/workflows/WorkflowDefinitionDetailPage';
import WorkflowInstancesPage from '@/pages/workflows/WorkflowInstancesPage';
import WorkflowInstanceDetailPage from '@/pages/workflows/WorkflowInstanceDetailPage';
import JobDefinitionsPage from '@/pages/jobs/JobDefinitionsPage';
import JobSchedulesPage from '@/pages/jobs/JobSchedulesPage';
import JobScheduleDetailPage from '@/pages/jobs/JobScheduleDetailPage';
import JobQueuePage from '@/pages/jobs/JobQueuePage';
import JobHistoryPage from '@/pages/jobs/JobHistoryPage';
import DeadLetterQueuePage from '@/pages/jobs/DeadLetterQueuePage';
import BackgroundJobDetailPage from '@/pages/jobs/BackgroundJobDetailPage';
import SecurityCenterPage from '@/pages/security/SecurityCenterPage';
import PlaceholderModule from '@/components/shared/PlaceholderModule';
import RoleRoute from '@/components/RoleRoute';
import { ALL_ROUTES } from '@/lib/navigation';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app — all platform routes under ProtectedRoute + AdminLayout
  return (
    <Routes>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lifecycle/definitions" element={<RoleRoute><LifecycleDefinitionsPage /></RoleRoute>} />
          <Route path="/lifecycle/states" element={<RoleRoute><LifecycleStatesPage /></RoleRoute>} />
          <Route path="/lifecycle/transitions" element={<RoleRoute><LifecycleTransitionsPage /></RoleRoute>} />
          <Route path="/lifecycle/viewer" element={<RoleRoute><LifecycleViewerPage /></RoleRoute>} />
          <Route path="/event-bus/deliveries" element={<RoleRoute><EventDeliveriesPage /></RoleRoute>} />
          <Route path="/event-bus/deliveries/failed" element={<RoleRoute><FailedDeliveriesPage /></RoleRoute>} />
          <Route path="/event-bus/delivery/:deliveryId" element={<RoleRoute><EventDeliveryDetailPage /></RoleRoute>} />
          <Route path="/plugins" element={<RoleRoute><PluginCatalogPage /></RoleRoute>} />
          <Route path="/plugins/installed" element={<RoleRoute><InstalledPluginsPage /></RoleRoute>} />
          <Route path="/plugins/installed/:installationId" element={<RoleRoute><PluginInstallationDetailPage /></RoleRoute>} />
          <Route path="/plugins/:pluginId" element={<RoleRoute><PluginDetailPage /></RoleRoute>} />
          <Route path="/connectors" element={<RoleRoute><ConnectorCatalogPage /></RoleRoute>} />
          <Route path="/connectors/connections" element={<RoleRoute><OrganizationConnectionsPage /></RoleRoute>} />
          <Route path="/connectors/connections/:connectionId" element={<RoleRoute><ConnectorConnectionDetailPage /></RoleRoute>} />
          <Route path="/connectors/:definitionId" element={<RoleRoute><ConnectorDefinitionDetailPage /></RoleRoute>} />
          <Route path="/workflows" element={<RoleRoute><WorkflowCatalogPage /></RoleRoute>} />
          <Route path="/workflows/instances" element={<RoleRoute><WorkflowInstancesPage /></RoleRoute>} />
          <Route path="/workflows/instances/:instanceId" element={<RoleRoute><WorkflowInstanceDetailPage /></RoleRoute>} />
          <Route path="/workflows/:definitionId" element={<RoleRoute><WorkflowDefinitionDetailPage /></RoleRoute>} />
          <Route path="/jobs/definitions" element={<RoleRoute><JobDefinitionsPage /></RoleRoute>} />
          <Route path="/jobs/schedules" element={<RoleRoute><JobSchedulesPage /></RoleRoute>} />
          <Route path="/jobs/schedules/:scheduleId" element={<RoleRoute><JobScheduleDetailPage /></RoleRoute>} />
          <Route path="/jobs/queue" element={<RoleRoute><JobQueuePage /></RoleRoute>} />
          <Route path="/jobs/history" element={<RoleRoute><JobHistoryPage /></RoleRoute>} />
          <Route path="/jobs/dead-letter" element={<RoleRoute><DeadLetterQueuePage /></RoleRoute>} />
          <Route path="/jobs/jobs/:jobId" element={<RoleRoute><BackgroundJobDetailPage /></RoleRoute>} />
          <Route path="/security" element={<RoleRoute><SecurityCenterPage /></RoleRoute>} />
          {ALL_ROUTES.filter((r) => r.path !== "/" && !r.key.startsWith("lifecycle_") && !r.key.startsWith("event_") && !r.key.startsWith("plugin") && !r.key.startsWith("connector") && !r.key.startsWith("workflow") && !r.key.startsWith("security_") && !r.path.startsWith("/jobs")).map((route) => (
            <Route key={route.key} path={route.path} element={<RoleRoute><PlaceholderModule /></RoleRoute>} />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App