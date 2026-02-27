import GstSummaryMonthlyReportClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'GST Summary (Monthly)',
};

const GstSummaryMonthlyReportPage = () => {
    return <GstSummaryMonthlyReportClient />;
};

export default GstSummaryMonthlyReportPage;
