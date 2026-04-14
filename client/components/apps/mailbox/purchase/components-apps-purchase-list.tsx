'use client';
import IconEdit from '@/components/icon/icon-edit';
import IconPlus from '@/components/icon/icon-plus';
import IconX from '@/components/icon/icon-x';
import { orderBy, sortBy } from 'lodash';
import type { DataTableColumn, DataTableProps, DataTableSortStatus } from 'mantine-datatable';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useState } from 'react';
import { organizationContext } from '@/lib/organizationContext';
import { useOrganizationSelection } from '@/lib/useOrganizationSelection';
import { apiGet, apiPost } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { getTranslation } from '@/i18n';

type PurchaseVoucherRecord = {
    id: number;
    voucherNo: string | number;
    supplierName: string;
    date: string;
    amount: string;
    status: string;
};

const DataTable = dynamic<DataTableProps<PurchaseVoucherRecord>>(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading purchase list...</div>
        </div>
    ),
});

const ComponentsAppsPurchaseList = () => {
    const { t } = getTranslation();
    const canViewPurchase = organizationContext.hasPermission('Purchase', 'view');
    const canCreatePurchase = organizationContext.hasPermission('Purchase', 'create');
    const canUpdatePurchase = organizationContext.hasPermission('Purchase', 'update');
    const [isSuperAdmin, setIsSuperAdmin] = useState(organizationContext.getIsSuperAdmin());
    const [organisationsList, setOrganisationsList] = useState<any[]>([]);
    const [orgsLoading, setOrgsLoading] = useState<boolean>(false);
    const [organisationId, setOrganisationId] = useState<string>('');
    const [items, setItems] = useState<PurchaseVoucherRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [initialRecords, setInitialRecords] = useState<PurchaseVoucherRecord[]>([]);
    const [records, setRecords] = useState<PurchaseVoucherRecord[]>([]);
    const [selectedRecords, setSelectedRecords] = useState<PurchaseVoucherRecord[]>([]);

    const [search, setSearch] = useState('');
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'id',
        direction: 'desc',
    });
    const formatVoucherNo = (value: string | number) => String(value).padStart(4, '0');

    useEffect(() => {
        organizationContext.updateIsSuperAdminFromToken();
        setIsSuperAdmin(organizationContext.getIsSuperAdmin());
    }, []);

    const fetchOrganisations = useCallback(async () => {
        try {
            setOrgsLoading(true);
            const superAdminNow = organizationContext.getIsSuperAdmin();
            setIsSuperAdmin(superAdminNow);
            const endpoints = superAdminNow ? ['organisations', 'organisations/me'] : ['organisations/me', 'organisations'];
            let resolved: any[] = [];
            for (const endpoint of endpoints) {
                try {
                    const response = await apiGet<any>(endpoint);
                    const organisations = Array.isArray(response) ? response : response.data || response.results || [];
                    if (organisations.length) {
                        resolved = organisations;
                        break;
                    }
                } catch (_error) {
                    // Try next endpoint as a fallback.
                }
            }
            setOrganisationsList(resolved);
        } catch (error) {
            console.error('Failed to fetch organisations', error);
        } finally {
            setOrgsLoading(false);
        }
    }, []);

    useEffect(() => {
        const load = () => {
            organizationContext.updateIsSuperAdminFromToken();
            setIsSuperAdmin(organizationContext.getIsSuperAdmin());
            fetchOrganisations();
        };
        load();
        const unsubscribe = authState.onAuthStateReady(load);
        return unsubscribe;
    }, [fetchOrganisations]);

    const updateOrganisationSelection = useCallback(
        async (nextOrganisationId: string) => {
            const parsedId = Number(nextOrganisationId);
            if (!parsedId || Number.isNaN(parsedId)) {
                return;
            }
            organizationContext.setSelectedOrganizationId(parsedId);
            if (isSuperAdmin) {
                return;
            }
            try {
                const permissionsResponse = await apiGet<any>(`organisations/${parsedId}/permissions/me`);
                const permissionsPayload =
                    permissionsResponse?.modules ||
                    permissionsResponse?.data?.modules ||
                    permissionsResponse?.results?.modules ||
                    (Array.isArray(permissionsResponse) ? permissionsResponse : []);
                organizationContext.setPermissions(permissionsPayload || []);
            } catch (error) {
                // Keep existing permissions if the update fails.
            }
        },
        [isSuperAdmin]
    );

    useOrganizationSelection({
        organisationsList,
        organisationId,
        setOrganisationId,
        onOrganisationChange: updateOrganisationSelection,
    });

    useEffect(() => {
        setPage(1);
    }, [pageSize, organisationId]);

    useEffect(() => {
        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        setRecords([...initialRecords.slice(from, to)]);
    }, [page, pageSize, initialRecords]);

    useEffect(() => {
        const fetchVouchers = async () => {
            if (!organisationId) {
                setItems([]);
                setInitialRecords([]);
                setRecords([]);
                return;
            }
            setLoading(true);
            try {
                const skip = (page - 1) * pageSize;
                const data = await apiGet<any>(
                    `purchase-vouchers?skip=${skip}&limit=${pageSize}&organisation_id=${Number(organisationId)}&include_cancelled=true`
                );
                const normalized: PurchaseVoucherRecord[] = (Array.isArray(data) ? data : []).map((row: any) => ({
                    id: row.id,
                    voucherNo: row.voucher_no,
                    supplierName: row.supplier_name || '-',
                    date: row.voucher_date ? new Date(row.voucher_date).toLocaleDateString() : '-',
                    amount: Number(row.total_amount || 0).toFixed(2),
                    status: row.status || 'active',
                }));
                const ordered = orderBy(normalized, ['id'], ['desc']);
                setItems(ordered);
                setInitialRecords(ordered);
            } catch (error: any) {
                console.error('Failed to load purchase vouchers', error);
            } finally {
                setLoading(false);
            }
        };
        fetchVouchers();
    }, [page, pageSize, organisationId]);

    useEffect(() => {
        setInitialRecords(() => {
            return items.filter((item) => {
                return (
                    String(item.id).includes(search) ||
                    String(item.voucherNo).toLowerCase().includes(search.toLowerCase()) ||
                    item.supplierName.toLowerCase().includes(search.toLowerCase()) ||
                    item.date.toLowerCase().includes(search.toLowerCase()) ||
                    item.amount.toLowerCase().includes(search.toLowerCase()) ||
                    item.status.toLowerCase().includes(search.toLowerCase())
                );
            });
        });
    }, [search]);

    useEffect(() => {
        const data2 = sortBy(initialRecords, sortStatus.columnAccessor);
        setRecords(sortStatus.direction === 'desc' ? data2.reverse() : data2);
        setPage(1);
    }, [sortStatus]);

    const selectedOrganisation = organisationsList.find((org: any) => String(org.id) === String(organisationId));
    const selectedOrganisationLabel = selectedOrganisation?.name || (organisationId ? `Organisation #${organisationId}` : 'Selected Organisation');

    const cancelRow = async (id: number | null = null) => {
        if (!window.confirm('Are you sure you want to cancel the selected voucher(s)? Cancelled vouchers cannot be edited.')) {
            return;
        }
        const candidates = id ? items.filter((r) => r.id === id) : selectedRecords || [];
        const ids = candidates.filter((r) => r.status !== 'cancelled').map((d) => d.id);
        if (!ids.length) {
            return;
        }
        try {
            await Promise.all(ids.map((rowId: number) => apiPost(`purchase-vouchers/${rowId}/cancel`)));
            const updated = items.map((row) => (ids.includes(row.id) ? { ...row, status: 'cancelled' } : row));
            setItems(updated);
            setInitialRecords(updated);
            setRecords(updated);
            setSelectedRecords([]);
        } catch (error: any) {
            window.alert(error?.message || 'Failed to cancel voucher.');
        }
    };

    if (!canViewPurchase) {
        return (
            <div className="panel border-white-light px-5 py-8 text-center font-semibold dark:border-[#1b2e4b]">
                You do not have permission to view Purchase.
            </div>
        );
    }

    return (
        <div className="panel border-white-light px-0 dark:border-[#1b2e4b]">
            <div className="invoice-table">
                <div className="mb-4.5 flex flex-col gap-5 px-5 md:flex-row md:items-center">
                    <div className="flex items-center gap-2">
                        {canUpdatePurchase && selectedRecords.some((r) => r.status !== 'cancelled') && (
                            <button type="button" className="btn btn-danger gap-2" onClick={() => cancelRow()}>
                                <IconX />
                                Cancel
                            </button>
                        )}
                        {canCreatePurchase && (
                            <Link href="/apps/purchase/add" className="btn btn-primary gap-2">
                                <IconPlus />
                                Add New
                            </Link>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 ltr:ml-auto rtl:mr-auto">
                        {organisationsList.length > 0 ? (
                            <select
                                id="organisationId"
                                className="form-select w-full sm:w-64"
                                value={organisationId}
                                onChange={(e) => setOrganisationId(e.target.value)}
                            >
                                <option value="">{orgsLoading ? 'Loading organisations...' : 'Select Organisation'}</option>
                                {organisationsList.map((org: any) => (
                                    <option key={org.id} value={org.id}>
                                        {org.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input id="organisationId" className="form-input w-full sm:w-64" value={orgsLoading ? 'Loading organisations...' : 'No organisations'} readOnly />
                        )}
                        <input type="text" className="form-input w-full sm:w-48" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="datatables pagination-padding">
                    <DataTable
                        className="table-hover whitespace-nowrap"
                        records={records}
                        columns={[
                            {
                                accessor: 'id',
                                title: t('th_id'),
                                sortable: true,
                                width: 90,
                            },
                            {
                                accessor: 'voucherNo',
                                title: t('th_purchase_voucher'),
                                sortable: true,
                                render: ({ voucherNo, id, status }) => (
                                    <Link href={`/apps/purchase/edit?id=${id}`}>
                                        <div
                                            className={
                                                status === 'cancelled'
                                                    ? 'font-semibold text-white-dark line-through'
                                                    : 'font-semibold text-primary underline hover:no-underline'
                                            }
                                        >
                                            {`#${formatVoucherNo(voucherNo)}`}
                                        </div>
                                    </Link>
                                ),
                            },
                            {
                                accessor: 'supplierName',
                                title: t('th_supplier'),
                                sortable: true,
                            },
                            {
                                accessor: 'date',
                                title: t('th_date'),
                                sortable: true,
                            },
                            {
                                accessor: 'status',
                                title: t('th_status'),
                                sortable: true,
                                render: ({ status }) => (
                                    <span
                                        className={
                                            status === 'cancelled'
                                                ? 'badge badge-outline-danger'
                                                : 'badge badge-outline-success'
                                        }
                                    >
                                        {status === 'cancelled' ? 'Cancelled' : 'Active'}
                                    </span>
                                ),
                            },
                            {
                                accessor: 'amount',
                                title: t('th_amount'),
                                sortable: true,
                                titleClassName: 'text-right',
                                render: ({ amount }) => <div className="text-right font-semibold">{amount}</div>,
                            },
                            {
                                accessor: 'action',
                                title: t('th_actions'),
                                sortable: false,
                                textAlignment: 'center',
                                render: ({ id, status }) => (
                                    <div className="mx-auto flex w-max items-center gap-4">
                                        {canUpdatePurchase && status !== 'cancelled' && (
                                            <>
                                                <Link href={`/apps/purchase/edit?id=${id}`} className="flex hover:text-info">
                                                    <IconEdit className="h-4.5 w-4.5" />
                                                </Link>
                                                <button type="button" className="flex hover:text-danger" onClick={(e) => cancelRow(id)} title="Cancel voucher">
                                                    <IconX />
                                                </button>
                                            </>
                                        )}
                                        {status === 'cancelled' && <span className="text-white-dark">—</span>}
                                    </div>
                                ),
                            },
                        ]}
                        highlightOnHover
                        totalRecords={initialRecords.length}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={(p) => setPage(p)}
                        recordsPerPageOptions={PAGE_SIZES}
                        onRecordsPerPageChange={setPageSize}
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                        selectedRecords={selectedRecords}
                        onSelectedRecordsChange={setSelectedRecords}
                        paginationText={({ from, to, totalRecords }) => `Showing  ${from} to ${to} of ${totalRecords} entries`}
                    />
                </div>
            </div>
        </div>
    );
};

export default ComponentsAppsPurchaseList;
