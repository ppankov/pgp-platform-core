// src/services/base44Adapter.js
// Canonical Base44 provider adapter for the frontend.
//
// Wave 10.1 — this is the ONLY frontend module permitted to import
// @base44/sdk directly. It owns Base44-specific client initialization and
// reads Base44-specific frontend environment/app parameters. It exposes the
// active provider implementation to the provider-neutral facade in
// backendAdapter.js.
//
// Base44 is the only provider in Wave 10.1. No secrets, tokens, or
// credentials live here; the client reads non-secret app params from
// app-params.js (VITE_BASE44_* env + runtime access_token).

import { createClient } from '@base44/sdk';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Canonical Base44 provider client (public app: requiresAuth false).
export const providerClient = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});

// Base44-specific bootstrap: fetch app public settings via the SDK's axios
// client. Used only by the auth flow (AuthContext.checkAppState). Returns the
// public settings object and throws the same axios error a direct call would,
// preserving the existing error contract (appError.status / .data.extra_data).
export async function fetchPublicSettings() {
  const appClient = createAxiosClient({
    baseURL: `/api/apps/public`,
    headers: {
      'X-App-Id': appParams.appId,
    },
    token: appParams.token, // Include token if available
    interceptResponses: true,
  });
  return await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
}