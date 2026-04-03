/**
 * TanStack Query hooks for all admin API endpoints.
 * Wraps the API client with caching, invalidation, and mutations.
 * @module admin-ui/api/hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from './client.js';
import type {
  Controller,
  Endpoint,
  Group,
  Channel,
  BrandingConfig,
  Venue,
  Event,
  GroupAccessToken,
  Trigger,
  TriggerExecution,
  IdentityProvider,
  SsoConfig,
} from '@suitecommand/types';
import type {
  TlsCertificateStatus,
  CreateControllerRequest,
  UpdateControllerRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
  CreateChannelRequest,
  UpdateChannelRequest,
  ReorderChannelsRequest,
  UpdateBrandingRequest,
  CreateVenueRequest,
  CreateEventRequest,
  UpdateEventRequest,
  CreateGroupAccessTokenRequest,
  CreateTriggerRequest,
  UpdateTriggerRequest,
  SetTriggerActionsRequest,
  SetTriggerTargetsRequest,
  CreateIdentityProviderRequest,
  UpdateIdentityProviderRequest,
  UpsertSsoConfigRequest,
  GenerateCsrRequest,
  BulkAssignEndpointsRequest,
} from '@suitecommand/types';

// ─── Venues ───────────────────────────────────────────────────────────

export function useVenues() {
  return useQuery({ queryKey: ['venues'], queryFn: () => apiGet<Venue[]>('/admin/venues') });
}

export function useCreateVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVenueRequest) => apiPost<Venue>('/admin/venues', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues'] }),
  });
}

// ─── Controllers ──────────────────────────────────────────────────────

export function useControllers() {
  return useQuery({ queryKey: ['controllers'], queryFn: () => apiGet<Controller[]>('/admin/controllers') });
}

export function useController(id: string) {
  return useQuery({ queryKey: ['controllers', id], queryFn: () => apiGet<Controller>(`/admin/controllers/${id}`) });
}

export function useCreateController() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateControllerRequest) => apiPost<Controller>('/admin/controllers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controllers'] }),
  });
}

export function useUpdateController(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateControllerRequest) => apiPatch<Controller>(`/admin/controllers/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controllers'] }),
  });
}

export function useDeleteController() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/controllers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['controllers'] }),
  });
}

export function useTestController() {
  return useMutation({
    mutationFn: (id: string) => apiPost(`/admin/controllers/${id}/test`),
  });
}

export function usePollController() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/admin/controllers/${id}/poll`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoints'] }),
  });
}

// ─── Endpoints ────────────────────────────────────────────────────────

export function useEndpoints(params?: { controllerId?: string; assigned?: string }) {
  const search = new URLSearchParams();
  if (params?.controllerId) search.set('controllerId', params.controllerId);
  if (params?.assigned) search.set('assigned', params.assigned);
  const qs = search.toString();
  return useQuery({
    queryKey: ['endpoints', params],
    queryFn: () => apiGet<Endpoint[]>(`/admin/endpoints${qs ? `?${qs}` : ''}`),
  });
}

export function useUpdateEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; displayName?: string; groupId?: string | null }) =>
      apiPatch<Endpoint>(`/admin/endpoints/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoints'] }),
  });
}

export function useBulkAssignEndpoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkAssignEndpointsRequest) => apiPost('/admin/endpoints/bulk-assign', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoints'] }),
  });
}

// ─── Groups ───────────────────────────────────────────────────────────

export function useGroups() {
  return useQuery({ queryKey: ['groups'], queryFn: () => apiGet<Group[]>('/admin/groups') });
}

export function useGroup(id: string) {
  return useQuery({ queryKey: ['groups', id], queryFn: () => apiGet<Group>(`/admin/groups/${id}`) });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroupRequest) => apiPost<Group>('/admin/groups', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useUpdateGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateGroupRequest) => apiPatch<Group>(`/admin/groups/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useGroupTokens(groupId: string) {
  return useQuery({
    queryKey: ['groups', groupId, 'tokens'],
    queryFn: () => apiGet<GroupAccessToken[]>(`/admin/groups/${groupId}/tokens`),
  });
}

export function useCreateGroupToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroupAccessTokenRequest) =>
      apiPost<GroupAccessToken>(`/admin/groups/${body.groupId}/tokens`, body),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['groups', vars.groupId, 'tokens'] }),
  });
}

export function useRotateGroupToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, tokenId }: { groupId: string; tokenId: string }) =>
      apiPost<GroupAccessToken>(`/admin/groups/${groupId}/tokens/${tokenId}/rotate`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['groups', vars.groupId, 'tokens'] }),
  });
}

export function useRevokeGroupToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, tokenId }: { groupId: string; tokenId: string }) =>
      apiDelete(`/admin/groups/${groupId}/tokens/${tokenId}`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['groups', vars.groupId, 'tokens'] }),
  });
}

// ─── Channels ─────────────────────────────────────────────────────────

export function useChannels() {
  return useQuery({ queryKey: ['channels'], queryFn: () => apiGet<Channel[]>('/admin/channels') });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateChannelRequest) => apiPost<Channel>('/admin/channels', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateChannelRequest & { id: string }) =>
      apiPatch<Channel>(`/admin/channels/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  });
}

export function useSyncChannels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (controllerId: string) => apiPost('/admin/channels/sync', { controllerId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  });
}

export function useReorderChannels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReorderChannelsRequest) => apiPatch('/admin/channels/reorder', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['channels'] }),
  });
}

// ─── Branding ─────────────────────────────────────────────────────────

export function useBranding() {
  return useQuery({ queryKey: ['branding'], queryFn: () => apiGet<BrandingConfig>('/admin/branding') });
}

export function useUpdateBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateBrandingRequest) => apiPut<BrandingConfig>('/admin/branding', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branding'] }),
  });
}

// ─── Events ───────────────────────────────────────────────────────────

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: () => apiGet<Event[]>('/admin/events') });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEventRequest) => apiPost<Event>('/admin/events', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateEventRequest & { id: string }) =>
      apiPatch<Event>(`/admin/events/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

// ─── Triggers ─────────────────────────────────────────────────────────

export function useTriggers() {
  return useQuery({ queryKey: ['triggers'], queryFn: () => apiGet<Trigger[]>('/admin/triggers') });
}

export function useTrigger(id: string) {
  return useQuery({ queryKey: ['triggers', id], queryFn: () => apiGet<Trigger>(`/admin/triggers/${id}`) });
}

export function useCreateTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTriggerRequest) => apiPost<Trigger>('/admin/triggers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['triggers'] }),
  });
}

export function useUpdateTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTriggerRequest & { id: string }) =>
      apiPatch<Trigger>(`/admin/triggers/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['triggers'] }),
  });
}

export function useDeleteTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/triggers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['triggers'] }),
  });
}

export function useSetTriggerActions(triggerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetTriggerActionsRequest) =>
      apiPut(`/admin/triggers/${triggerId}/actions`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['triggers', triggerId] }),
  });
}

export function useSetTriggerTargets(triggerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetTriggerTargetsRequest) =>
      apiPut(`/admin/triggers/${triggerId}/targets`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['triggers', triggerId] }),
  });
}

export function useExecuteTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ executionId: string }>(`/admin/triggers/${id}/execute`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trigger-executions'] }),
  });
}

export function useCancelExecution() {
  return useMutation({
    mutationFn: ({ triggerId, executionId }: { triggerId: string; executionId: string }) =>
      apiPost(`/admin/triggers/${triggerId}/executions/${executionId}/cancel`),
  });
}

export function useTriggerExecutions(triggerId: string) {
  return useQuery({
    queryKey: ['trigger-executions', triggerId],
    queryFn: () => apiGet<TriggerExecution[]>(`/admin/triggers/${triggerId}/executions`),
  });
}

// ─── TLS ──────────────────────────────────────────────────────────────

export function useTlsStatus() {
  return useQuery({ queryKey: ['tls'], queryFn: () => apiGet<TlsCertificateStatus>('/admin/tls/status') });
}

export function useUploadCert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { certificate: string; privateKey: string }) =>
      apiPost('/admin/tls/upload', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tls'] }),
  });
}

export function useGenerateCsr() {
  return useMutation({
    mutationFn: (body: GenerateCsrRequest) => apiPost<{ csr: string }>('/admin/tls/csr', body),
  });
}

// ─── SSO / Identity Providers ─────────────────────────────────────────

export function useIdentityProviders() {
  return useQuery({
    queryKey: ['identity-providers'],
    queryFn: () => apiGet<IdentityProvider[]>('/admin/identity-providers'),
  });
}

export function useCreateIdentityProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateIdentityProviderRequest) =>
      apiPost<IdentityProvider>('/admin/identity-providers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity-providers'] }),
  });
}

export function useUpdateIdentityProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateIdentityProviderRequest & { id: string }) =>
      apiPatch<IdentityProvider>(`/admin/identity-providers/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identity-providers'] }),
  });
}

export function useSsoConfig() {
  return useQuery({
    queryKey: ['sso-config'],
    queryFn: () => apiGet<SsoConfig>('/admin/identity-providers/sso/config'),
  });
}

export function useUpsertSsoConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertSsoConfigRequest) =>
      apiPut<SsoConfig>('/admin/identity-providers/sso/config', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sso-config'] }),
  });
}
