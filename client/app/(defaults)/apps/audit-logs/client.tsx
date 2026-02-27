'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import AuditLogList from '@/components/audit-logs/audit-log-list';
import React from 'react';

const AuditLogsClient = () => {
    return (
        <AuthGuard>
            <AuditLogList />
        </AuthGuard>
    );
};

export default AuditLogsClient;
