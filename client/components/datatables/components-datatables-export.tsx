'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { Button, Group } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React, { useCallback } from 'react';

function toCsv(rows: typeof datatableEmployees) {
    const headers = ['id', 'firstName', 'lastName', 'email', 'department', 'position', 'age', 'salary', 'status', 'joinedAt'];
    const escape = (v: string | number) => {
        const s = String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    const lines = [headers.join(',')];
    for (const r of rows) {
        lines.push(headers.map((h) => escape((r as Record<string, string | number>)[h])).join(','));
    }
    return lines.join('\n');
}

const ComponentsDatatablesExport = () => {
    const download = useCallback(() => {
        const csv = toCsv(datatableEmployees);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employees.csv';
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Export">
                <Group mb="md">
                    <Button size="sm" onClick={download}>
                        Download CSV
                    </Button>
                </Group>
                <div className="datatables">
                    <DataTable
                        withBorder
                        borderRadius="sm"
                        striped
                        records={datatableEmployees}
                        columns={[
                            { accessor: 'id', title: '#', textAlignment: 'right', width: 56 },
                            { accessor: 'firstName', title: 'First name' },
                            { accessor: 'lastName', title: 'Last name' },
                            { accessor: 'email' },
                            { accessor: 'department' },
                        ]}
                    />
                </div>
            </PanelCodeHighlight>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesExport;
