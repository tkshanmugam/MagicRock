'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { Checkbox, Group, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React, { useMemo, useState } from 'react';

type ColKey = 'email' | 'department' | 'age' | 'salary';

const ComponentsDatatablesColumnChooser = () => {
    const [visible, setVisible] = useState<Record<ColKey, boolean>>({
        email: true,
        department: true,
        age: true,
        salary: true,
    });

    const columns = useMemo(
        () => [
            { accessor: 'firstName', title: 'First name' },
            { accessor: 'lastName', title: 'Last name' },
            { accessor: 'email', hidden: !visible.email },
            { accessor: 'department', hidden: !visible.department },
            { accessor: 'age', textAlignment: 'right' as const, hidden: !visible.age },
            {
                accessor: 'salary',
                textAlignment: 'right' as const,
                hidden: !visible.salary,
                render: (r: (typeof datatableEmployees)[0]) => r.salary.toLocaleString(),
            },
        ],
        [visible],
    );

    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Column visibility">
                <Text size="sm" color="dimmed" mb="sm">
                    Toggle optional columns without reloading data.
                </Text>
                <Group mb="md">
                    <Checkbox
                        label="Email"
                        checked={visible.email}
                        onChange={(e) => setVisible((v) => ({ ...v, email: e.currentTarget.checked }))}
                    />
                    <Checkbox
                        label="Department"
                        checked={visible.department}
                        onChange={(e) => setVisible((v) => ({ ...v, department: e.currentTarget.checked }))}
                    />
                    <Checkbox
                        label="Age"
                        checked={visible.age}
                        onChange={(e) => setVisible((v) => ({ ...v, age: e.currentTarget.checked }))}
                    />
                    <Checkbox
                        label="Salary"
                        checked={visible.salary}
                        onChange={(e) => setVisible((v) => ({ ...v, salary: e.currentTarget.checked }))}
                    />
                </Group>
                <div className="datatables">
                    <DataTable withBorder borderRadius="sm" striped records={datatableEmployees} columns={columns} />
                </div>
            </PanelCodeHighlight>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesColumnChooser;
