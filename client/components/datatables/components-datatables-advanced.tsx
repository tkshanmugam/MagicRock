'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { Button, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React, { useState } from 'react';

const ComponentsDatatablesAdvanced = () => {
    const [loading, setLoading] = useState(false);

    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Advanced (expansion, context menu, loader)">
                <div className="datatables">
                    <DataTable
                        fetching={loading}
                        withBorder
                        borderRadius="sm"
                        striped
                        highlightOnHover
                        records={datatableEmployees}
                        rowExpansion={{
                            allowMultiple: true,
                            content: ({ record, collapse }) => (
                                <div className="p-3">
                                    <Text size="sm" mb="xs">
                                        {record.email}
                                    </Text>
                                    <Text size="sm" color="dimmed" mb="sm">
                                        Joined {record.joinedAt} · Salary {record.salary.toLocaleString()}
                                    </Text>
                                    <Button size="xs" variant="light" onClick={collapse}>
                                        Close
                                    </Button>
                                </div>
                            ),
                        }}
                        rowContextMenu={{
                            items: (record) => [
                                {
                                    key: 'copy-email',
                                    title: 'Log email (demo)',
                                    onClick: () => {
                                        void navigator.clipboard.writeText(record.email);
                                    },
                                },
                                { key: 'div', divider: true },
                                {
                                    key: 'noop',
                                    title: 'Secondary action',
                                    onClick: () => undefined,
                                },
                            ],
                        }}
                        columns={[
                            { accessor: 'firstName', title: 'First name' },
                            { accessor: 'lastName', title: 'Last name' },
                            { accessor: 'department' },
                            { accessor: 'position', ellipsis: true },
                        ]}
                    />
                </div>
                <Button mt="md" variant="outline" size="xs" onClick={() => setLoading((v) => !v)}>
                    Toggle loading overlay
                </Button>
            </PanelCodeHighlight>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesAdvanced;
