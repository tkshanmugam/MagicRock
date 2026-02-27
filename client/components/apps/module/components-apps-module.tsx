'use client';
import IconLayoutGrid from '@/components/icon/icon-layout-grid';
import IconListCheck from '@/components/icon/icon-list-check';
import IconSearch from '@/components/icon/icon-search';
import IconX from '@/components/icon/icon-x';
import IconFile from '@/components/icon/icon-file';
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';

const ComponentsAppsModule = () => {
    const [addModuleModal, setAddModuleModal] = useState<any>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const [value, setValue] = useState<any>('list');
    const [defaultParams] = useState({
        id: null,
        code: '',
        name: '',
    });

    const [params, setParams] = useState<any>(JSON.parse(JSON.stringify(defaultParams)));

    const [search, setSearch] = useState<any>('');
    const [moduleList, setModuleList] = useState<any>([]);
    const [filteredItems, setFilteredItems] = useState<any>([]);
    const canViewModules = organizationContext.hasPermission('Modules', 'view');
    const canCreateModules = organizationContext.hasPermission('Modules', 'create');
    const canUpdateModules = organizationContext.hasPermission('Modules', 'update');
    const canDeleteModules = organizationContext.hasPermission('Modules', 'delete');

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

    // Fetch modules from API
    const fetchModules = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiGet<any>('modules');
            // Handle different response structures
            const modules = Array.isArray(response) ? response : response.data || response.results || [];
            setModuleList(modules);
            setFilteredItems(modules);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch modules';
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
        // Wait for auth state to be ready before making API calls
        // This prevents API calls from firing before authentication is confirmed
        if (authState.isAuthStateReady()) {
            fetchModules();
        } else {
            // Poll until auth state is ready (max 2 seconds)
            let attempts = 0;
            const maxAttempts = 20; // 20 * 100ms = 2 seconds
            const interval = setInterval(() => {
                attempts++;
                if (authState.isAuthStateReady() || attempts >= maxAttempts) {
                    clearInterval(interval);
                    if (authState.isAuthStateReady()) {
                        fetchModules();
                    }
                }
            }, 100);
            
            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const changeValue = (e: any) => {
        const { value, id } = e.target;
        setParams({ ...params, [id]: value });
    };

    const searchModule = () => {
        setFilteredItems(() => {
            return moduleList.filter((item: any) => {
                return (
                    item.code?.toLowerCase().includes(search.toLowerCase()) ||
                    item.name?.toLowerCase().includes(search.toLowerCase())
                );
            });
        });
    };

    useEffect(() => {
        searchModule();
    }, [search, moduleList]);

    const saveModule = async () => {
        if (!params.code) {
            showMessage('Module code is required.', 'error');
            return;
        }
        if (!params.name) {
            showMessage('Module name is required.', 'error');
            return;
        }

        try {
            setLoading(true);
            const moduleData: any = {
                code: params.code.trim(),
                name: params.name.trim(),
            };

            if (params.id) {
                // Update module
                await apiPut(`modules/${params.id}`, moduleData);
                showMessage('Module has been updated successfully.');
            } else {
                // Create new module
                await apiPost('modules', moduleData);
                showMessage('Module has been created successfully.');
            }

            // Refresh the list
            await fetchModules();
            // Close modal and reset params
            setAddModuleModal(false);
            setParams(JSON.parse(JSON.stringify(defaultParams)));
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to save module';
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

    const editModule = (module: any = null) => {
        const json = JSON.parse(JSON.stringify(defaultParams));
        setParams(json);
        if (module) {
            let json1 = JSON.parse(JSON.stringify(module));
            setParams(json1);
        }
        setAddModuleModal(true);
    };

    const deleteModule = async (module: any = null) => {
        if (!module || !module.id) {
            showMessage('Invalid module', 'error');
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
            await apiDelete(`modules/${module.id}`);
            showMessage('Module has been deleted successfully.');
            // Refresh the list
            await fetchModules();
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to delete module';
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
                <h2 className="text-xl">Module Management</h2>
                <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex gap-3">
                        <div>
                            <button
                                type="button"
                                className={`btn btn-outline-primary ${value === 'list' && 'active'}`}
                                onClick={() => setValue('list')}
                            >
                                <IconListCheck className="ltr:mr-2 rtl:ml-2" />
                                List
                            </button>
                        </div>
                        <div>
                            <button
                                type="button"
                                className={`btn btn-outline-primary ${value === 'grid' && 'active'}`}
                                onClick={() => setValue('grid')}
                            >
                                <IconLayoutGrid className="ltr:mr-2 rtl:ml-2" />
                                Grid
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search Module..."
                            className="form-input py-2 ltr:pr-11 rtl:pl-11"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button type="button" className="absolute top-1/2 -translate-y-1/2 hover:opacity-80 ltr:right-2 rtl:left-2">
                            <IconSearch className="mx-auto" />
                        </button>
                    </div>
                    <div>
                        <button type="button" className="btn btn-primary gap-2" onClick={() => editModule()} disabled={!canCreateModules}>
                            <IconFile className="ltr:mr-2 rtl:ml-2" />
                            Add Module
                        </button>
                    </div>
                </div>
            </div>
            {loading && (
                <div className="panel mt-5">
                    <div className="text-center py-8">Loading...</div>
                </div>
            )}
            {!loading && value === 'list' && canViewModules && (
                <div className="panel mt-5 overflow-hidden border-0 p-0">
                    <div className="table-responsive">
                        <table className="table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Name</th>
                                    <th className="!text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="!text-center font-semibold">
                                            No Module Available
                                        </td>
                                    </tr>
                                )}
                                {filteredItems.map((module: any) => {
                                    return (
                                        <tr key={module.id}>
                                            <td>
                                                <div className="font-semibold">{module.code}</div>
                                            </td>
                                            <td>
                                                <div className="font-semibold">{module.name}</div>
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-center gap-4">
                                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editModule(module)} disabled={!canUpdateModules}>
                                                        Edit
                                                    </button>
                                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteModule(module)} disabled={!canDeleteModules}>
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
            {!loading && value === 'grid' && canViewModules && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-5 panel p-0">
                    {filteredItems.length === 0 && (
                        <div className="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 text-center font-semibold py-8">
                            No Module Available
                        </div>
                    )}
                    {filteredItems.map((module: any) => {
                        return (
                            <div key={module.id} className="panel">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                                            <IconFile className="w-5 h-5" />
                                        </div>
                                        <div className="ltr:ml-3 rtl:mr-3">
                                            <p className="font-semibold">{module.code}</p>
                                            <p className="text-xs text-white-dark">{module.name}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 flex w-full gap-4">
                                    <button type="button" className="btn btn-outline-primary w-1/2" onClick={() => editModule(module)} disabled={!canUpdateModules}>
                                        Edit
                                    </button>
                                    <button type="button" className="btn btn-outline-danger w-1/2" onClick={() => deleteModule(module)} disabled={!canDeleteModules}>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {!loading && !canViewModules && (
                <div className="panel mt-5">
                    <div className="text-center py-8 font-semibold">You do not have permission to view modules.</div>
                </div>
            )}

            <Transition appear show={addModuleModal} as={Fragment}>
                <Dialog as="div" open={addModuleModal} onClose={() => setAddModuleModal(false)} className="relative z-50">
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
                                        onClick={() => setAddModuleModal(false)}
                                        className="absolute top-4 text-gray-400 outline-none hover:text-gray-800 ltr:right-4 rtl:left-4 dark:hover:text-gray-600"
                                    >
                                        <IconX />
                                    </button>
                                    <div className="bg-[#fbfbfb] py-3 text-lg font-medium ltr:pl-5 ltr:pr-[50px] rtl:pl-[50px] rtl:pr-5 dark:bg-[#121c2c]">
                                        {params.id ? 'Edit Module' : 'Add Module'}
                                    </div>
                                    <div className="p-5">
                                        <form>
                                            <div className="mb-5">
                                                <label htmlFor="code">Module Code <span className="text-danger">*</span></label>
                                                <input
                                                    id="code"
                                                    type="text"
                                                    placeholder="Enter Module Code (e.g., REPORTS)"
                                                    className="form-input"
                                                    value={params.code}
                                                    onChange={(e) => changeValue(e)}
                                                    required
                                                />
                                                <div className="mt-1 text-xs text-gray-500">Module code must be unique (uppercase recommended)</div>
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="name">Module Name <span className="text-danger">*</span></label>
                                                <input
                                                    id="name"
                                                    type="text"
                                                    placeholder="Enter Module Name (e.g., Reports Module)"
                                                    className="form-input"
                                                    value={params.name}
                                                    onChange={(e) => changeValue(e)}
                                                    required
                                                />
                                            </div>
                                            <div className="mt-8 flex items-center justify-end">
                                                <button type="button" onClick={() => setAddModuleModal(false)} className="btn btn-outline-danger">
                                                    Cancel
                                                </button>
                                                <button type="submit" onClick={saveModule} className="btn btn-primary ltr:ml-4 rtl:mr-4">
                                                    {loading && <span className="animate-spin border-2 border-white border-l-transparent rounded-full w-4 h-4 ltr:mr-1 rtl:ml-1 inline-block"></span>}
                                                    {params.id ? 'Update' : 'Add'}
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

export default ComponentsAppsModule;
