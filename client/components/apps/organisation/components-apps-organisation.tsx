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
import { apiGet, apiPost, apiPut, apiDelete, apiRequest } from '@/lib/apiClient';
import { authState } from '@/lib/authState';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const LOGO_MAX_SIZE_MB = Number(process.env.NEXT_PUBLIC_ORG_LOGO_MAX_SIZE_MB || 2);
const LOGO_MAX_SIZE_BYTES = LOGO_MAX_SIZE_MB * 1024 * 1024;
const LOGO_ALLOWED_TYPES = (process.env.NEXT_PUBLIC_ORG_LOGO_ALLOWED_TYPES || 'image/png,image/jpeg')
    .split(',')
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);
const LOGO_ALLOWED_EXTENSIONS = (process.env.NEXT_PUBLIC_ORG_LOGO_ALLOWED_EXTENSIONS || '.png,.jpg,.jpeg')
    .split(',')
    .map((ext) => ext.trim().toLowerCase())
    .filter(Boolean);
const buildUploadsBaseUrl = (apiBaseUrl: string) => {
    if (!apiBaseUrl) return '/uploads';
    try {
        const url = new URL(apiBaseUrl);
        const apiPath = url.pathname.replace(/\/$/, '');
        const normalizedPath = apiPath.includes('/api/') ? apiPath.slice(0, apiPath.indexOf('/api/')) : apiPath;
        url.pathname = `${normalizedPath}/uploads`.replace(/\/{2,}/g, '/');
        return url.toString().replace(/\/$/, '');
    } catch {
        const trimmed = apiBaseUrl.replace(/\/$/, '');
        const base = trimmed.includes('/api/') ? trimmed.slice(0, trimmed.indexOf('/api/')) : trimmed;
        return `${base}/uploads`;
    }
};

const UPLOADS_BASE_URL = buildUploadsBaseUrl(API_BASE_URL);

