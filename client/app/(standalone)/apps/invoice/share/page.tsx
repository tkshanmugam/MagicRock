import InvoiceShareClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Invoice Share',
};

const InvoiceSharePage = () => {
    return <InvoiceShareClient />;
};

export default InvoiceSharePage;
