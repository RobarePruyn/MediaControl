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
  UserWithVenues,
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
  UpdateVenueRequest,
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
  CreateUserRequest,
  UpdateUserRequest,
  AssignVenuesRequest,
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

export function useUpdateVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateVenueRequest & { id: string }) =>
      apiPatch<Venue>('/admin/venues/' + id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues'] }),
  });
}

// ─── Controllers ──────────────────────────────────────────────────────

export function useControllers(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'controllers'],
    queryFn: () => apiGet<Controller[]>(`/admin/venues/${venueId}/controllers`),
    enabled: !!venueId,
  });
}

export function useController(venueId: string, id: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'controllers', id],
    queryFn: () => apiGet<Controller>(`/admin/venues/${venueId}/controllers/${id}`),
    enabled: !!venueId,
  });
}

export function useCreateController(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateControllerRequest) => apiPost<Controller>(`/admin/venues/${venueId}/controllers`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'controllers'] }),
  });
}

export function useUpdateController(venueId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateControllerRequest) => apiPatch<Controller>(`/admin/venues/${venueId}/controllers/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'controllers'] }),
  });
}

export function useDeleteController(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/venues/${venueId}/controllers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'controllers'] }),
  });
}

export function useTestController(venueId: string) {
  return useMutation({
    mutationFn: (id: string) => apiPost(`/admin/venues/${venueId}/controllers/${id}/test`),
  });
}

export function usePollController(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/admin/venues/${venueId}/controllers/${id}/poll`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'endpoints'] }),
  });
}

// ─── Endpoints ────────────────────────────────────────────────────────

export function useEndpoints(venueId: string, params?: { controllerId?: string; assigned?: string }) {
  const search = new URLSearchParams();
  if (params?.controllerId) search.set('controllerId', params.controllerId);
  if (params?.assigned) search.set('assigned', params.assigned);
  const qs = search.toString();
  return useQuery({
    queryKey: ['venues', venueId, 'endpoints', params],
    queryFn: () => apiGet<Endpoint[]>(`/admin/venues/${venueId}/endpoints${qs ? `?${qs}` : ''}`),
    enabled: !!venueId,
  });
}

export function useUpdateEndpoint(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; displayName?: string; groupId?: string | null }) =>
      apiPatch<Endpoint>(`/admin/venues/${venueId}/endpoints/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'endpoints'] }),
  });
}

export function useBulkAssignEndpoints(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BulkAssignEndpointsRequest) => apiPost(`/admin/venues/${venueId}/endpoints/bulk-assign`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'endpoints'] }),
  });
}

export function usePollEndpointStatus(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ updated: number }>(`/admin/venues/${venueId}/endpoints/poll-status`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'endpoints'] }),
  });
}

// ─── Groups ───────────────────────────────────────────────────────────

export function useGroups(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'groups'],
    queryFn: () => apiGet<Group[]>(`/admin/venues/${venueId}/groups`),
    enabled: !!venueId,
  });
}

export function useGroup(venueId: string, id: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'groups', id],
    queryFn: () => apiGet<Group>(`/admin/venues/${venueId}/groups/${id}`),
    enabled: !!venueId,
  });
}

export function useCreateGroup(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroupRequest) => apiPost<Group>(`/admin/venues/${venueId}/groups`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'groups'] }),
  });
}

export function useUpdateGroup(venueId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateGroupRequest) => apiPatch<Group>(`/admin/venues/${venueId}/groups/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'groups'] }),
  });
}

export function useDeleteGroup(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/venues/${venueId}/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'groups'] }),
  });
}

export function useGroupTokens(venueId: string, groupId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'groups', groupId, 'tokens'],
    queryFn: () => apiGet<GroupAccessToken[]>(`/admin/venues/${venueId}/groups/${groupId}/tokens`),
    enabled: !!venueId,
  });
}

export function useCreateGroupToken(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroupAccessTokenRequest) =>
      apiPost<GroupAccessToken>(`/admin/venues/${venueId}/groups/${body.groupId}/tokens`, body),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['venues', venueId, 'groups', vars.groupId, 'tokens'] }),
  });
}

export function useRotateGroupToken(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, tokenId }: { groupId: string; tokenId: string }) =>
      apiPost<GroupAccessToken>(`/admin/venues/${venueId}/groups/${groupId}/tokens/${tokenId}/rotate`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['venues', venueId, 'groups', vars.groupId, 'tokens'] }),
  });
}

export function useRevokeGroupToken(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, tokenId }: { groupId: string; tokenId: string }) =>
      apiDelete(`/admin/venues/${venueId}/groups/${groupId}/tokens/${tokenId}`),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['venues', venueId, 'groups', vars.groupId, 'tokens'] }),
  });
}

