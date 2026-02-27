'use client';

import ComponentsAppsUser from '@/components/apps/user/components-apps-user';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const User = () => {
  return (
    <AuthGuard>
      <ComponentsAppsUser />
    </AuthGuard>
  );
};

export default User;
