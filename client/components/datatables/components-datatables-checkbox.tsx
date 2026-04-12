'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { DatatableEmployee, datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React, { useState } from 'react';

const ComponentsDatatablesCheckbox = () => {
    const [selected, setSelected] = useState<DatatableEmployee[]>([]);

    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Checkbox selection">
                <div className="datatables">
                    <DataTable
                        withBorder
                        borderRadius="sm"
                        striped
                        records={datatableEmployees}
                        selectedRecords={selected}
                        onSelectedRecordsChange={setSelected}
                        columns={[
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

export default ComponentsDatatablesCheckbox;
