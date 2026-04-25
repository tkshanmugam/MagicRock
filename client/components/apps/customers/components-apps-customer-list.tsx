'use client';

import IconEdit from '@/components/icon/icon-edit';
import IconPlus from '@/components/icon/icon-plus';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import type { DataTableColumn, DataTableProps, DataTableSortStatus } from 'mantine-datatable';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { CustomerRecord, deleteCustomer, listCustomersPaged } from '@/lib/customerApi';
import { organizationContext } from '@/lib/organizationContext';
import { getTranslation } from '@/i18n';

const DataTable = dynamic<DataTableProps<CustomerRecord>>(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading customers...</div>
        </div>
    ),
});

const ComponentsAppsCustomerList = () => {
    const { t } = getTranslation();
    const [records, setRecords] = useState<CustomerRecord[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'name',
        direction: 'asc',
    });
    /** Bumps when header org (or permissions) refresh so we reset page and refetch. */
    const [directoryEpoch, setDirectoryEpoch] = useState(0);

    const canView = organizationContext.hasPermission('Customers', 'view');
    const canCreate = organizationContext.hasPermission('Customers', 'create');
    const canUpdate = organizationContext.hasPermission('Customers', 'update');
    const canDelete = organizationContext.hasPermission('Customers', 'delete');

    const sortColumnForApi = (accessor: string | number) => {
        const key = String(accessor);
        const allowed = new Set(['name', 'gstin', 'contact_no', 'state', 'updated_at', 'created_at', 'id']);
        return allowed.has(key) ? key : 'name';
    };

    const refreshCustomers = useCallback(async () => {
        const orgId = organizationContext.getSelectedOrganizationId();
        if (!orgId) {
            setRecords([]);
            setTotalRecords(0);
            setLoadError('Select an organisation (header) to load customers. The list is shared across all organisations.');
            setLoading(false);
            return;
        }
        if (!canView) {
            setRecords([]);
            setTotalRecords(0);
            setLoadError('You do not have permission to view customers.');
            setLoading(false);
            return;
        }
        setLoading(true);
        setLoadError(null);
        try {
            const response = await listCustomersPaged({
                skip: (page - 1) * pageSize,
                limit: pageSize,
                search: debouncedSearch || undefined,
                sort_by: sortColumnForApi(sortStatus.columnAccessor) as 'name' | 'gstin' | 'contact_no' | 'state' | 'updated_at' | 'created_at' | 'id',
                sort_dir: sortStatus.direction,
            });
            setRecords(response.items || []);
            setTotalRecords(response.total || 0);
        } catch (e: any) {
            setRecords([]);
            setTotalRecords(0);
            setLoadError(e?.message || 'Failed to load customers.');
        } finally {
            setLoading(false);
        }
    }, [canView, page, pageSize, debouncedSearch, sortStatus.columnAccessor, sortStatus.direction, directoryEpoch]);

    useEffect(() => {
        refreshCustomers();
    }, [refreshCustomers]);

    useEffect(() => {
        const onOrgChange = () => {
            setPage(1);
            setDirectoryEpoch((n) => n + 1);
        };
        window.addEventListener('organization-permissions-updated', onOrgChange);
        return () => window.removeEventListener('organization-permissions-updated', onOrgChange);
    }, []);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            const next = search.trim();
            setDebouncedSearch((prev) => {
                if (prev !== next) {
                    setPage(1);
                }
                return next;
            });
        }, 300);
        return () => window.clearTimeout(handle);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [pageSize]);

    const handleDelete = async (id: number) => {
        if (!canDelete) {
            return;
        }
        if (!window.confirm('Are you sure you want to delete this customer?')) {
            return;
        }
        try {
            await deleteCustomer(id);
            await refreshCustomers();
        } catch (e: any) {
            window.alert(e?.message || 'Failed to delete customer.');
        }
    };

    const columns: DataTableColumn<CustomerRecord>[] = [
        {
            accessor: 'name',
            title: t('th_name'),
            sortable: true,
            render: ({ name }) => <div className="font-semibold">{name}</div>,
        },
        {
            accessor: 'gstin',
            title: t('th_gstin'),
            sortable: true,
        },
        {
            accessor: 'contact_no',
            title: t('th_contact_no'),
            sortable: true,
        },
        {
            accessor: 'state',
            title: t('th_state'),
            sortable: true,
        },
        {
            accessor: 'updated_at',
            title: t('th_updated'),
            sortable: true,
            render: ({ updated_at }) => <div>{new Date(updated_at).toLocaleDateString()}</div>,
        },
        {
            accessor: 'action',
            title: t('th_actions'),
            sortable: false,
            textAlignment: 'center',
            render: ({ id }) => (
                <div className="mx-auto flex w-max items-center gap-4">
                    {canUpdate ? (
                        <Link href={`/apps/customers/edit?id=${id}`} className="flex hover:text-info">
                            <IconEdit className="h-4.5 w-4.5" />
                        </Link>
                    ) : null}
                    {canDelete ? (
                        <button type="button" className="flex hover:text-danger" onClick={() => handleDelete(id)}>
                            <IconTrashLines />
                        </button>
                    ) : null}
                </div>
            ),
        },
    ];

    if (loading && !records.length) {
        return (
            <div className="panel border-white-light px-5 py-8 dark:border-[#1b2e4b]">
                <div className="text-center text-gray-500">Loading customers...</div>
            </div>
        );
    }

    return (
        <div className="panel border-white-light px-0 dark:border-[#1b2e4b]">
            {loadError && (
                <div className="mx-5 mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-100">
                    {loadError}
                </div>
            )}
            <div className="invoice-table">
                <div className="mb-4.5 flex flex-col gap-5 px-5 md:flex-row md:items-center">
                    <div className="flex items-center gap-2">
                        {canCreate ? (
                            <Link href="/apps/customers/add" className="btn btn-primary gap-2">
                                <IconPlus />
                                Add Customer
                            </Link>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 ltr:ml-auto rtl:mr-auto">
                        <input
                            type="text"
                            className="form-input w-full sm:w-60"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="datatables pagination-padding">
                    <DataTable
                        className="table-hover whitespace-nowrap"
                        records={records}
                        columns={columns}
                        highlightOnHover
                        totalRecords={totalRecords}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={(p) => setPage(p)}
                        recordsPerPageOptions={PAGE_SIZES}
                        onRecordsPerPageChange={setPageSize}
                        sortStatus={sortStatus}
                        onSortStatusChange={(next) => {
                            setSortStatus(next);
                            setPage(1);
                        }}
                        paginationText={({ from, to, totalRecords }) => `Showing ${from} to ${to} of ${totalRecords} entries`}
                    />
                </div>
            </div>
        </div>
    );
};

export default ComponentsAppsCustomerList;