const ComponentsAppsOrganisation = () => {
    const [addOrganisationModal, setAddOrganisationModal] = useState<any>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const [value, setValue] = useState<any>('list');
    const [defaultParams] = useState({
        id: null,
        name: '',
        address: '',
        city: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        branch: '',
        logo_name: '',
    });

    const [params, setParams] = useState<any>(JSON.parse(JSON.stringify(defaultParams)));
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string>('');
    const [logoError, setLogoError] = useState<string>('');

    const [search, setSearch] = useState<any>('');
    const [organisationList, setOrganisationList] = useState<any>([]);

    const [filteredItems, setFilteredItems] = useState<any>([]);

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

    const getLogoUrl = useCallback((logoName: string) => {
        if (!logoName) return '';
        const normalized = logoName.startsWith('/') ? logoName.slice(1) : logoName;
        return `${UPLOADS_BASE_URL}/${normalized}`;
    }, []);

    const resetLogoState = useCallback(() => {
        setLogoFile(null);
        setLogoPreview('');
        setLogoError('');
    }, []);

    const setLogoFromOrganisation = useCallback(
        (organisation: any) => {
            setLogoFile(null);
            setLogoError('');
            if (organisation?.logo_name) {
                setLogoPreview(getLogoUrl(organisation.logo_name));
            } else {
                setLogoPreview('');
            }
        },
        [getLogoUrl]
    );

    useEffect(() => {
        return () => {
            if (logoPreview.startsWith('blob:')) {
                URL.revokeObjectURL(logoPreview);
            }
        };
    }, [logoPreview]);

    // Fetch organisations from API
    const fetchOrganisations = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiGet<any>('organisations');
            // Handle different response structures
            const organisations = Array.isArray(response) ? response : response.data || response.results || [];
            setOrganisationList(organisations);
            setFilteredItems(organisations);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch organisations';
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
                        }
                    }
                }, 100);
                
                return () => clearInterval(interval);
            }
        };
        
        checkAndFetch();
    }, [fetchOrganisations]);

    const changeValue = (e: any) => {
        const { value, id } = e.target;
        setParams({ ...params, [id]: value });
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (!file) {
            resetLogoState();
            return;
        }

        const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}`.toLowerCase() : '';
        const contentType = (file.type || '').toLowerCase();
        if (!LOGO_ALLOWED_EXTENSIONS.includes(extension) || !LOGO_ALLOWED_TYPES.includes(contentType)) {
            setLogoError('Only PNG, JPG, JPEG files are allowed');
            setLogoFile(null);
            if (params?.logo_name) {
                setLogoPreview(getLogoUrl(params.logo_name));
            } else {
                setLogoPreview('');
            }
            return;
        }

        if (file.size > LOGO_MAX_SIZE_BYTES) {
            setLogoError(`Logo size must be less than or equal to ${LOGO_MAX_SIZE_MB} MB`);
            setLogoFile(null);
            if (params?.logo_name) {
                setLogoPreview(getLogoUrl(params.logo_name));
            } else {
                setLogoPreview('');
            }
            return;
        }

        setLogoError('');
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const uploadOrganisationLogo = async (organisationId: number) => {
        if (!logoFile) return null;
        const formData = new FormData();
        formData.append('file', logoFile);
        const response = await apiRequest(`organisations/${organisationId}/logo`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to upload logo' }));
            throw new Error(error.detail || 'Failed to upload logo');
        }
        return response.json();
    };

    const searchOrganisation = () => {
        setFilteredItems(() => {
            return organisationList.filter((item: any) => {
                return item.name?.toLowerCase().includes(search.toLowerCase());
            });
        });
    };

    useEffect(() => {
        searchOrganisation();
    }, [search, organisationList]);

    const saveOrganisation = async () => {
        if (!params.name) {
            showMessage('Name is required.', 'error');
            return;
        }
        if (!params.address) {
            showMessage('Address is required.', 'error');
            return;
        }
        if (logoError) {
            showMessage(logoError, 'error');
            return;
        }

        try {
            setLoading(true);
            const organisationData = {
                name: params.name,
                address: params.address,
                city: params.city || '',
                bank_name: params.bank_name || '',
                account_number: params.account_number || '',
                ifsc_code: params.ifsc_code || '',
                branch: params.branch || '',
            };

            let organisationId = params.id;
            if (params.id) {
                // Update organisation
                await apiPut(`organisations/${params.id}`, organisationData);
                showMessage('Organisation has been updated successfully.');
            } else {
                // Create new organisation
                const createdOrganisation = await apiPost('organisations', organisationData);
                organisationId = createdOrganisation?.id || createdOrganisation?.data?.id || createdOrganisation?.organisation?.id || null;
                if (!organisationId) {
                    throw new Error('Failed to get organisation ID from creation response');
                }
                showMessage('Organisation has been created successfully.');
            }

            if (logoFile && organisationId) {
                await uploadOrganisationLogo(organisationId);
            }

            // Refresh the list
            await fetchOrganisations();
            setAddOrganisationModal(false);
            setParams(JSON.parse(JSON.stringify(defaultParams)));
            resetLogoState();
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to save organisation';
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

    const editOrganisation = (organisation: any = null) => {
        const json = JSON.parse(JSON.stringify(defaultParams));
        setParams(json);
        if (organisation) {
            let json1 = JSON.parse(JSON.stringify(organisation));
            setParams(json1);
            setLogoFromOrganisation(json1);
        } else {
            resetLogoState();
        }
        setAddOrganisationModal(true);
    };

    const deleteOrganisation = async (organisation: any = null) => {
        if (!organisation || !organisation.id) {
            showMessage('Invalid organisation', 'error');
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
            await apiDelete(`organisations/${organisation.id}`);
            showMessage('Organisation has been deleted successfully.');
            // Refresh the list
            await fetchOrganisations();
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to delete organisation';
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
                <h2 className="text-xl">Organisation</h2>
                <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex gap-3">
                        <div>
                            <button type="button" className="btn btn-primary" onClick={() => editOrganisation()}>
                                <IconUserPlus className="ltr:mr-2 rtl:ml-2" />
                                Add Organisation
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
                        <input type="text" placeholder="Search Organisation" className="peer form-input py-2 ltr:pr-11 rtl:pl-11" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            {!loading && value === 'list' && (
                <div className="panel mt-5 overflow-hidden border-0 p-0">
                    <div className="table-responsive">
                        <table className="table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Address</th>
                                    <th>City</th>
                                    <th className="!text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="!text-center font-semibold">
                                            No Organisation Available
                                        </td>
                                    </tr>
                                )}
                                {filteredItems.map((organisation: any) => {
                                    return (
                                        <tr key={organisation.id}>
                                            <td>
                                                <div className="flex w-max items-center">
                                                    {organisation.logo_name ? (
                                                        <img
                                                            src={getLogoUrl(organisation.logo_name)}
                                                            alt={`${organisation.name || 'Organisation'} logo`}
                                                            className="h-8 w-8 rounded-full object-cover ltr:mr-2 rtl:ml-2"
                                                        />
                                                    ) : (
                                                        <div className="rounded-full border border-gray-300 p-2 ltr:mr-2 rtl:ml-2 dark:border-gray-800">
                                                            <IconUser className="h-4.5 w-4.5" />
                                                        </div>
                                                    )}
                                                    <div className="font-semibold">{organisation.name}</div>
                                                </div>
                                            </td>
                                            <td>{organisation.address}</td>
                                            <td>{organisation.city}</td>
                                            <td>
                                                <div className="flex items-center justify-center gap-4">
                                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editOrganisation(organisation)}>
                                                        Edit
                                                    </button>
                                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteOrganisation(organisation)}>
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

            {!loading && value === 'grid' && (
                <div className="mt-5 grid w-full grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {filteredItems.length === 0 && (
                        <div className="col-span-full text-center font-semibold">No Organisation Available</div>
                    )}
                    {filteredItems.map((organisation: any) => {
                        return (
                            <div className="relative overflow-hidden rounded-md bg-white text-center shadow dark:bg-[#1c232f]" key={organisation.id}>
                                <div className="rounded-md bg-white px-6 py-6 shadow-md dark:bg-gray-900">
                                    <div className="mb-4 flex justify-center">
                                        {organisation.logo_name ? (
                                            <img
                                                src={getLogoUrl(organisation.logo_name)}
                                                alt={`${organisation.name || 'Organisation'} logo`}
                                                className="h-16 w-16 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="grid h-16 w-16 place-content-center rounded-full bg-primary text-2xl font-semibold text-white">
                                                {organisation.name ? organisation.name.charAt(0).toUpperCase() : 'O'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xl font-semibold">{organisation.name}</div>
                                    <div className="mt-6 grid grid-cols-1 gap-4 ltr:text-left rtl:text-right">
                                        <div className="flex items-center">
                                            <div className="flex-none ltr:mr-2 rtl:ml-2">Address :</div>
                                            <div className="text-white-dark">{organisation.address}</div>
                                        </div>
                                        <div className="flex items-center">
                                            <div className="flex-none ltr:mr-2 rtl:ml-2">City :</div>
                                            <div className="text-white-dark">{organisation.city}</div>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex w-full gap-4">
                                        <button type="button" className="btn btn-outline-primary w-1/2" onClick={() => editOrganisation(organisation)}>
                                            Edit
                                        </button>
                                        <button type="button" className="btn btn-outline-danger w-1/2" onClick={() => deleteOrganisation(organisation)}>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Transition appear show={addOrganisationModal} as={Fragment}>
                <Dialog as="div" open={addOrganisationModal} onClose={() => setAddOrganisationModal(false)} className="relative z-50">
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
                                        onClick={() => {
                                            setAddOrganisationModal(false);
                                            resetLogoState();
                                        }}
                                        className="absolute top-4 text-gray-400 outline-none hover:text-gray-800 ltr:right-4 rtl:left-4 dark:hover:text-gray-600"
                                    >
                                        <IconX />
                                    </button>
                                    <div className="bg-[#fbfbfb] py-3 text-lg font-medium ltr:pl-5 ltr:pr-[50px] rtl:pl-[50px] rtl:pr-5 dark:bg-[#121c2c]">
                                        {params.id ? 'Edit Organisation' : 'Add Organisation'}
                                    </div>
                                    <div className="p-5">
                                        <form>
                                            <div className="mb-5">
                                                <label htmlFor="name">Name</label>
                                                <input id="name" type="text" placeholder="Enter Organisation Name" className="form-input" value={params.name} onChange={(e) => changeValue(e)} />
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="address">Address</label>
                                                <textarea
                                                    id="address"
                                                    rows={3}
                                                    placeholder="Enter Address"
                                                    className="form-textarea min-h-[130px] resize-none"
                                                    value={params.address}
                                                    onChange={(e) => changeValue(e)}
                                                ></textarea>
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="city">City</label>
                                                <input id="city" type="text" placeholder="Enter City" className="form-input" value={params.city} onChange={(e) => changeValue(e)} />
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="bank_name">Bank Name</label>
                                                <input
                                                    id="bank_name"
                                                    type="text"
                                                    placeholder="Enter Bank Name"
                                                    className="form-input"
                                                    value={params.bank_name}
                                                    onChange={(e) => changeValue(e)}
                                                />
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="account_number">Account Number</label>
                                                <input
                                                    id="account_number"
                                                    type="text"
                                                    placeholder="Enter Account Number"
                                                    className="form-input"
                                                    value={params.account_number}
                                                    onChange={(e) => changeValue(e)}
                                                />
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="ifsc_code">IFSC Code</label>
                                                <input
                                                    id="ifsc_code"
                                                    type="text"
                                                    placeholder="Enter IFSC Code"
                                                    className="form-input"
                                                    value={params.ifsc_code}
                                                    onChange={(e) => changeValue(e)}
                                                />
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="branch">Branch</label>
                                                <input
                                                    id="branch"
                                                    type="text"
                                                    placeholder="Enter Branch"
                                                    className="form-input"
                                                    value={params.branch}
                                                    onChange={(e) => changeValue(e)}
                                                />
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="logo">Logo</label>
                                                <input
                                                    id="logo"
                                                    type="file"
                                                    accept="image/png,image/jpeg"
                                                    className="form-input"
                                                    onChange={handleLogoChange}
                                                />
                                                <div className="mt-2 flex items-center gap-3">
                                                    {logoPreview ? (
                                                        <img src={logoPreview} alt="Organisation logo preview" className="h-14 w-14 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="grid h-14 w-14 place-content-center rounded-full border border-gray-200 text-xs text-gray-500 dark:border-gray-700">
                                                            No logo
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-gray-500">
                                                        PNG/JPG up to {LOGO_MAX_SIZE_MB} MB
                                                    </div>
                                                </div>
                                                {logoError && <div className="mt-1 text-xs text-danger">{logoError}</div>}
                                            </div>
                                            <div className="mt-8 flex items-center justify-end">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger"
                                                    onClick={() => {
                                                        setAddOrganisationModal(false);
                                                        resetLogoState();
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                                <button type="button" className="btn btn-primary ltr:ml-4 rtl:mr-4" onClick={saveOrganisation} disabled={loading}>
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

export default ComponentsAppsOrganisation;
