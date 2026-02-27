'use client';

import ComponentsAppsOrganisation from '@/components/apps/organisation/components-apps-organisation';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const Organisation = () => {
  return (
    <AuthGuard>
      <ComponentsAppsOrganisation />
    </AuthGuard>
  );
};

export default Organisation;
