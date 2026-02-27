import SalesReportClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Sales Report',
};

const SalesReportPage = () => {
    return <SalesReportClient />;
};

export default SalesReportPage;
