'use client';

import React, { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import dynamic from 'next/dynamic';
import type { DataTableProps, DataTableSortStatus } from 'mantine-datatable';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';

import IconEye from '@/components/icon/icon-eye';
import IconX from '@/components/icon/icon-x';
import { apiGet } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { exportToCsv } from '@/lib/exportUtils';
import { fetchAuditLog, fetchAuditLogs, AuditLogItem } from '@/lib/auditLogApi';

const DataTable = dynamic<DataTableProps<AuditLogItem>>(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading audit logs...</div>
        </div>
    ),
});

const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'CANCEL', 'LOGIN', 'LOGOUT'];
const MODULE_OPTIONS = ['Authentication', 'User', 'Sales', 'Purchase', 'Settings'];

type UserOption = {
    id: number;
    username: string;
    full_name?: string | null;
};

const AuditLogList = () => {
    const canViewAudit = organizationContext.getIsSuperAdmin() || organizationContext.hasPermission('Audit', 'view');
    const [records, setRecords] = useState<AuditLogItem[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);

    const [users, setUsers] = useState<UserOption[]>([]);
    const [organisations, setOrganisations] = useState<any[]>([]);
    const [organisationFilter, setOrganisationFilter] = useState<string>('');
    const [userFilter, setUserFilter] = useState<string>('');
    const [actionFilter, setActionFilter] = useState<string>('');
    const [moduleFilter, setModuleFilter] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'created_date',
        direction: 'desc',
    });

    const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchUsers = useCallback(async () => {
        if (!authState.isAuthStateReady()) {
            return;
        }
        try {
            const response = await apiGet<any>('users');
            const userList = Array.isArray(response) ? response : response.items || response.data || [];
            setUsers(
                userList.map((user: any) => ({
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                }))
            );
        } catch (error) {
            // Ignore if user endpoint is restricted
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const fetchOrganisations = useCallback(async () => {
        if (!authState.isAuthStateReady()) {
            return;
        }
        try {
            const endpoint = organizationContext.getIsSuperAdmin() ? 'organisations' : 'organisations/me';
            const response = await apiGet<any>(endpoint);
            const orgList = Array.isArray(response) ? response : response.data || response.results || [];
            setOrganisations(orgList);
        } catch (error) {
            // Ignore if restricted
        }
    }, []);

    useEffect(() => {
        fetchOrganisations();
    }, [fetchOrganisations]);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetchAuditLogs({
                skip: (page - 1) * pageSize,
                limit: pageSize,
                action: actionFilter,
                module_name: moduleFilter,
                user_id: userFilter,
                organisation_id: organisationFilter,
                start_date: startDate ? `${startDate}T00:00:00` : undefined,
                end_date: endDate ? `${endDate}T23:59:59` : undefined,
                sort_by: sortStatus.columnAccessor,
                sort_dir: sortStatus.direction,
            });
            setRecords(response.items || []);
            setTotalRecords(response.total || 0);
        } catch (error) {
            console.error('Failed to load audit logs', error);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, actionFilter, moduleFilter, userFilter, organisationFilter, startDate, endDate, sortStatus]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        setPage(1);
    }, [pageSize, actionFilter, moduleFilter, userFilter, organisationFilter, startDate, endDate]);

    const openDetail = async (logId: number) => {
        try {
            const response = await fetchAuditLog(logId);
            setSelectedLog(response);
            setModalOpen(true);
        } catch (error) {
            console.error('Failed to fetch audit log details', error);
        }
    };

    const exportCsv = () => {
        exportToCsv('audit-logs.csv', records, [
            { key: 'created_date', label: 'Date & Time' },
            { key: 'user_name', label: 'User' },
            { key: 'module_name', label: 'Module' },
            { key: 'action', label: 'Action' },
            { key: 'entity_name', label: 'Entity' },
            { key: 'entity_id', label: 'Entity ID' },
            { key: 'ip_address', label: 'IP Address' },
            { key: 'organisation_name', label: 'Organisation' },
        ]);
    };

    const diffRows = useMemo(() => {
        if (!selectedLog) {
            return [];
        }
        const oldValue = selectedLog.old_value || {};
        const newValue = selectedLog.new_value || {};
        const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)])).sort();
        return keys.map((key) => ({
            key,
            oldValue: oldValue[key],
            newValue: newValue[key],
            changed: JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key]),
        }));
    }, [selectedLog]);

    if (!canViewAudit) {
        return (
            <div className="panel border-white-light px-5 py-8 text-center font-semibold dark:border-[#1b2e4b]">
                You do not have permission to view Audit Logs.
            </div>
        );
    }

    return (
        <div className="panel border-white-light px-0 dark:border-[#1b2e4b]">
            <div className="mb-4 flex flex-wrap items-center gap-3 px-5 pt-5">
                <button type="button" className="btn btn-success gap-2" onClick={exportCsv}>
                    Export CSV
                </button>
                <div className="ml-auto flex flex-wrap items-center gap-3">
                    <select className="form-select w-full sm:w-44" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                        <option value="">All Modules</option>
                        {MODULE_OPTIONS.map((module) => (
                            <option key={module} value={module}>
                                {module}
                            </option>
                        ))}
                    </select>
                    <select className="form-select w-full sm:w-40" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                        <option value="">All Actions</option>
                        {ACTION_OPTIONS.map((action) => (
                            <option key={action} value={action}>
                                {action}
                            </option>
                        ))}
                    </select>
                    <select
                        className="form-select w-full sm:w-52"
                        value={organisationFilter}
                        onChange={(e) => setOrganisationFilter(e.target.value)}
                    >
                        <option value="">All Organisations</option>
                        {organisations.map((org: any) => (
                            <option key={org.id} value={org.id}>
                                {org.name}
                            </option>
                        ))}
                    </select>
                    <select className="form-select w-full sm:w-52" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
                        <option value="">All Users</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.full_name ? `${user.full_name} (${user.username})` : user.username}
                            </option>
                        ))}
                    </select>
                    <input type="date" className="form-input w-full sm:w-40" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <input type="date" className="form-input w-full sm:w-40" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
            </div>

            <div className="datatables pagination-padding px-5 pb-5">
                <DataTable
                    className="table-hover whitespace-nowrap"
                    records={records}
                    columns={[
                        {
                            accessor: 'created_date',
                            title: 'Date & Time',
                            sortable: true,
                            render: ({ created_date }) => <div>{new Date(created_date).toLocaleString()}</div>,
                        },
                        {
                            accessor: 'user_name',
                            title: 'User',
                            sortable: true,
                            render: ({ user_name }) => <div className="font-semibold">{user_name || 'System'}</div>,
                        },
                        { accessor: 'module_name', title: 'Module', sortable: true },
                        { accessor: 'action', title: 'Action', sortable: true },
                        {
                            accessor: 'entity_name',
                            title: 'Entity',
                            sortable: true,
                            render: ({ entity_name, entity_id }) => (
                                <div>
                                    {entity_name || '-'}
                                    {entity_id ? ` #${entity_id}` : ''}
                                </div>
                            ),
                        },
                        { accessor: 'ip_address', title: 'IP Address', sortable: true },
                        { accessor: 'organisation_name', title: 'Organisation', sortable: true },
                        {
                            accessor: 'actions',
                            title: 'Details',
                            sortable: false,
                            textAlignment: 'center',
                            render: ({ id }) => (
                                <button type="button" className="text-primary hover:text-info" onClick={() => openDetail(id)}>
                                    <IconEye />
                                </button>
                            ),
                        },
                    ]}
                    highlightOnHover
                    totalRecords={totalRecords}
                    recordsPerPage={pageSize}
                    page={page}
                    onPageChange={(p) => setPage(p)}
                    recordsPerPageOptions={PAGE_SIZES}
                    onRecordsPerPageChange={setPageSize}
                    sortStatus={sortStatus}
                    onSortStatusChange={setSortStatus}
                    paginationText={({ from, to, totalRecords }) => `Showing ${from} to ${to} of ${totalRecords} entries`}
                />
                {loading && <div className="px-5 py-3 text-sm text-gray-500">Loading audit logs...</div>}
            </div>

            <Transition appear show={modalOpen} as={Fragment}>
                <Dialog as="div" open={modalOpen} onClose={() => setModalOpen(false)}>
                    <TransitionChild as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0" />
                    </TransitionChild>
                    <div className="fixed inset-0 z-[999] overflow-y-auto bg-[black]/60">
                        <div className="flex min-h-screen items-start justify-center px-4">
                            <TransitionChild
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <DialogPanel className="panel my-8 w-full max-w-5xl overflow-hidden rounded-lg border-0 p-0 text-black dark:text-white-dark">
                                    <div className="flex items-center justify-between bg-[#fbfbfb] px-5 py-3 dark:bg-[#121c2c]">
                                        <div className="text-lg font-bold">Audit Log Details</div>
                                        <button type="button" className="text-white-dark hover:text-dark" onClick={() => setModalOpen(false)}>
                                            <IconX />
                                        </button>
                                    </div>
                                    <div className="p-5">
                                        {selectedLog ? (
                                            <div className="space-y-5">
                                                <div className="grid gap-4 md:grid-cols-3">
                                                    <div>
                                                        <div className="text-xs text-gray-500">Action</div>
                                                        <div className="font-semibold">{selectedLog.action}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Module</div>
                                                        <div className="font-semibold">{selectedLog.module_name}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Entity</div>
                                                        <div className="font-semibold">
                                                            {selectedLog.entity_name || '-'}
                                                            {selectedLog.entity_id ? ` #${selectedLog.entity_id}` : ''}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">User</div>
                                                        <div className="font-semibold">{selectedLog.user_name || 'System'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">IP Address</div>
                                                        <div className="font-semibold">{selectedLog.ip_address || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Organisation</div>
                                                        <div className="font-semibold">{selectedLog.organisation_name || '-'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Timestamp</div>
                                                        <div className="font-semibold">{new Date(selectedLog.created_date).toLocaleString()}</div>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <div className="text-xs text-gray-500">User Agent</div>
                                                        <div className="font-semibold">{selectedLog.user_agent || '-'}</div>
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <div className="text-xs text-gray-500">Remarks</div>
                                                        <div className="font-semibold">{selectedLog.remarks || '-'}</div>
                                                    </div>
                                                </div>

                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <div>
                                                        <div className="mb-2 text-sm font-semibold">Old Value</div>
                                                        <pre className="max-h-64 overflow-auto rounded bg-gray-50 p-3 text-xs dark:bg-[#121c2c]">
                                                            {JSON.stringify(selectedLog.old_value || {}, null, 2)}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <div className="mb-2 text-sm font-semibold">New Value</div>
                                                        <pre className="max-h-64 overflow-auto rounded bg-gray-50 p-3 text-xs dark:bg-[#121c2c]">
                                                            {JSON.stringify(selectedLog.new_value || {}, null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="mb-2 text-sm font-semibold">Changed Fields</div>
                                                    <div className="table-responsive">
                                                        <table className="table-striped">
                                                            <thead>
                                                                <tr>
                                                                    <th>Field</th>
                                                                    <th>Old</th>
                                                                    <th>New</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {diffRows.length ? (
                                                                    diffRows.map((row) => (
                                                                        <tr key={row.key} className={row.changed ? 'bg-yellow-50' : ''}>
                                                                            <td className="font-semibold">{row.key}</td>
                                                                            <td>{row.oldValue !== undefined ? JSON.stringify(row.oldValue) : '-'}</td>
                                                                            <td>{row.newValue !== undefined ? JSON.stringify(row.newValue) : '-'}</td>
                                                                        </tr>
                                                                    ))
                                                                ) : (
                                                                    <tr>
                                                                        <td colSpan={3} className="text-center text-gray-500">
                                                                            No changes recorded.
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-500">Loading details...</div>
                                        )}
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

export default AuditLogList;
