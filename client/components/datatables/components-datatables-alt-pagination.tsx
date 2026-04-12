'use client';

import PanelCodeHighlight from '@/components/panel-code-highlight';
import { DataTable } from 'mantine-datatable';
import DatatablesMantineProvider from '@/components/datatables/datatables-mantine-provider';
import { datatableEmployees } from '@/components/datatables/datatables-sample-data';
import React, { useMemo, useState } from 'react';

const ComponentsDatatablesAltPagination = () => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    const pageRecords = useMemo(() => {
        const from = (page - 1) * pageSize;
        return datatableEmployees.slice(from, from + pageSize);
    }, [page, pageSize]);

    return (
        <DatatablesMantineProvider>
            <PanelCodeHighlight title="Alternate pagination">
                <div className="datatables">
                    <DataTable
                        withBorder
                        borderRadius="sm"
                        striped
                        records={pageRecords}
                        columns={[
                            { accessor: 'id', title: '#', textAlignment: 'right', width: 60 },
                            { accessor: 'firstName', title: 'First name' },
                            { accessor: 'lastName', title: 'Last name' },
                            { accessor: 'department' },
                            { accessor: 'salary', title: 'Salary', textAlignment: 'right', render: (r) => r.salary.toLocaleString() },
                        ]}
                        totalRecords={datatableEmployees.length}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={setPage}
                        recordsPerPageOptions={[5, 10, 15]}
                        onRecordsPerPageChange={(n) => {
                            setPageSize(n);
                            setPage(1);
                        }}
                        paginationText={({ from, to, totalRecords }) => `Rows ${from}–${to} of ${totalRecords}`}
                    />
                </div>
            </PanelCodeHighlight>
        </DatatablesMantineProvider>
    );
};

export default ComponentsDatatablesAltPagination;
