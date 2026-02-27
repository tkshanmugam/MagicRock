import InvoiceEditClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Sales Edit',
};

const InvoiceEdit = () => {
    return <InvoiceEditClient />;
};

export default InvoiceEdit;
