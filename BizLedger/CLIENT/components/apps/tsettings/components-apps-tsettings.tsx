'use client';
import IconListCheck from '@/components/icon/icon-list-check';
import IconSearch from '@/components/icon/icon-search';
import IconX from '@/components/icon/icon-x';
import IconFile from '@/components/icon/icon-file';
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';

type TaxSetting = {
    id: number;
    organisationId: number;
    organisationName: string;
    sgstPercentage: number;
    cgstPercentage: number;
};

const ComponentsAppsTSettings = () => {
    const [addTaxModal, setAddTaxModal] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [search, setSearch] = useState<string>('');
    const [taxSettings, setTaxSettings] = useState<TaxSetting[]>([]);
    const [filteredItems, setFilteredItems] = useState<TaxSetting[]>([]);
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const canViewTaxSettings = organizationContext.hasPermission('TSettings', 'view');
    const canCreateTaxSettings = organizationContext.hasPermission('TSettings', 'create');
    const canUpdateTaxSettings = organizationContext.hasPermission('TSettings', 'update');
    const canDeleteTaxSettings = organizationContext.hasPermission('TSettings', 'delete');
    const isSuperAdmin = organizationContext.getIsSuperAdmin();

    const [defaultParams] = useState({
        id: null,
        organisationId: '',
        sgstPercentage: '',
        cgstPercentage: '',
    });
    const [params, setParams] = useState<any>(JSON.parse(JSON.stringify(defaultParams)));
    const selectedOrg = organisationsList.find((org: any) => String(org.id) === String(params.organisationId));
    const selectedOrgLabel = selectedOrg?.name || (params.organisationId ? `Organisation #${params.organisationId}` : 'Selected Organisation');
    const selectedOrgValue = selectedOrg?.id ?? params.organisationId ?? '';

    const fetchTaxSettings = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiGet<any>('tax-configurations');
            const items = Array.isArray(response) ? response : response.data || response.results || [];
            const mapped = items.map((item: any) => ({
                id: Number(item.id),
                organisationId: Number(item.organisation_id ?? item.organisationId),
                organisationName: item.organisation_name || item.organisationName || '',
                sgstPercentage: Number(item.sgst_percentage ?? item.sgstPercentage ?? 0),
                cgstPercentage: Number(item.cgst_percentage ?? item.cgstPercentage ?? 0),
            }));
            setTaxSettings(mapped);
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to fetch tax settings';
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

    const fetchOrganisations = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiGet<any>('organisations');
            const organisations = Array.isArray(response) ? response : response.data || response.results || [];
            setOrganisationsList(organisations);
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
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authState.isAuthStateReady()) {
            fetchOrganisations();
            fetchTaxSettings();
            return;
        }
        let attempts = 0;
        const maxAttempts = 20;
        const interval = setInterval(() => {
            attempts++;
            if (authState.isAuthStateReady() || attempts >= maxAttempts) {
                clearInterval(interval);
                if (authState.isAuthStateReady()) {
                    fetchOrganisations();
                    fetchTaxSettings();
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, [fetchOrganisations]);

    const changeValue = (e: any) => {
        const { value, id } = e.target;
        setParams({ ...params, [id]: value });
    };

    const enrichedSettings = taxSettings.map((item) => {
        const organisation = organisationsList.find((org: any) => String(org.id) === String(item.organisationId));
        return {
            ...item,
            organisationName: organisation?.name || item.organisationName || 'Unknown',
        };
    });

    const searchItems = () => {
        setFilteredItems(() => {
            if (!search) {
                return enrichedSettings;
            }
            return enrichedSettings.filter((item) => item.organisationName?.toLowerCase().includes(search.toLowerCase()));
        });
    };

    useEffect(() => {
        searchItems();
    }, [search, taxSettings, organisationsList]);

    const validateParams = () => {
        if (!params.organisationId) {
            showMessage('Organisation is required.', 'error');
            return false;
        }
        if (params.sgstPercentage === '' || Number.isNaN(Number(params.sgstPercentage))) {
            showMessage('SGST percentage is required.', 'error');
            return false;
        }
        if (params.cgstPercentage === '' || Number.isNaN(Number(params.cgstPercentage))) {
            showMessage('CGST percentage is required.', 'error');
            return false;
        }
        const sgstPercentage = Number(params.sgstPercentage);
        const cgstPercentage = Number(params.cgstPercentage);
        if (sgstPercentage < 0 || sgstPercentage > 100) {
            showMessage('SGST percentage must be between 0 and 100.', 'error');
            return false;
        }
        if (cgstPercentage < 0 || cgstPercentage > 100) {
            showMessage('CGST percentage must be between 0 and 100.', 'error');
            return false;
        }
        return true;
    };

    const saveTaxSetting = async () => {
        if (!validateParams()) {
            return;
        }

        const organisation = organisationsList.find((org: any) => String(org.id) === String(params.organisationId));
        if (!organisation) {
            showMessage('Organisation not found.', 'error');
            return;
        }

        const payload = {
            organisation_id: Number(params.organisationId),
            sgst_percentage: Number(params.sgstPercentage),
            cgst_percentage: Number(params.cgstPercentage),
            is_active: true,
        };

        setSaving(true);
        try {
            if (params.id) {
                const updated = await apiPut<any>(`tax-configurations/${params.id}`, payload);
                const newItem: TaxSetting = {
                    id: Number(updated.id),
                    organisationId: Number(updated.organisation_id ?? updated.organisationId),
                    organisationName: organisation.name || 'Unknown',
                    sgstPercentage: Number(updated.sgst_percentage ?? updated.sgstPercentage ?? 0),
                    cgstPercentage: Number(updated.cgst_percentage ?? updated.cgstPercentage ?? 0),
                };
                setTaxSettings((prev) => prev.map((item) => (item.id === newItem.id ? newItem : item)));
                showMessage('Tax setting updated successfully.');
            } else {
                const created = await apiPost<any>('tax-configurations', payload);
                const newItem: TaxSetting = {
                    id: Number(created.id),
                    organisationId: Number(created.organisation_id ?? created.organisationId),
                    organisationName: organisation.name || 'Unknown',
                    sgstPercentage: Number(created.sgst_percentage ?? created.sgstPercentage ?? 0),
                    cgstPercentage: Number(created.cgst_percentage ?? created.cgstPercentage ?? 0),
                };
                setTaxSettings((prev) => [...prev, newItem]);
                showMessage('Tax setting added successfully.');
            }
            setAddTaxModal(false);
            setParams(JSON.parse(JSON.stringify(defaultParams)));
        } finally {
            setSaving(false);
        }
    };

    const editTaxSetting = (item: TaxSetting | null = null) => {
        const json = JSON.parse(JSON.stringify(defaultParams));
        const selectedOrgId = organizationContext.getSelectedOrganizationId();
        if (selectedOrgId) {
            json.organisationId = String(selectedOrgId);
        }
        setParams(json);
        if (item) {
            setParams({
                id: item.id,
                organisationId: String(item.organisationId),
                sgstPercentage: String(item.sgstPercentage),
                cgstPercentage: String(item.cgstPercentage),
            });
        }
        setAddTaxModal(true);
    };

    const deleteTaxSetting = async (item: TaxSetting | null = null) => {
        if (!item) {
            showMessage('Invalid tax setting', 'error');
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

        await apiDelete(`tax-configurations/${item.id}`);
        setTaxSettings((prev) => prev.filter((setting) => setting.id !== item.id));
        showMessage('Tax setting deleted successfully.');
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl">Tax Settings</h2>
                <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search Organisation..."
                            className="form-input py-2 ltr:pr-11 rtl:pl-11"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button type="button" className="absolute top-1/2 -translate-y-1/2 hover:opacity-80 ltr:right-2 rtl:left-2">
                            <IconSearch className="mx-auto" />
                        </button>
                    </div>
                    <div>
                        <button type="button" className="btn btn-primary gap-2" onClick={() => editTaxSetting()} disabled={!canCreateTaxSettings}>
                            <IconFile className="ltr:mr-2 rtl:ml-2" />
                            Add Tax
                        </button>
                    </div>
                </div>
            </div>
            {loading && (
                <div className="panel mt-5">
                    <div className="text-center py-8">Loading...</div>
                </div>
            )}
            {!loading && canViewTaxSettings && (
                <div className="panel mt-5 overflow-hidden border-0 p-0">
                    <div className="table-responsive">
                        <table className="table-striped table-hover">
                            <thead>
                                <tr>
                                    <th>Organisation</th>
                                    <th>SGST %</th>
                                    <th>CGST %</th>
                                    <th className="!text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="!text-center font-semibold">
                                            No Tax Settings Available
                                        </td>
                                    </tr>
                                )}
                                {filteredItems.map((item) => {
                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="font-semibold">{item.organisationName}</div>
                                            </td>
                                            <td>{item.sgstPercentage}</td>
                                            <td>{item.cgstPercentage}</td>
                                            <td>
                                                <div className="flex items-center justify-center gap-4">
                                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => editTaxSetting(item)} disabled={!canUpdateTaxSettings}>
                                                        Edit
                                                    </button>
                                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteTaxSetting(item)} disabled={!canDeleteTaxSettings}>
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
            {!loading && !canViewTaxSettings && (
                <div className="panel mt-5">
                    <div className="text-center py-8 font-semibold">You do not have permission to view tax settings.</div>
                </div>
            )}

            <Transition appear show={addTaxModal} as={Fragment}>
                <Dialog as="div" open={addTaxModal} onClose={() => setAddTaxModal(false)} className="relative z-50">
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
                                        onClick={() => setAddTaxModal(false)}
                                        className="absolute top-4 text-gray-400 outline-none hover:text-gray-800 ltr:right-4 rtl:left-4 dark:hover:text-gray-600"
                                    >
                                        <IconX />
                                    </button>
                                    <div className="bg-[#fbfbfb] py-3 text-lg font-medium ltr:pl-5 ltr:pr-[50px] rtl:pl-[50px] rtl:pr-5 dark:bg-[#121c2c]">
                                        {params.id ? 'Edit Tax Settings' : 'Add Tax Settings'}
                                    </div>
                                    <div className="p-5">
                                        <form>
                                            {isSuperAdmin ? (
                                                <div className="mb-5">
                                                    <label htmlFor="organisationId">Organisation Name <span className="text-danger">*</span></label>
                                                    <select
                                                        id="organisationId"
                                                        className="form-select"
                                                        value={params.organisationId}
                                                        onChange={(e) => changeValue(e)}
                                                    >
                                                        <option value="">Select Organisation</option>
                                                        {organisationsList.map((org: any) => (
                                                            <option key={org.id} value={org.id}>
                                                                {org.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="mb-5">
                                                    <label htmlFor="organisationId">Organisation Name</label>
                                                    <input
                                                        id="organisationId"
                                                        className="form-input"
                                                        value={selectedOrgLabel}
                                                        readOnly
                                                    />
                                                </div>
                                            )}
                                            <div className="mb-5">
                                                <label htmlFor="sgstPercentage">SGST % <span className="text-danger">*</span></label>
                                                <input
                                                    id="sgstPercentage"
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step="0.01"
                                                    placeholder="Enter SGST %"
                                                    className="form-input"
                                                    value={params.sgstPercentage}
                                                    onChange={(e) => changeValue(e)}
                                                />
                                            </div>
                                            <div className="mb-5">
                                                <label htmlFor="cgstPercentage">CGST % <span className="text-danger">*</span></label>
                                                <input
                                                    id="cgstPercentage"
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step="0.01"
                                                    placeholder="Enter CGST %"
                                                    className="form-input"
                                                    value={params.cgstPercentage}
                                                    onChange={(e) => changeValue(e)}
                                                />
                                            </div>
                                            <div className="mt-8 flex items-center justify-end">
                                                <button type="button" onClick={() => setAddTaxModal(false)} className="btn btn-outline-danger">
                                                    Cancel
                                                </button>
                                                <button type="button" onClick={saveTaxSetting} className="btn btn-primary ltr:ml-4 rtl:mr-4" disabled={saving}>
                                                    {saving ? 'Saving...' : params.id ? 'Update' : 'Add'}
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

export default ComponentsAppsTSettings;
