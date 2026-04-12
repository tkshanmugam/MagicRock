'use client';
import IconSearch from '@/components/icon/icon-search';
import IconX from '@/components/icon/icon-x';
import IconFile from '@/components/icon/icon-file';
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { getTranslation } from '@/i18n';

const ComponentsAppsRoles = () => {
    const { t } = getTranslation();
    const [loading, setLoading] = useState<boolean>(false);
    const [search, setSearch] = useState<string>('');
    const [rolesList, setRolesList] = useState<any[]>([]);
    const [filteredItems, setFilteredItems] = useState<any[]>([]);
    const [addRoleModal, setAddRoleModal] = useState<boolean>(false);
    const [defaultParams] = useState({
        id: null,
        name: '',
    });
    const [params, setParams] = useState<any>(JSON.parse(JSON.stringify(defaultParams)));
    const canViewRoles = organizationContext.hasPermission('Roles', 'view');
    const canCreateRoles = organizationContext.hasPermission('Roles', 'create');
    const canUpdateRoles = organizationContext.hasPermission('Roles', 'update');
    const canDeleteRoles = organizationContext.hasPermission('Roles', 'delete');

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
            setLoading(true);
            const response = await apiGet<any>('roles');
            const roles = Array.isArray(response) ? response : response.data || response.results || [];
            setRolesList(roles);
            setFilteredItems(roles);
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
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authState.isAuthStateReady()) {
            fetchRoles();
        } else {
            let attempts = 0;
            const maxAttempts = 20; // 20 * 100ms = 2 seconds
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
        const normalizedSearch = search.toLowerCase();
        setFilteredItems(
            rolesList.filter((role: any) => {
                const name = String(role.name || role.label || role.value || role || '').toLowerCase();
                return name.includes(normalizedSearch);
            })
        );
    }, [search, rolesList]);

    const changeValue = (e: any) => {
        const { value, id } = e.target;
        setParams({ ...params, [id]: value });
    };

    const editRole = (role: any = null) => {
        const json = JSON.parse(JSON.stringify(defaultParams));
        setParams(json);
        if (role) {
            const json1 = JSON.parse(JSON.stringify(role));
            setParams(json1);
        }
        setAddRoleModal(true);
    };

    const saveRole = async () => {
        if (!params.name || !params.name.trim()) {
            showMessage('Role name is required.', 'error');
            return;
        }

        try {
            setLoading(true);
            const roleData = {
                name: params.name.trim(),
            };
            
            if (params.id) {
                await apiPut(`roles/${params.id}`, roleData);
                showMessage('Role has been updated successfully.');
            } else {
                await apiPost('roles', roleData);
                showMessage('Role has been created successfully.');
            }

            await fetchRoles();
            setAddRoleModal(false);
            setParams(JSON.parse(JSON.stringify(defaultParams)));
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to save role';
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

    const deleteRole = async (role: any = null) => {
        if (!role || !role.id) {
            showMessage('Invalid role', 'error');
            return;
        }

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
            await apiDelete(`roles/${role.id}`);
            showMessage('Role has been deleted successfully.');
            await fetchRoles();
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to delete role';
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
                <h2 className="text-xl">Role Management</h2>
                <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search Role..."
                            className="form-input py-2 ltr:pr-11 rtl:pl-11"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button type="button" className="absolute top-1/2 -translate-y-1/2 hover:opacity-80 ltr:right-2 rtl:left-2">
                            <IconSearch className="mx-auto" />
                        </button>
                    </div>
                    <div>
                        <button type="button" className="btn btn-primary gap-2" onClick={() => editRole()} disabled={!canCreateRoles}>
                            <IconFile className="ltr:mr-2 rtl:ml-2" />
                            Add Role
                        </button>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="panel mt-5">
                    <div className="text-center py-8">Loading...</div>
                </div>
            )}

            {!loading && canViewRoles && (
                <div className="panel mt-5 overflow-hidden border-0 p-0">
                    <div className="table-responsive">
                        <table className="table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>{t('th_id')}</th>
                                    <th>{t('th_name')}</th>
                                    <th className="!text-center">{t('th_actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="!text-center font-semibold">
                                            No Roles Available
                                        </td>
                                    </tr>
                                )}
                                {filteredItems.map((role: any) => {
                                    const roleId = role.id || role;
                                    const roleName = role.name || role.label || role.value || role;
                                    return (
                                        <tr key={roleId}>
                                            <td>
                                                <div className="font-semibold">{roleId}</div>
                                            </td>
                                            <td>
                                                <div className="font-semibold">{roleName}</div>
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-center gap-4">
                                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editRole(role)} disabled={!canUpdateRoles}>
                                                        Edit
                                                    </button>
                                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteRole(role)} disabled={!canDeleteRoles}>
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

            {!loading && !canViewRoles && (
                <div className="panel mt-5">
                    <div className="text-center py-8 font-semibold">You do not have permission to view roles.</div>
                </div>
            )}

            <Transition appear show={addRoleModal} as={Fragment}>
                <Dialog as="div" open={addRoleModal} onClose={() => setAddRoleModal(false)} className="relative z-50">
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
                                        onClick={() => setAddRoleModal(false)}
                                        className="absolute top-4 text-gray-400 outline-none hover:text-gray-800 ltr:right-4 rtl:left-4 dark:hover:text-gray-600"
                                    >
                                        <IconX />
                                    </button>
                                    <div className="bg-[#fbfbfb] py-3 text-lg font-medium ltr:pl-5 ltr:pr-[50px] rtl:pl-[50px] rtl:pr-5 dark:bg-[#121c2c]">
                                        {params.id ? 'Edit Role' : 'Add Role'}
                                    </div>
                                    <div className="p-5">
                                        <form>
                                            <div className="mb-5">
                                                <label htmlFor="name">Role Name <span className="text-danger">*</span></label>
                                                <input
                                                    id="name"
                                                    type="text"
                                                    placeholder="Enter Role Name"
                                                    className="form-input"
                                                    value={params.name}
                                                    onChange={(e) => changeValue(e)}
                                                    required
                                                />
                                            </div>
                                            <div className="mt-8 flex items-center justify-end">
                                                <button type="button" className="btn btn-outline-danger" onClick={() => setAddRoleModal(false)}>
                                                    Discard
                                                </button>
                                                <button type="button" className="btn btn-primary ltr:ml-4 rtl:mr-4" onClick={saveRole} disabled={loading}>
                                                    {loading ? 'Saving...' : 'Save'}
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

export default ComponentsAppsRoles;
