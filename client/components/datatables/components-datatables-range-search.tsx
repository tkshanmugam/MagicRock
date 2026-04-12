'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { NumberInput, SimpleGrid } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React, { useMemo, useState } from 'react';

const ComponentsDatatablesRangeSearch = () => {
    const [minSalary, setMinSalary] = useState<number | undefined>(60000);
    const [maxSalary, setMaxSalary] = useState<number | undefined>(120000);

    const filtered = useMemo(() => {
        const min = minSalary ?? -Infinity;
        const max = maxSalary ?? Infinity;
        return datatableEmployees.filter((r) => r.salary >= min && r.salary <= max);
    }, [minSalary, maxSalary]);

    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Range filter (salary)">
                <SimpleGrid cols={2} mb="md" breakpoints={[{ maxWidth: 'sm', cols: 1 }]}>
                    <NumberInput label="Minimum salary" value={minSalary} onChange={setMinSalary} min={0} step={1000} />
                    <NumberInput label="Maximum salary" value={maxSalary} onChange={setMaxSalary} min={0} step={1000} />
                </SimpleGrid>
                <div className="datatables">
                    <DataTable
                        withBorder
                        borderRadius="sm"
                        striped
                        records={filtered}
                        columns={[
                            { accessor: 'firstName', title: 'First name' },
                            { accessor: 'lastName', title: 'Last name' },
                            { accessor: 'department' },
                            { accessor: 'position', ellipsis: true },
                            { accessor: 'salary', title: 'Salary', textAlignment: 'right', render: (r) => r.salary.toLocaleString() },
                        ]}
                    />
                </div>
            </PanelCodeHighlight>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesRangeSearch;
