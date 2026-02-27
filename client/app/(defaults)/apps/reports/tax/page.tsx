import TaxReportClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'GST Summary',
};

const TaxReportPage = () => {
    return <TaxReportClient />;
};

export default TaxReportPage;
