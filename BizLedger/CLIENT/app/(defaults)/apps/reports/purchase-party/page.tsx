import PurchasePartyReportClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Purchase by Party',
};

const PurchasePartyReportPage = () => {
    return <PurchasePartyReportClient />;
};

export default PurchasePartyReportPage;
