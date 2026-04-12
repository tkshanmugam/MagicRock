'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React from 'react';

const ComponentsDatatablesBasic = () => {
    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Basic">
                <div className="datatables">
                    <DataTable
                        withBorder
                        borderRadius="sm"
                        striped
                        highlightOnHover
                        records={datatableEmployees}
                        columns={[
                            { accessor: 'id', title: '#', textAlignment: 'right', width: 60 },
                            { accessor: 'firstName', title: 'First name' },
                            { accessor: 'lastName', title: 'Last name' },
                            { accessor: 'email' },
                            { accessor: 'department' },
                            { accessor: 'position' },
                        ]}
                    />
                </div>
            </PanelCodeHighlight>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesBasic;
