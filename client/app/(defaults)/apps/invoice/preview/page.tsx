import InvoicePreviewClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Sales Preview',
};

const InvoicePreview = () => {
    return <InvoicePreviewClient />;
};

export default InvoicePreview;