// ─── Channels ─────────────────────────────────────────────────────────

export function useChannels(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'channels'],
    queryFn: () => apiGet<Channel[]>(`/admin/venues/${venueId}/channels`),
    enabled: !!venueId,
  });
}

export function useCreateChannel(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateChannelRequest) => apiPost<Channel>(`/admin/venues/${venueId}/channels`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'channels'] }),
  });
}

export function useUpdateChannel(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateChannelRequest & { id: string }) =>
      apiPatch<Channel>(`/admin/venues/${venueId}/channels/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'channels'] }),
  });
}

export function useSyncChannels(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (controllerId: string) => apiPost(`/admin/venues/${venueId}/channels/sync`, { controllerId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'channels'] }),
  });
}

export function useReorderChannels(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReorderChannelsRequest) => apiPatch(`/admin/venues/${venueId}/channels/reorder`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'channels'] }),
  });
}

// ─── Branding ─────────────────────────────────────────────────────────

export function useBranding(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'branding'],
    queryFn: () => apiGet<BrandingConfig>(`/admin/venues/${venueId}/branding`),
    enabled: !!venueId,
  });
}

export function useUpdateBranding(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateBrandingRequest) => apiPut<BrandingConfig>(`/admin/venues/${venueId}/branding`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'branding'] }),
  });
}

// ─── Events ───────────────────────────────────────────────────────────

export function useEvents(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'events'],
    queryFn: () => apiGet<Event[]>(`/admin/venues/${venueId}/events`),
    enabled: !!venueId,
  });
}

export function useCreateEvent(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEventRequest) => apiPost<Event>(`/admin/venues/${venueId}/events`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'events'] }),
  });
}

export function useUpdateEvent(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateEventRequest & { id: string }) =>
      apiPatch<Event>(`/admin/venues/${venueId}/events/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'events'] }),
  });
}

export function useDeleteEvent(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/venues/${venueId}/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'events'] }),
  });
}

// ─── Triggers ─────────────────────────────────────────────────────────

export function useTriggers(venueId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'triggers'],
    queryFn: () => apiGet<Trigger[]>(`/admin/venues/${venueId}/triggers`),
    enabled: !!venueId,
  });
}

export function useTrigger(venueId: string, id: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'triggers', id],
    queryFn: () => apiGet<Trigger>(`/admin/venues/${venueId}/triggers/${id}`),
    enabled: !!venueId,
  });
}

export function useCreateTrigger(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTriggerRequest) => apiPost<Trigger>(`/admin/venues/${venueId}/triggers`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'triggers'] }),
  });
}

export function useUpdateTrigger(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTriggerRequest & { id: string }) =>
      apiPatch<Trigger>(`/admin/venues/${venueId}/triggers/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'triggers'] }),
  });
}

export function useDeleteTrigger(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/venues/${venueId}/triggers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'triggers'] }),
  });
}

export function useSetTriggerActions(venueId: string, triggerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetTriggerActionsRequest) =>
      apiPut(`/admin/venues/${venueId}/triggers/${triggerId}/actions`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'triggers', triggerId] }),
  });
}

export function useSetTriggerTargets(venueId: string, triggerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetTriggerTargetsRequest) =>
      apiPut(`/admin/venues/${venueId}/triggers/${triggerId}/targets`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'triggers', triggerId] }),
  });
}

export function useExecuteTrigger(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ executionId: string }>(`/admin/venues/${venueId}/triggers/${id}/execute`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues', venueId, 'trigger-executions'] }),
  });
}

export function useCancelExecution(venueId: string) {
  return useMutation({
    mutationFn: ({ triggerId, executionId }: { triggerId: string; executionId: string }) =>
      apiPost(`/admin/venues/${venueId}/triggers/${triggerId}/executions/${executionId}/cancel`),
  });
}

export function useTriggerExecutions(venueId: string, triggerId: string) {
  return useQuery({
    queryKey: ['venues', venueId, 'trigger-executions', triggerId],
    queryFn: () => apiGet<TriggerExecution[]>(`/admin/venues/${venueId}/triggers/${triggerId}/executions`),
    enabled: !!venueId,
  });
}

// ─── Users ───────────────────────────────────────────────────────────

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => apiGet<UserWithVenues[]>('/admin/users') });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserRequest) => apiPost<UserWithVenues>('/admin/users', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateUserRequest & { id: string }) =>
      apiPatch<UserWithVenues>(`/admin/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useAssignUserVenues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, venueIds }: { userId: string; venueIds: string[] }) =>
      apiPut(`/admin/users/${userId}/venues`, { venueIds } as AssignVenuesRequest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
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
