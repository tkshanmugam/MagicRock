'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React from 'react';

const engineering = datatableEmployees.filter((e) => e.department === 'Engineering');
const sales = datatableEmployees.filter((e) => e.department === 'Sales');

const ComponentsDatatablesMultipleTables = () => {
    return (
        <DatatablesMantineProvider>
            <div className="space-y-6">
                <PanelCodeHighlight title="Engineering">
                    <div className="datatables">
                        <DataTable
                            withBorder
                            borderRadius="sm"
                            striped
                            records={engineering}
                            columns={[
                                { accessor: 'firstName', title: 'First name' },
                                { accessor: 'lastName', title: 'Last name' },
                                { accessor: 'position' },
                            ]}
                        />
                    </div>
                </PanelCodeHighlight>
                <PanelCodeHighlight title="Sales">
                    <div className="datatables">
                        <DataTable
                            withBorder
                            borderRadius="sm"
                            striped
                            records={sales}
                            columns={[
                                { accessor: 'firstName', title: 'First name' },
                                { accessor: 'lastName', title: 'Last name' },
                                { accessor: 'position' },
                            ]}
                        />
                    </div>
                </PanelCodeHighlight>
            </div>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesMultipleTables;
