import InvoiceListClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Sales List',
};

const InvoiceList = () => {
    return <InvoiceListClient />;
};

export default InvoiceList;
