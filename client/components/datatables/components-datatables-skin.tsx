'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React from 'react';

const ComponentsDatatablesSkin = () => {
    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Themed table (shadow, radius, borders)">
                <div className="datatables">
                    <DataTable
                        shadow="md"
                        withBorder
                        withColumnBorders
                        borderRadius="md"
                        horizontalSpacing="md"
                        verticalSpacing="sm"
                        striped
                        highlightOnHover
                        records={datatableEmployees.slice(0, 12)}
                        columns={[
                            { accessor: 'firstName', title: 'First name' },
                            { accessor: 'lastName', title: 'Last name' },
                            { accessor: 'department' },
                            {
                                accessor: 'salary',
                                textAlignment: 'right',
                                render: (r) => r.salary.toLocaleString(),
                            },
                        ]}
                    />
                </div>
            </PanelCodeHighlight>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesSkin;
