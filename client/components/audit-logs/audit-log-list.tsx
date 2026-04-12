'use client';

import React, { useCallback, useEffect, useMemo, useState, Fragment, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import type { DataTableProps, DataTableSortStatus } from 'mantine-datatable';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import Swal from 'sweetalert2';

import IconEye from '@/components/icon/icon-eye';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import IconX from '@/components/icon/icon-x';
import { apiGet } from '@/lib/apiClient';
import { authState } from '@/lib/authState';
import { organizationContext } from '@/lib/organizationContext';
import { exportToCsv } from '@/lib/exportUtils';
import { fetchAuditLog, fetchAuditLogs, deleteAuditLog, bulkDeleteAuditLogs, AuditLogItem } from '@/lib/auditLogApi';
import { getTranslation } from '@/i18n';

const DataTable = dynamic(() => import('mantine-datatable').then((mod) => mod.DataTable), {
    ssr: false,
    loading: () => (
        <div className="panel mt-5">
            <div className="text-center py-8">Loading audit logs...</div>
        </div>
    ),
}) as ComponentType<DataTableProps<AuditLogItem>>;

const ACTION_OPTIONS = ['CREATE', 'UPDATE', 'DELETE', 'CANCEL', 'LOGIN', 'LOGOUT'];
const MODULE_OPTIONS = ['Authentication', 'User', 'Sales', 'Purchase', 'Settings'];

type UserOption = {
    id: number;
    username: string;
    full_name?: string | null;
};

const AuditLogList = () => {
    const { t } = getTranslation();
    const canViewAudit = organizationContext.getIsSuperAdmin() || organizationContext.hasPermission('Audit', 'view');
    const canDeleteAudit = organizationContext.getIsSuperAdmin() || organizationContext.hasPermission('Audit', 'delete');
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
    const [selectedRecords, setSelectedRecords] = useState<AuditLogItem[]>([]);

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

    useEffect(() => {
        setSelectedRecords([]);
    }, [page, pageSize, actionFilter, moduleFilter, userFilter, organisationFilter, startDate, endDate]);

    const openDetail = async (logId: number) => {
        try {
            const response = await fetchAuditLog(logId);
            setSelectedLog(response);
            setModalOpen(true);
        } catch (error) {
            console.error('Failed to fetch audit log details', error);
        }
    };

    const removeFromSelection = (id: number) => {
        setSelectedRecords((prev) => prev.filter((r) => r.id !== id));
    };

    const handleDeleteOne = async (log: AuditLogItem) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Delete audit log?',
            text: 'This removes the log entry permanently. It cannot be undone.',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#d33',
        });
        if (!result.isConfirmed) {
            return;
        }
        try {
            await deleteAuditLog(log.id);
            removeFromSelection(log.id);
            if (selectedLog?.id === log.id) {
                setModalOpen(false);
                setSelectedLog(null);
            }
            void Swal.fire({
                icon: 'success',
                title: 'Deleted',
                text: 'Audit log entry removed.',
                timer: 2000,
                showConfirmButton: false,
            });
            fetchLogs();
        } catch (error) {
            console.error('Failed to delete audit log', error);
            void Swal.fire({
                icon: 'error',
                title: 'Delete failed',
                text: error instanceof Error ? error.message : 'Could not delete this entry.',
            });
        }
    };

    const handleDeleteSelected = async () => {
        if (!selectedRecords.length) {
            return;
        }
        const ids = selectedRecords.map((r) => r.id);
        const result = await Swal.fire({
            icon: 'warning',
            title: `Delete ${ids.length} log${ids.length === 1 ? '' : 's'}?`,
            text: 'Selected audit log entries will be removed permanently.',
            showCancelButton: true,
            confirmButtonText: 'Delete all',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#d33',
        });
        if (!result.isConfirmed) {
            return;
        }
        try {
            await bulkDeleteAuditLogs(ids);
            if (selectedLog && ids.includes(selectedLog.id)) {
                setModalOpen(false);
                setSelectedLog(null);
            }
            setSelectedRecords([]);
            void Swal.fire({
                icon: 'success',
                title: 'Deleted',
                text: 'Selected entries removed.',
                timer: 2000,
                showConfirmButton: false,
            });
            fetchLogs();
        } catch (error) {
            console.error('Failed to bulk delete audit logs', error);
            void Swal.fire({
                icon: 'error',
                title: 'Delete failed',
                text: error instanceof Error ? error.message : 'Could not delete selected entries.',
            });
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
            <div className="border-b border-white-light px-5 pb-4 pt-5 dark:border-[#1b2e4b]">
                <h1 className="text-2xl font-bold text-black dark:text-white-light">Audit Logs</h1>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-3 px-5 pt-5">
                <button type="button" className="btn btn-success gap-2" onClick={exportCsv}>
                    Export CSV
                </button>
                {canDeleteAudit && selectedRecords.length > 0 && (
                    <button type="button" className="btn btn-danger gap-2" onClick={() => void handleDeleteSelected()}>
                        Delete selected ({selectedRecords.length})
                    </button>
                )}
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
                    {...({
                        withBorder: false,
                        className: 'table-hover whitespace-nowrap',
                        records,
                        columns: [
                            {
                                accessor: 'created_date',
                                title: t('th_date_time'),
                                sortable: true,
                                render: ({ created_date }) => <div>{new Date(created_date).toLocaleString()}</div>,
                            },
                            {
                                accessor: 'user_name',
                                title: t('th_user'),
                                sortable: true,
                                render: ({ user_name }) => <div className="font-semibold">{user_name || 'System'}</div>,
                            },
                            { accessor: 'module_name', title: t('th_module'), sortable: true },
                            { accessor: 'action', title: t('th_action'), sortable: true },
                            {
                                accessor: 'entity_name',
                                title: t('th_entity'),
                                sortable: true,
                                render: ({ entity_name, entity_id }) => (
                                    <div>
                                        {entity_name || '-'}
                                        {entity_id ? ` #${entity_id}` : ''}
                                    </div>
                                ),
                            },
                            { accessor: 'ip_address', title: t('th_ip_address'), sortable: true },
                            { accessor: 'organisation_name', title: t('th_organisation'), sortable: true },
                            {
                                accessor: 'actions',
                                title: t('th_actions'),
                                sortable: false,
                                textAlignment: 'center',
                                render: (row) => (
                                    <div className="mx-auto flex w-max items-center justify-center gap-3">
                                        <button type="button" className="text-primary hover:text-info" title="View details" onClick={() => openDetail(row.id)}>
                                            <IconEye />
                                        </button>
                                        {canDeleteAudit && (
                                            <button
                                                type="button"
                                                className="text-danger hover:text-red-400"
                                                title="Delete"
                                                onClick={() => void handleDeleteOne(row)}
                                            >
                                                <IconTrashLines className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                ),
                            },
                        ],
                        highlightOnHover: true,
                        idAccessor: 'id',
                        ...(canDeleteAudit ? { selectedRecords, onSelectedRecordsChange: setSelectedRecords } : {}),
                        totalRecords,
                        recordsPerPage: pageSize,
                        page,
                        onPageChange: (p: number) => setPage(p),
                        recordsPerPageOptions: PAGE_SIZES,
                        onRecordsPerPageChange: setPageSize,
                        sortStatus,
                        onSortStatusChange: setSortStatus,
                        paginationText: ({ from, to, totalRecords: tot }) => `Showing ${from} to ${to} of ${tot} entries`,
                    } as DataTableProps<AuditLogItem>)}
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
