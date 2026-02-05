import InvoiceAddClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Sales Add',
};

const InvoiceAdd = () => {
    return <InvoiceAddClient />;
};

export default InvoiceAdd;
