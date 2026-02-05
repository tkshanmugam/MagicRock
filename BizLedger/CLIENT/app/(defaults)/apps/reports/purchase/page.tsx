import PurchaseReportClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Purchase Report',
};

const PurchaseReportPage = () => {
    return <PurchaseReportClient />;
};

export default PurchaseReportPage;
