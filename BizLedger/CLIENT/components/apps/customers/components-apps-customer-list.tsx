'use client';

import IconEdit from '@/components/icon/icon-edit';
import IconPlus from '@/components/icon/icon-plus';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import type { DataTableColumn, DataTableProps, DataTableSortStatus } from 'mantine-datatable';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomerRecord, deleteCustomer, getCustomersForOrganisation } from '@/lib/customerStore';

const DataTable = dynamic<DataTableProps<CustomerRecord>>(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading customers...</div>
        </div>
    ),
});

const ComponentsAppsCustomerList = () => {
    const [records, setRecords] = useState<CustomerRecord[]>([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [search, setSearch] = useState('');
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'name',
        direction: 'asc',
    });

    const refreshCustomers = useCallback(() => {
        setRecords(getCustomersForOrganisation());
    }, []);

    useEffect(() => {
        refreshCustomers();
    }, [refreshCustomers]);

    useEffect(() => {
        const handleStorage = () => refreshCustomers();
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [refreshCustomers]);

    useEffect(() => {
        setPage(1);
    }, [pageSize, search]);

    const filteredRecords = useMemo(() => {
        if (!search) {
            return records;
        }
        const term = search.toLowerCase();
        return records.filter((record) => {
            return (
                record.name.toLowerCase().includes(term) ||
                record.gstin.toLowerCase().includes(term) ||
                record.contact_no.toLowerCase().includes(term) ||
                record.state.toLowerCase().includes(term)
            );
        });
    }, [records, search]);

    const sortedRecords = useMemo(() => {
        const sorted = [...filteredRecords];
        const { columnAccessor, direction } = sortStatus;
        sorted.sort((a: any, b: any) => {
            const left = String(a[columnAccessor] ?? '').toLowerCase();
            const right = String(b[columnAccessor] ?? '').toLowerCase();
            if (left < right) return direction === 'asc' ? -1 : 1;
            if (left > right) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredRecords, sortStatus]);

    const paginatedRecords = useMemo(() => {
        const start = (page - 1) * pageSize;
        return sortedRecords.slice(start, start + pageSize);
    }, [sortedRecords, page, pageSize]);

    const handleDelete = (id: string) => {
        if (!window.confirm('Are you sure you want to delete this customer?')) {
            return;
        }
        if (deleteCustomer(id)) {
            refreshCustomers();
        }
    };

    const columns: DataTableColumn<CustomerRecord>[] = [
        {
            accessor: 'name',
            title: 'Name',
            sortable: true,
            render: ({ name }) => <div className="font-semibold">{name}</div>,
        },
        {
            accessor: 'gstin',
            title: 'GSTIN',
            sortable: true,
        },
        {
            accessor: 'contact_no',
            title: 'Contact No',
            sortable: true,
        },
        {
            accessor: 'state',
            title: 'State',
            sortable: true,
        },
        {
            accessor: 'updated_at',
            title: 'Updated',
            sortable: true,
            render: ({ updated_at }) => <div>{new Date(updated_at).toLocaleDateString()}</div>,
        },
        {
            accessor: 'action',
            title: 'Actions',
            sortable: false,
            textAlignment: 'center',
            render: ({ id }) => (
                <div className="mx-auto flex w-max items-center gap-4">
                    <Link href={`/apps/customers/edit?id=${id}`} className="flex hover:text-info">
                        <IconEdit className="h-4.5 w-4.5" />
                    </Link>
                    <button type="button" className="flex hover:text-danger" onClick={() => handleDelete(id)}>
                        <IconTrashLines />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="panel border-white-light px-0 dark:border-[#1b2e4b]">
            <div className="invoice-table">
                <div className="mb-4.5 flex flex-col gap-5 px-5 md:flex-row md:items-center">
                    <div className="flex items-center gap-2">
                        <Link href="/apps/customers/add" className="btn btn-primary gap-2">
                            <IconPlus />
                            Add Customer
                        </Link>
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
                        records={paginatedRecords}
                        columns={columns}
                        highlightOnHover
                        totalRecords={sortedRecords.length}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={(p) => setPage(p)}
                        recordsPerPageOptions={PAGE_SIZES}
                        onRecordsPerPageChange={setPageSize}
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                        paginationText={({ from, to, totalRecords }) => `Showing ${from} to ${to} of ${totalRecords} entries`}
                    />
                </div>
            </div>
        </div>
    );
};

export default ComponentsAppsCustomerList;
