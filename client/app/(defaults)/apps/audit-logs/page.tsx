import AuditLogsClient from './client';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
    title: 'Audit Logs',
};

const AuditLogsPage = () => {
    return <AuditLogsClient />;
};

export default AuditLogsPage;
