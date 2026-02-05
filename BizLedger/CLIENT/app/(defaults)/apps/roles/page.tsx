'use client';

import ComponentsAppsRoles from '@/components/apps/roles/components-apps-roles';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const Roles = () => {
    return (
        <AuthGuard>
            <ComponentsAppsRoles />
        </AuthGuard>
    );
};

export default Roles;
