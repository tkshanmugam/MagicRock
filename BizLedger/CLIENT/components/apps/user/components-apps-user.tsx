'use client';
import IconLayoutGrid from '@/components/icon/icon-layout-grid';
import IconListCheck from '@/components/icon/icon-list-check';
import IconSearch from '@/components/icon/icon-search';
import IconUser from '@/components/icon/icon-user';
import IconUserPlus from '@/components/icon/icon-user-plus';
import IconX from '@/components/icon/icon-x';
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';

const ComponentsAppsUser = () => {
    const [addUserModal, setAddUserModal] = useState<any>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const [value, setValue] = useState<any>('list');
    const [defaultParams] = useState({
        id: null,
        username: '',
        password: '',
        full_name: '',
        role: '',
        organisations: [] as number[],
    });

    const [params, setParams] = useState<any>(JSON.parse(JSON.stringify(defaultParams)));

    const [search, setSearch] = useState<any>('');
    const [userList, setUserList] = useState<any>([]);
    const [rolesList, setRolesList] = useState<any>([]);
    const [organisationsList, setOrganisationsList] = useState<any>([]);

    const [filteredItems, setFilteredItems] = useState<any>([]);
    const canViewUsers = organizationContext.hasPermission('Users', 'view');
    const canCreateUsers = organizationContext.hasPermission('Users', 'create');
    const canUpdateUsers = organizationContext.hasPermission('Users', 'update');
    const canDeleteUsers = organizationContext.hasPermission('Users', 'delete');
    const selectedRoleId = params.role || params.role_id || '';
    const selectedRole = rolesList.find((role: any) => String(role.id || role) === String(selectedRoleId));
    const selectedRoleLabel = selectedRole?.name || selectedRole?.label || selectedRole?.value || (selectedRoleId ? `Role #${selectedRoleId}` : 'Selected Role');
    const isSuperAdmin = organizationContext.getIsSuperAdmin();

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

    // Fetch organisations from API (using old organisations table)
    const fetchOrganisations = useCallback(async () => {
        try {
            console.log('[fetchOrganisations] Starting fetch...');
            console.log('[fetchOrganisations] Calling apiGet("organisations")...');
            console.log('[fetchOrganisations] API_BASE_URL from env:', process.env.NEXT_PUBLIC_API_BASE_URL);
            
            // Use old organisations endpoint
            const response = await apiGet<any>('organisations');
            
            console.log('[fetchOrganisations] Raw API response:', response);
            console.log('[fetchOrganisations] Response type:', typeof response);
            console.log('[fetchOrganisations] Is array?', Array.isArray(response));
            
            // Handle different response structures
            let organisations: any[] = [];
            if (Array.isArray(response)) {
                organisations = response;
            } else if (response && typeof response === 'object') {
                organisations = response.data || response.results || response.items || [];
            }
            
            console.log('[fetchOrganisations] Parsed organisations:', organisations);
            console.log('[fetchOrganisations] Number of organisations:', organisations.length);
            console.log('[fetchOrganisations] Setting organisationsList state...');
            
            setOrganisationsList(organisations);
            
            console.log('[fetchOrganisations] State updated. Current organisationsList will be:', organisations);
            
            if (organisations.length === 0) {
                console.warn('[fetchOrganisations] No organisations found in RBAC system. Please create organisations first via POST /api/v1/organisations');
            } else {
                console.log('[fetchOrganisations] Successfully loaded', organisations.length, 'organisations');
            }
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch organisations';
            console.error('[fetchOrganisations] ERROR:', errorMessage);
            console.error('[fetchOrganisations] Full error:', error);
            console.error('[fetchOrganisations] Error stack:', error.stack);
            
            const isAuthError =
                error.isAuthError ||
                errorMessage.includes('401') ||
                errorMessage.includes('Unauthorized') ||
                errorMessage.includes('Token refresh failed') ||
                errorMessage.includes('No refresh token') ||
                errorMessage.toLowerCase().includes('token');

            if (!isAuthError) {
                console.error('[fetchOrganisations] Non-auth error. Setting empty list.');
                // Set empty list on error to avoid showing stale data
                setOrganisationsList([]);
                // Show user-friendly error message
                showMessage(`Failed to load organisations: ${errorMessage}`, 'error');
            } else {
                // On auth error, don't update the list
                console.warn('[fetchOrganisations] Auth error. Not updating list.');
            }
        }
    }, []);

    // Fetch roles from API
    const fetchRoles = useCallback(async () => {
        try {
            const response = await apiGet<any>('roles');
            // Handle different response structures
            const roles = Array.isArray(response) ? response : response.data || response.results || [];
            // Filter out "super admin" role as it's a default system role and shouldn't be assignable
            const filteredRoles = roles.filter((role: any) => {
                const roleName = (role.name || role.label || role.value || role).toLowerCase();
                return !roleName.includes('super admin') && !roleName.includes('superadmin') && roleName !== 'super_admin';
            });
            setRolesList(filteredRoles);
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
                // Don't show error for roles - it's not critical
                console.error('Failed to fetch roles:', errorMessage);
            }
        }
    }, []);

    // Fetch users from API
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiGet<any>('users');
            // Handle different response structures
            const users = Array.isArray(response) ? response : response.data || response.results || [];
            console.log('Fetched users:', users);
            console.log('Sample user:', users[0]);
            setUserList(users);
            setFilteredItems(users);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch users';
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
            // Silently handle auth errors - AuthGuard will redirect
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Wait for auth state to be ready before making API calls
        // This prevents API calls from firing before authentication is confirmed
        const checkAndFetch = () => {
            if (authState.isAuthStateReady()) {
                fetchOrganisations();
                fetchRoles();
                if (canViewUsers) {
                    fetchUsers();
                }
            } else {
                // Poll until auth state is ready (max 2 seconds)
                let attempts = 0;
                const maxAttempts = 20; // 20 * 100ms = 2 seconds
                const interval = setInterval(() => {
                    attempts++;
                    if (authState.isAuthStateReady() || attempts >= maxAttempts) {
                        clearInterval(interval);
                        if (authState.isAuthStateReady()) {
                            fetchOrganisations();
                            fetchRoles();
                            if (canViewUsers) {
                                fetchUsers();
                            }
                        }
                    }
                }, 100);
                
                return () => clearInterval(interval);
            }
        };
        
        checkAndFetch();
    }, [fetchUsers, fetchRoles, fetchOrganisations, canViewUsers, isSuperAdmin]);
    
    // Also fetch organisations when modal opens
    useEffect(() => {
        if (addUserModal) {
            console.log('[useEffect] User modal opened, fetching organisations...');
            fetchOrganisations();
            fetchRoles(); // Also ensure roles are loaded
        }
    }, [addUserModal, fetchOrganisations, fetchRoles, isSuperAdmin]);

    useEffect(() => {
        if (addUserModal && !params.id) {
            setParams((current: any) => ({
                ...current,
                username: '',
                password: '',
            }));
        }
    }, [addUserModal, params.id]);
    
        // Ensure organisations and roles are selected correctly when lists are loaded (only for edit mode)
    useEffect(() => {
        if (addUserModal && params.id && organisationsList.length > 0 && rolesList.length > 0) {
            // Only update if role or organisations need fixing
            const needsUpdate = 
                (params.role_id && params.role !== String(params.role_id)) ||
                (params.organisations && Array.isArray(params.organisations) && params.organisations.some((id: any) => typeof id !== 'number'));
            
            if (needsUpdate) {
                const currentParams = { ...params };
                
                // Ensure role is set correctly from role_id
                if (currentParams.role_id && currentParams.role !== String(currentParams.role_id)) {
                    currentParams.role = String(currentParams.role_id);
                }
                
                // Ensure organisations are properly formatted as numbers
                if (currentParams.organisations && Array.isArray(currentParams.organisations)) {
                    currentParams.organisations = currentParams.organisations.map((orgId: any) => {
                        const id = typeof orgId === 'object' ? (orgId.id || orgId) : orgId;
                        return typeof id === 'number' ? id : parseInt(String(id), 10);
                    }).filter((id: any) => !isNaN(id));
                }
                
                setParams(currentParams);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organisationsList.length, rolesList.length, addUserModal, params.id]);

    const changeValue = (e: any) => {
        const { value, id } = e.target;
        if (id === 'organisations') {
            // Handle multi-select for organisations
            const selectedOptions = Array.from(e.target.selectedOptions, (option: any) => {
                const val = option.value;
                // Try to parse as number, fallback to string
                const numVal = parseInt(val, 10);
                return isNaN(numVal) ? val : numVal;
            });
            setParams({ ...params, [id]: selectedOptions });
        } else {
            setParams({ ...params, [id]: value });
        }
    };

    const searchUser = () => {
        setFilteredItems(() => {
            return userList.filter((item: any) => {
                return item.username?.toLowerCase().includes(search.toLowerCase());
            });
        });
    };

    useEffect(() => {
        searchUser();
    }, [search, userList]);

    const saveUser = async () => {
        if (!params.username) {
            showMessage('Username is required.', 'error');
            return;
        }
        if (!params.id && !params.password) {
            showMessage('Password is required for new users.', 'error');
            return;
        }
        if (!params.id && !params.full_name) {
            showMessage('Full name is required for new users.', 'error');
            return;
        }
        // Validate role is selected when assigning to organisations
        if (params.organisations && Array.isArray(params.organisations) && params.organisations.length > 0 && !params.role) {
            showMessage('Role is required when assigning user to organisations.', 'error');
            return;
        }

        try {
            setLoading(true);
            const userData: any = {
                username: params.username,
            };

            // For new users, include password and full_name
            if (!params.id) {
                userData.password = params.password;
                userData.full_name = params.full_name;
            } else {
                // For updates, include full_name if provided
                if (params.full_name) {
                    userData.full_name = params.full_name;
                }
                // Include role for updates if provided
                if (params.role) {
                    userData.role = params.role ? (typeof params.role === 'string' ? parseInt(params.role, 10) : params.role) : null;
                }
                // Only include password if it's provided (for password updates)
                if (params.password) {
                    userData.password = params.password;
                }
            }

            let userId: number | null = null;

            if (params.id) {
                // Update user
                await apiPut(`users/${params.id}`, userData);
                userId = params.id;
                showMessage('User has been updated successfully.');
            } else {
                // Create new user
                const createdUser = await apiPost('users', userData);
                // Extract user ID from response (handle different response structures)
                userId = createdUser?.id || createdUser?.data?.id || createdUser?.user?.id || null;
                if (!userId) {
                    throw new Error('Failed to get user ID from creation response');
                }
                showMessage('User has been created successfully.');
            }

            // Assign user to organisations if any are selected
            if (userId && params.organisations && Array.isArray(params.organisations) && params.organisations.length > 0) {
                try {
                    // Get role_id from params.role (convert to number if it's a string)
                    const roleId = params.role ? (typeof params.role === 'string' ? parseInt(params.role, 10) : params.role) : null;
                    
                    if (!roleId) {
                        throw new Error('Role ID is required when assigning user to organisations');
                    }
                    
                    // Assign user to each selected organisation with the selected role
                    // Use the endpoint that accepts old organisation IDs
                    const assignPromises = params.organisations.map(async (orgId: any) => {
                        const organisationId = orgId.id || orgId;
                        // POST /api/v1/organisations/from-organisation/{organisation_id}/users
                        await apiPost(`organisations/from-organisation/${organisationId}/users`, { 
                            user_id: userId,
                            role_id: roleId
                        });
                    });
                    await Promise.all(assignPromises);
                } catch (orgError: any) {
                    // Log error but don't fail the entire operation
                    console.error('Error assigning user to organisations:', orgError);
                    showMessage('User created/updated, but some organisation assignments may have failed.', 'warning');
                }
            }

            // Refresh the list
            await fetchUsers();
            setAddUserModal(false);
            setParams(JSON.parse(JSON.stringify(defaultParams)));
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to save user';
            // Don't show error if it's an auth-related error - AuthGuard will handle redirect
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
            setLoading(false);
        }
    };

    const editUser = (user: any = null) => {
        const json = JSON.parse(JSON.stringify(defaultParams));
        setParams(json);
        if (user) {
            let json1 = JSON.parse(JSON.stringify(user));
            console.log('Editing user data:', json1);
            
            // Don't include password when editing (it's optional)
            delete json1.password;
            
            // Handle role - prioritize role_id, then look up role name if needed
            if (json1.role_id) {
                // Use role_id directly if available
                json1.role = String(json1.role_id);
                console.log('Setting role from role_id:', json1.role);
            } else if (json1.role) {
                // If role is an object, extract ID
                if (typeof json1.role === 'object' && json1.role.id) {
                    json1.role = String(json1.role.id);
                } else if (typeof json1.role === 'string') {
                    // If role is a string (name), find the matching role ID from rolesList
                    const foundRole = rolesList.find((r: any) => {
                        const roleName = r.name || r.label || r.value || r;
                        return String(roleName).toLowerCase() === String(json1.role).toLowerCase();
                    });
                    if (foundRole) {
                        json1.role = String(foundRole.id || foundRole);
                        console.log('Found role ID from name:', json1.role);
                    } else {
                        // If not found, try to use it as ID
                        json1.role = String(json1.role);
                    }
                } else {
                    json1.role = String(json1.role);
                }
            } else {
                json1.role = '';
            }
            
            // Handle organisations - backend returns array of IDs
            if (json1.organisations && Array.isArray(json1.organisations)) {
                // If organisations is an array of objects, extract IDs
                if (json1.organisations.length > 0 && typeof json1.organisations[0] === 'object') {
                    json1.organisations = json1.organisations.map((org: any) => org.id || org);
                }
                // Ensure all values are numbers/strings for comparison
                json1.organisations = json1.organisations.map((orgId: any) => {
                    const id = typeof orgId === 'object' ? (orgId.id || orgId) : orgId;
                    return typeof id === 'number' ? id : parseInt(String(id), 10);
                }).filter((id: any) => !isNaN(id));
                console.log('Setting organisations:', json1.organisations);
            } else {
                json1.organisations = [];
            }
            
            console.log('Final params for edit:', json1);
            setParams(json1);
        }
        setAddUserModal(true);
    };

    const deleteUser = async (user: any = null) => {
        if (!user || !user.id) {
            showMessage('Invalid user', 'error');
            return;
        }

        // Confirm deletion
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
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
            setLoading(true);
            await apiDelete(`users/${user.id}`);
            showMessage('User has been deleted successfully.');
            // Refresh the list
            await fetchUsers();
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to delete user';
            // Don't show error if it's an auth-related error - AuthGuard will handle redirect
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
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl">User Management</h2>
                <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex gap-3">
                        <div>
                            <button type="button" className="btn btn-primary" onClick={() => editUser()} disabled={!canCreateUsers}>
                                <IconUserPlus className="ltr:mr-2 rtl:ml-2" />
                                Add User
                            </button>
                        </div>
                        <div>
                            <button type="button" className={`btn btn-outline-primary p-2 ${value === 'list' && 'bg-primary text-white'}`} onClick={() => setValue('list')}>
                                <IconListCheck />
                            </button>
                        </div>
                        <div>
                            <button type="button" className={`btn btn-outline-primary p-2 ${value === 'grid' && 'bg-primary text-white'}`} onClick={() => setValue('grid')}>
                                <IconLayoutGrid />
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <input type="text" placeholder="Search User" className="peer form-input py-2 ltr:pr-11 rtl:pl-11" value={search} onChange={(e) => setSearch(e.target.value)} />
                        <button type="button" className="absolute top-1/2 -translate-y-1/2 peer-focus:text-primary ltr:right-[11px] rtl:left-[11px]">
                            <IconSearch className="mx-auto" />
                        </button>
                    </div>
                </div>
            </div>
            {loading && (
                <div className="panel mt-5">
                    <div className="text-center py-8">Loading...</div>
                </div>
            )}
            {!loading && value === 'list' && canViewUsers && (
                <div className="panel mt-5 overflow-hidden border-0 p-0">
                    <div className="table-responsive">
                        <table className="table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Organisations</th>
                                    <th className="!text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="!text-center font-semibold">
                                            No User Available
                                        </td>
                                    </tr>
                                )}
                                {filteredItems.map((user: any) => {
                                    // Debug: log user data
                                    if (process.env.NODE_ENV === 'development' && filteredItems.indexOf(user) === 0) {
                                        console.log('Sample user data:', user);
                                        console.log('User role:', user.role, 'role_id:', user.role_id);
                                        console.log('User organisations:', user.organisations);
                                    }
                                    
                                    return (
                                        <tr key={user.id}>
                                            <td>
                                                <div className="flex w-max items-center">
                                                    {!user.username && (
                                                        <div className="rounded-full border border-gray-300 p-2 ltr:mr-2 rtl:ml-2 dark:border-gray-800">
                                                            <IconUser className="h-4.5 w-4.5" />
                                                        </div>
                                                    )}
                                                    <div className="font-semibold">{user.username}</div>
                                                </div>
                                            </td>
                                            <td>
                                                {(() => {
                                                    // Backend returns role as string (name) or role_id as number
                                                    if (user.role) {
                                                        // If role name is directly provided, use it
                                                        return user.role;
                                                    } else if (user.role_id) {
                                                        // If only role_id is provided, look it up
                                                        const role = rolesList.find((r: any) => String(r.id || r) === String(user.role_id));
                                                        return role ? (role.name || role.label || role.value || role) : `Role ID: ${user.role_id}`;
                                                    }
                                                    return '-';
                                                })()}
                                            </td>
                                            <td>
                                                {user.organisations && Array.isArray(user.organisations) && user.organisations.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.organisations.map((orgId: any, index: number) => {
                                                            // orgId is a number (ID) from backend
                                                            const orgIdValue = typeof orgId === 'object' ? (orgId.id || orgId) : orgId;
                                                            const org = organisationsList.find((o: any) => {
                                                                const oId = o.id || o;
                                                                return String(oId) === String(orgIdValue);
                                                            });
                                                            const orgName = org ? (org.name || org) : (typeof orgId === 'object' ? (orgId.name || orgId) : `Org ID: ${orgIdValue}`);
                                                            return (
                                                                <span key={index} className="badge bg-primary/10 text-primary">
                                                                    {orgName}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-center gap-4">
                                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editUser(user)} disabled={!canUpdateUsers}>
                                                        Edit
                                                    </button>
                                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteUser(user)} disabled={!canDeleteUsers}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && value === 'grid' && canViewUsers && (
                <div className="mt-5 grid w-full grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {filteredItems.length === 0 && (
                        <div className="col-span-full text-center font-semibold">No User Available</div>
                    )}
                    {filteredItems.map((user: any) => {
                        return (
                            <div className="relative overflow-hidden rounded-md bg-white text-center shadow dark:bg-[#1c232f]" key={user.id}>
                                <div className="rounded-md bg-white px-6 py-6 shadow-md dark:bg-gray-900">
                                    <div className="mb-4 flex justify-center">
                                        <div className="grid h-16 w-16 place-content-center rounded-full bg-primary text-2xl font-semibold text-white">
                                            {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                    </div>
                                    <div className="text-xl font-semibold">{user.username}</div>
                                    <div className="mt-6 grid grid-cols-1 gap-4 ltr:text-left rtl:text-right">
                                        <div className="flex items-center">
                                            <div className="flex-none ltr:mr-2 rtl:ml-2">Role :</div>
                                            <div className="text-white-dark">
                                                {(() => {
                                                    const roleId = user.role || user.role_id;
                                                    if (!roleId) return '-';
                                                    const role = rolesList.find((r: any) => String(r.id || r) === String(roleId));
                                                    return role ? (role.name || role.label || role.value || role) : roleId;
                                                })()}
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            <div className="flex-none ltr:mr-2 rtl:ml-2">Organisations :</div>
                                            <div className="text-white-dark">
                                                {user.organisations && Array.isArray(user.organisations) && user.organisations.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {user.organisations.map((orgId: any, index: number) => {
                                                            const org = organisationsList.find((o: any) => (o.id || o) === (orgId.id || orgId));
                                                            const orgName = org ? (org.name || org) : (orgId.name || orgId);
                                                            return (
                                                                <span key={index} className="badge bg-primary/10 text-primary text-xs">
                                                                    {orgName}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex w-full gap-4">
                                        <button type="button" className="btn btn-outline-primary w-1/2" onClick={() => editUser(user)} disabled={!canUpdateUsers}>
                                            Edit
                                        </button>
                                        <button type="button" className="btn btn-outline-danger w-1/2" onClick={() => deleteUser(user)} disabled={!canDeleteUsers}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && !canViewUsers && (
                <div className="panel mt-5">
                    <div className="text-center py-8 font-semibold">You do not have permission to view users.</div>
                </div>
            )}

            <Transition appear show={addUserModal} as={Fragment}>
                <Dialog as="div" open={addUserModal} onClose={() => setAddUserModal(false)} className="relative z-50">
                    <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-[black]/60" />
                    </TransitionChild>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center px-4 py-8">
                            <TransitionChild
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <DialogPanel className="panel w-full max-w-lg overflow-hidden rounded-lg border-0 p-0 text-black dark:text-white-dark">
                                    <button
                                        type="button"
                                        onClick={() => setAddUserModal(false)}
                                        className="absolute top-4 text-gray-400 outline-none hover:text-gray-800 ltr:right-4 rtl:left-4 dark:hover:text-gray-600"
                                    >
                                        <IconX />
                                    </button>
                                    <div className="bg-[#fbfbfb] py-3 text-lg font-medium ltr:pl-5 ltr:pr-[50px] rtl:pl-[50px] rtl:pr-5 dark:bg-[#121c2c]">
                                        {params.id ? 'Edit User' : 'Add User'}
                                    </div>
                                    <div className="p-5">
                                        <form autoComplete="off">
                                            <div className="mb-5">
                                                <label htmlFor="username">Username</label>
                                                <input
                                                    id="username"
                                                    type="text"
                                                    placeholder="Enter Username"
                                                    className="form-input"
                                                    value={params.username}
                                                    onChange={(e) => changeValue(e)}
                                                    autoComplete="off"
                                                    required
                                                />
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="full_name">Full Name</label>
                                                <input id="full_name" type="text" placeholder="Enter Full Name" className="form-input" value={params.full_name} onChange={(e) => changeValue(e)} required={!params.id} />
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="password">
                                                    Password {params.id && <span className="text-xs text-gray-500">(leave empty to keep current password)</span>}
                                                </label>
                                                <input
                                                    id="password"
                                                    type="password"
                                                    placeholder={params.id ? "Enter new password (optional)" : "Enter Password"}
                                                    className="form-input"
                                                    value={params.password}
                                                    onChange={(e) => changeValue(e)}
                                                    autoComplete="new-password"
                                                    required={!params.id}
                                                />
                                            </div>
                                            {isSuperAdmin ? (
                                                <div className="mb-5">
                                                    <label htmlFor="role">
                                                        Role {params.organisations && Array.isArray(params.organisations) && params.organisations.length > 0 && <span className="text-red-500">*</span>}
                                                    </label>
                                                    <select 
                                                        id="role" 
                                                        className="form-select" 
                                                        value={params.role} 
                                                        onChange={(e) => changeValue(e)} 
                                                        required={params.organisations && Array.isArray(params.organisations) && params.organisations.length > 0}
                                                    >
                                                        <option value="">Select Role</option>
                                                        {rolesList.map((role: any) => {
                                                            const roleId = role.id || role;
                                                            const roleName = role.name || role.label || role.value || role;
                                                            return (
                                                                <option key={roleId} value={String(roleId)}>
                                                                    {roleName}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="mb-5">
                                                    <label htmlFor="role">Role</label>
                                                    <select id="role" className="form-select" value={String(selectedRoleId)} disabled>
                                                        <option value={String(selectedRoleId)}>{selectedRoleLabel}</option>
                                                    </select>
                                                </div>
                                            )}
                                            {isSuperAdmin ? (
                                                <div className="mb-5">
                                                    <div className="flex items-center justify-between mb-2">
                                                    <label htmlFor="organisations">Organisations</label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                console.log('Manual refresh clicked');
                                                                fetchOrganisations();
                                                            }}
                                                            className="text-xs text-blue-500 hover:text-blue-700 underline"
                                                        >
                                                            Refresh
                                                        </button>
                                                    </div>
                                                    <select 
                                                        id="organisations" 
                                                        className="form-select" 
                                                        onChange={(e) => changeValue(e)} 
                                                        multiple
                                                        size={5}
                                                    >
                                                        {organisationsList.length === 0 ? (
                                                            <option value="" disabled>No organisations available. Please create organisations first.</option>
                                                        ) : (
                                                            organisationsList.map((org: any) => {
                                                            const orgId = org.id || org;
                                                            const orgName = org.name || org;
                                                            const currentOrgs = Array.isArray(params.organisations) ? params.organisations : [];
                                                                // Normalize both values to numbers for comparison
                                                                const orgIdNum = typeof orgId === 'number' ? orgId : parseInt(String(orgId), 10);
                                                            const isSelected = currentOrgs.some((id: any) => {
                                                                    const idValue = typeof id === 'object' ? (id.id || id) : id;
                                                                    const idNum = typeof idValue === 'number' ? idValue : parseInt(String(idValue), 10);
                                                                    return !isNaN(orgIdNum) && !isNaN(idNum) && orgIdNum === idNum;
                                                            });
                                                            return (
                                                                <option key={orgId} value={String(orgId)} selected={isSelected}>
                                                                    {orgName}
                                                                </option>
                                                            );
                                                            })
                                                        )}
                                                    </select>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {organisationsList.length === 0 
                                                            ? "No organisations found in RBAC system. Please create organisations first via POST /api/v1/organisations or use the Organisations management page."
                                                            : "Hold Ctrl (or Cmd on Mac) to select multiple organisations"
                                                        }
                                                    </div>
                                                    {params.organisations && Array.isArray(params.organisations) && params.organisations.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {params.organisations.map((orgId: any, index: number) => {
                                                                const org = organisationsList.find((o: any) => {
                                                                    const oId = o.id || o;
                                                                    const idValue = orgId.id || orgId;
                                                                    return String(oId) === String(idValue);
                                                                });
                                                                const orgName = org ? (org.name || org) : (orgId.name || orgId);
                                                                return (
                                                                    <span key={index} className="badge bg-primary/10 text-primary">
                                                                        {orgName}
                                                                        <button
                                                                            type="button"
                                                                            className="ml-1 text-primary hover:text-primary-dark"
                                                                            onClick={() => {
                                                                                const newOrgs = params.organisations.filter((id: any) => {
                                                                                    const idValue = id.id || id;
                                                                                    const orgIdValue = orgId.id || orgId;
                                                                                    return String(idValue) !== String(orgIdValue);
                                                                                });
                                                                                setParams({ ...params, organisations: newOrgs });
                                                                            }}
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mb-5">
                                                    <label htmlFor="organisations">Organisations</label>
                                                    <select
                                                        id="organisations"
                                                        className="form-select"
                                                        disabled
                                                        multiple
                                                        size={5}
                                                    >
                                                        {(Array.isArray(params.organisations) ? params.organisations : [])
                                                            .map((orgId: any) => {
                                                                const idValue = typeof orgId === 'object' ? (orgId.id || orgId) : orgId;
                                                                const org = organisationsList.find((o: any) => String(o.id || o) === String(idValue));
                                                                const orgLabel = org?.name || `Organisation #${idValue}`;
                                                                return (
                                                                    <option key={String(idValue)} value={String(idValue)}>
                                                                        {orgLabel}
                                                                    </option>
                                                                );
                                                            })}
                                                    </select>
                                                </div>
                                            )}
                                            <div className="mt-8 flex items-center justify-end">
                                                <button type="button" className="btn btn-outline-danger" onClick={() => setAddUserModal(false)}>
                                                    Cancel
                                                </button>
                                                <button type="button" className="btn btn-primary ltr:ml-4 rtl:mr-4" onClick={saveUser} disabled={loading}>
                                                    {loading ? 'Saving...' : params.id ? 'Update' : 'Add'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </div>
    );
};

export default ComponentsAppsUser;
