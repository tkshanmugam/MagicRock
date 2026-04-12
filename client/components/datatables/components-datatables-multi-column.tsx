'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { Badge, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React from 'react';

const statusColor: Record<string, string> = {
    active: 'green',
    on_leave: 'yellow',
    terminated: 'red',
};

const ComponentsDatatablesMultiColumn = () => {
    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Multi-column layout">
                <div className="datatables">
                    <DataTable
                        withBorder
                        withColumnBorders
                        borderRadius="sm"
                        striped
                        highlightOnHover
                        records={datatableEmployees}
                        columns={[
                            { accessor: 'id', title: '#', textAlignment: 'right', width: 56 },
                            { accessor: 'firstName', title: 'First name', width: 120 },
                            { accessor: 'lastName', title: 'Last name', width: 120 },
                            { accessor: 'email', title: 'Email', ellipsis: true },
                            { accessor: 'department', width: 130 },
                            { accessor: 'position', title: 'Role', ellipsis: true },
                            {
                                accessor: 'status',
                                width: 120,
                                render: (r) => (
                                    <Badge color={statusColor[r.status] || 'gray'} variant="light" size="sm">
                                        {r.status.replace('_', ' ')}
                                    </Badge>
                                ),
                            },
                            { accessor: 'age', textAlignment: 'right', width: 70 },
                            {
                                accessor: 'salary',
                                title: 'Salary (USD)',
                                textAlignment: 'right',
                                width: 120,
                                render: (r) => <Text weight={500}>{r.salary.toLocaleString()}</Text>,
                            },
                            { accessor: 'joinedAt', title: 'Joined', width: 110 },
                        ]}
                    />
                </div>
            </PanelCodeHighlight>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesMultiColumn;
