'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { DataTable, DataTableSortStatus } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React, { useMemo, useState } from 'react';

const ComponentsDatatablesOrderSorting = () => {
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({ columnAccessor: 'lastName', direction: 'asc' });

    const sorted = useMemo(() => {
        const { columnAccessor, direction } = sortStatus;
        const copy = [...datatableEmployees];
        copy.sort((a, b) => {
            const av = (a as Record<string, unknown>)[columnAccessor];
            const bv = (b as Record<string, unknown>)[columnAccessor];
            if (av === bv) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            const cmp = av < bv ? -1 : 1;
            return direction === 'asc' ? cmp : -cmp;
        });
        return copy;
    }, [sortStatus]);

    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Column sorting">
                <div className="datatables">
                    <DataTable
                        withBorder
                        borderRadius="sm"
                        striped
                        records={sorted}
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                        columns={[
                            { accessor: 'firstName', title: 'First name', sortable: true },
                            { accessor: 'lastName', title: 'Last name', sortable: true },
                            { accessor: 'department', sortable: true },
                            { accessor: 'age', textAlignment: 'right', sortable: true },
                            { accessor: 'salary', textAlignment: 'right', sortable: true, render: (r) => r.salary.toLocaleString() },
                        ]}
                    />
                </div>
            </PanelCodeHighlight>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesOrderSorting;
