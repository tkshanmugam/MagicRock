'use client';

import ComponentsDashboardFinance from '@/components/dashboard/components-dashboard-finance';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const Finance = () => {
  return (
    <AuthGuard>
      <ComponentsDashboardFinance />
    </AuthGuard>
  );
};

export default Finance;
