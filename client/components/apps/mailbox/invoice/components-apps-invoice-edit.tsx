'use client';
import React from 'react';
import { useSearchParams } from 'next/navigation';
import SalesInvoiceForm from '@/components/apps/mailbox/invoice/sales-invoice-form';

const ComponentsAppsInvoiceEdit = () => {
    const searchParams = useSearchParams();
    const invoiceId = Number(searchParams.get('id') || 0);
    return <SalesInvoiceForm mode="edit" invoiceId={invoiceId || undefined} />;
};

export default ComponentsAppsInvoiceEdit;
