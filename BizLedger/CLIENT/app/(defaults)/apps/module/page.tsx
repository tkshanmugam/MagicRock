'use client';

import ComponentsAppsModule from '@/components/apps/module/components-apps-module';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const Module = () => {
  return (
    <AuthGuard>
      <ComponentsAppsModule />
    </AuthGuard>
  );
};

export default Module;
