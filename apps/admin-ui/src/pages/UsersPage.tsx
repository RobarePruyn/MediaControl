/**
 * Users management page.
 * Lists users with roles and venue assignments, supports CRUD and venue assignment.
 * @module admin-ui/pages/UsersPage
 */

import { useState, useEffect, type FormEvent } from 'react';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useAssignUserVenues,
  useVenues,
} from '../api/hooks.js';
import { useAuth } from '../auth/AuthProvider.js';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import type { UserWithVenues, UserRole } from '@suitecommand/types';
import './pages.css';

/** Role hierarchy from highest to lowest privilege */
const ROLE_HIERARCHY: UserRole[] = [
  'super_admin',
  'app_admin',
  'venue_super_admin',
  'venue_operator',
  'end_user',
];

/** Human-readable role labels */
const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  app_admin: 'App Admin',
  venue_super_admin: 'Venue Super Admin',
  venue_operator: 'Venue Operator',
  end_user: 'End User',
};

/**
 * Returns the roles that a user with the given role is allowed to assign.
 * A user cannot create or edit users with a role equal to or higher than their own.
 */
function getAllowedRoles(callerRole: string): UserRole[] {
  const callerIndex = ROLE_HIERARCHY.indexOf(callerRole as UserRole);
  if (callerIndex === -1) return [];
  return ROLE_HIERARCHY.slice(callerIndex + 1);
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsers();
  const { data: venues } = useVenues();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const assignVenues = useAssignUserVenues();

  const allowedRoles = currentUser ? getAllowedRoles(currentUser.role) : [];

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>(allowedRoles[0] ?? 'venue_operator');
  const [createVenueIds, setCreateVenueIds] = useState<Set<string>>(new Set());

  // Edit modal state
  const [editing, setEditing] = useState<UserWithVenues | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('venue_operator');
  const [editIsActive, setEditIsActive] = useState(true);

  // Venue assignment modal state
  const [assigningUser, setAssigningUser] = useState<UserWithVenues | null>(null);
  const [assignVenueIds, setAssignVenueIds] = useState<Set<string>>(new Set());

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setEditEmail(editing.email);
      setEditRole(editing.role);
      setEditIsActive(editing.isActive);
    }
  }, [editing]);

  useEffect(() => {
    if (assigningUser) {
      setAssignVenueIds(new Set(assigningUser.venueIds));
    }
  }, [assigningUser]);

  // Reset create role when allowedRoles changes
  useEffect(() => {
    if (allowedRoles.length > 0 && !allowedRoles.includes(createRole)) {
      setCreateRole(allowedRoles[0]);
    }
  }, [allowedRoles, createRole]);

  /** Build a map from venue ID to venue name for display */
  const venueNameMap = new Map(venues?.map((v) => [v.id, v.name]) ?? []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createUser.mutateAsync({
      email: createEmail,
      password: createPassword,
      role: createRole,
      venueIds: [...createVenueIds],
    });
    setShowCreate(false);
    setCreateEmail('');
    setCreatePassword('');
    setCreateVenueIds(new Set());
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await updateUser.mutateAsync({
      id: editing.id,
      email: editEmail,
      role: editRole,
      isActive: editIsActive,
    });
    setEditing(null);
  };

  const handleAssignVenues = async (e: FormEvent) => {
    e.preventDefault();
    if (!assigningUser) return;
    await assignVenues.mutateAsync({
      userId: assigningUser.id,
      venueIds: [...assignVenueIds],
    });
    setAssigningUser(null);
  };

  const handleDelete = async (id: string) => {
    await deleteUser.mutateAsync(id);
    setConfirmDelete(null);
  };

  const toggleCreateVenue = (venueId: string) => {
    setCreateVenueIds((prev) => {
      const next = new Set(prev);
      if (next.has(venueId)) next.delete(venueId);
      else next.add(venueId);
      return next;
    });
  };

  const toggleAssignVenue = (venueId: string) => {
    setAssignVenueIds((prev) => {
      const next = new Set(prev);
      if (next.has(venueId)) next.delete(venueId);
      else next.add(venueId);
      return next;
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Users</h2>
        <div className="page-actions">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create User
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="empty-text">Loading...</p>
      ) : !users?.length ? (
        <p className="empty-text">No users found.</p>
      ) : (
        <div className="data-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Auth</th>
                <th>Status</th>
                <th>Venues</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td><span className="badge badge-info">{ROLE_LABELS[u.role] ?? u.role}</span></td>
                  <td>{u.authProvider ?? 'local'}</td>
                  <td>
                    <span className={`status-dot ${u.isActive ? 'status-dot-active' : 'status-dot-inactive'}`} />
                    {u.isActive ? 'Active' : 'Inactive'}
                  </td>
                  <td>
                    {u.venueIds.length === 0
                      ? '—'
                      : u.venueIds.map((vid) => venueNameMap.get(vid) ?? vid).join(', ')}
                  </td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-ghost" onClick={() => setEditing(u)} title="Edit User">
                        <Pencil size={14} />
                      </button>
                      <button className="btn-ghost" onClick={() => setAssigningUser(u)} title="Assign Venues">
                        <Building2 size={14} />
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => setConfirmDelete(u.id)}
                        title="Delete User"
                        disabled={u.id === currentUser?.id}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Create User</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={createRole} onChange={(e) => setCreateRole(e.target.value as UserRole)}>
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Venue Access</label>
                {venues?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {venues.map((v) => (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400 }}>
                        <input
                          type="checkbox"
                          checked={createVenueIds.has(v.id)}
                          onChange={() => toggleCreateVenue(v.id)}
                          style={{ width: 'auto' }}
                        />
                        {v.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="empty-text">No venues available.</p>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createUser.isPending}>
                  {createUser.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit User</h3>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)}>
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                  {/* Include current role if caller can't normally assign it (for display) */}
                  {!allowedRoles.includes(editing.role) && (
                    <option value={editing.role}>{ROLE_LABELS[editing.role] ?? editing.role}</option>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  Active
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={updateUser.isPending}>
                  {updateUser.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Venue Assignment Modal */}
      {assigningUser && (
        <div className="modal-overlay" onClick={() => setAssigningUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Assign Venues &mdash; {assigningUser.email}</h3>
            <form onSubmit={handleAssignVenues}>
              <div className="form-group">
                <label>Select venues this user can access:</label>
                {venues?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {venues.map((v) => (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400 }}>
                        <input
                          type="checkbox"
                          checked={assignVenueIds.has(v.id)}
                          onChange={() => toggleAssignVenue(v.id)}
                          style={{ width: 'auto' }}
                        />
                        {v.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="empty-text">No venues available.</p>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setAssigningUser(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={assignVenues.isPending}>
                  {assignVenues.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Confirm Delete</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: 'var(--color-danger)' }}
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleteUser.isPending}
              >
                {deleteUser.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
