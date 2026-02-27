'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiDelete, apiGet, apiPut } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';

const ComponentsAppsRolePermissions = () => {
    const [rolesList, setRolesList] = useState<any[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [permissionsLoading, setPermissionsLoading] = useState<boolean>(false);
    const [rolesLoading, setRolesLoading] = useState<boolean>(false);
    const [rolePermissions, setRolePermissions] = useState<any[]>([]);
    const [permissionsDirty, setPermissionsDirty] = useState<boolean>(false);
    const canViewPermissions = organizationContext.hasPermission('Role Permissions', 'view');
    const canUpdatePermissions = organizationContext.hasPermission('Role Permissions', 'update');
    const canDeletePermissions = organizationContext.hasPermission('Role Permissions', 'delete');

    const showMessage = (msg = '', type = 'success') => {
        const toast: any = Swal.mixin({
            toast: true,
            position: 'top',
            showConfirmButton: false,
            timer: 3000,
            customClass: { container: 'toast' },
        });
        toast.fire({
            icon: type,
            title: msg,
            padding: '10px 20px',
        });
    };

    const fetchRoles = useCallback(async () => {
        try {
            setRolesLoading(true);
            const response = await apiGet<any>('roles');
            const roles = Array.isArray(response) ? response : response.data || response.results || [];
            setRolesList(roles);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch roles';
            const isAuthError =
                error.isAuthError ||
                errorMessage.includes('401') ||
                errorMessage.includes('Unauthorized') ||
                errorMessage.includes('Token refresh failed') ||
                errorMessage.includes('No refresh token') ||
                errorMessage.toLowerCase().includes('token');

            if (!isAuthError) {
                showMessage(errorMessage, 'error');
            }
        } finally {
            setRolesLoading(false);
        }
    }, []);

    const fetchRolePermissions = useCallback(async (roleId: number) => {
        try {
            setPermissionsLoading(true);
            const response = await apiGet<any>(`roles/${roleId}/permissions`);
            const permissions = Array.isArray(response) ? response : response.data || response.results || [];
            setRolePermissions(permissions);
            setPermissionsDirty(false);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch role permissions';
            const isAuthError =
                error.isAuthError ||
                errorMessage.includes('401') ||
                errorMessage.includes('Unauthorized') ||
                errorMessage.includes('Token refresh failed') ||
                errorMessage.includes('No refresh token') ||
                errorMessage.toLowerCase().includes('token');

            if (!isAuthError) {
                showMessage(errorMessage, 'error');
            }
        } finally {
            setPermissionsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authState.isAuthStateReady()) {
            fetchRoles();
        } else {
            let attempts = 0;
            const maxAttempts = 20;
            const interval = setInterval(() => {
                attempts++;
                if (authState.isAuthStateReady() || attempts >= maxAttempts) {
                    clearInterval(interval);
                    if (authState.isAuthStateReady()) {
                        fetchRoles();
                    }
                }
            }, 100);

            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedRoleId && rolesList.length > 0) {
            const defaultRole = rolesList[0];
            const roleId = defaultRole?.id || defaultRole;
            if (roleId) {
                setSelectedRoleId(roleId);
            }
        }
    }, [rolesList, selectedRoleId]);

    useEffect(() => {
        if (!selectedRoleId || selectedRoleId === 0) {
            return;
        }

        if (authState.isAuthStateReady()) {
            fetchRolePermissions(selectedRoleId);
        } else {
            let attempts = 0;
            const maxAttempts = 20;
            const interval = setInterval(() => {
                attempts++;
                if (authState.isAuthStateReady() || attempts >= maxAttempts) {
                    clearInterval(interval);
                    if (authState.isAuthStateReady()) {
                        fetchRolePermissions(selectedRoleId);
                    }
                }
            }, 100);

            return () => clearInterval(interval);
        }
    }, [fetchRolePermissions, selectedRoleId]);

    const updatePermission = (moduleId: number, field: string, value: boolean) => {
        setRolePermissions((prev: any[]) =>
            prev.map((permission) =>
                permission.module_id === moduleId
                    ? { ...permission, [field]: value }
                    : permission
            )
        );
        setPermissionsDirty(true);
    };

    const saveRolePermissions = async () => {
        if (!selectedRoleId) {
            showMessage('Please select a role', 'error');
            return;
        }

        try {
            setPermissionsLoading(true);
            const payload = {
                permissions: rolePermissions.map((permission) => ({
                    module_id: permission.module_id,
                    can_view: !!permission.can_view,
                    can_create: !!permission.can_create,
                    can_update: !!permission.can_update,
                    can_delete: !!permission.can_delete,
                })),
            };

            const response = await apiPut<any>(`roles/${selectedRoleId}/permissions`, payload);
            const updated = Array.isArray(response) ? response : response.data || response.results || [];
            setRolePermissions(updated);
            setPermissionsDirty(false);
            showMessage('Role permissions updated successfully.');
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to update role permissions';
            const isAuthError =
                error.isAuthError ||
                errorMessage.includes('401') ||
                errorMessage.includes('Unauthorized') ||
                errorMessage.includes('Token refresh failed') ||
                errorMessage.includes('No refresh token') ||
                errorMessage.toLowerCase().includes('token');

            if (!isAuthError) {
                showMessage(errorMessage, 'error');
            }
        } finally {
            setPermissionsLoading(false);
        }
    };

    const deleteRolePermission = async (moduleId: number) => {
        if (!selectedRoleId) {
            showMessage('Please select a role', 'error');
            return;
        }

        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'This will remove permissions for this module.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!',
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            setPermissionsLoading(true);
            await apiDelete(`roles/${selectedRoleId}/permissions/${moduleId}`);
            await fetchRolePermissions(selectedRoleId);
            showMessage('Role permission deleted successfully.');
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to delete role permission';
            const isAuthError =
                error.isAuthError ||
                errorMessage.includes('401') ||
                errorMessage.includes('Unauthorized') ||
                errorMessage.includes('Token refresh failed') ||
                errorMessage.includes('No refresh token') ||
                errorMessage.toLowerCase().includes('token');

            if (!isAuthError) {
                showMessage(errorMessage, 'error');
            }
        } finally {
            setPermissionsLoading(false);
        }
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl">Role Permissions</h2>
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        className="form-select"
                        value={selectedRoleId || ''}
                        onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                        disabled={rolesLoading}
                    >
                        <option value="" disabled>
                            {rolesLoading ? 'Loading roles...' : 'Select Role'}
                        </option>
                        {rolesList.map((role: any) => {
                            const roleId = role.id || role;
                            const roleName = role.name || role.label || role.value || role;
                            return (
                                <option key={roleId} value={roleId}>
                                    {roleName}
                                </option>
                            );
                        })}
                    </select>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={saveRolePermissions}
                        disabled={permissionsLoading || !selectedRoleId || !permissionsDirty || !canUpdatePermissions}
                    >
                        {permissionsLoading ? 'Saving...' : 'Save Permissions'}
                    </button>
                </div>
            </div>

            <div className="panel mt-5">
                {permissionsLoading && (
                    <div className="text-center py-8">Loading permissions...</div>
                )}

                {!permissionsLoading && canViewPermissions && (
                    <div className="table-responsive">
                        <table className="table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Module</th>
                                    <th className="!text-center">View</th>
                                    <th className="!text-center">Create</th>
                                    <th className="!text-center">Update</th>
                                    <th className="!text-center">Delete</th>
                                    <th className="!text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rolePermissions.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="!text-center font-semibold">
                                            No Modules Available
                                        </td>
                                    </tr>
                                )}
                                {rolePermissions.map((permission: any) => (
                                    <tr key={permission.module_id}>
                                        <td>
                                            <div className="font-semibold">{permission.module_name || permission.module_code}</div>
                                            <div className="text-xs text-gray-500">{permission.module_code}</div>
                                        </td>
                                        <td className="!text-center">
                                            <input
                                                type="checkbox"
                                                checked={!!permission.can_view}
                                                disabled={!canUpdatePermissions}
                                                onChange={(e) => updatePermission(permission.module_id, 'can_view', e.target.checked)}
                                            />
                                        </td>
                                        <td className="!text-center">
                                            <input
                                                type="checkbox"
                                                checked={!!permission.can_create}
                                                disabled={!canUpdatePermissions}
                                                onChange={(e) => updatePermission(permission.module_id, 'can_create', e.target.checked)}
                                            />
                                        </td>
                                        <td className="!text-center">
                                            <input
                                                type="checkbox"
                                                checked={!!permission.can_update}
                                                disabled={!canUpdatePermissions}
                                                onChange={(e) => updatePermission(permission.module_id, 'can_update', e.target.checked)}
                                            />
                                        </td>
                                        <td className="!text-center">
                                            <input
                                                type="checkbox"
                                                checked={!!permission.can_delete}
                                                disabled={!canUpdatePermissions}
                                                onChange={(e) => updatePermission(permission.module_id, 'can_delete', e.target.checked)}
                                            />
                                        </td>
                                        <td className="!text-center">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={() => deleteRolePermission(permission.module_id)}
                                                disabled={permissionsLoading || !selectedRoleId || !canDeletePermissions}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!permissionsLoading && !canViewPermissions && (
                    <div className="text-center py-8 font-semibold">You do not have permission to view role permissions.</div>
                )}
            </div>
        </div>
    );
};

export default ComponentsAppsRolePermissions;
