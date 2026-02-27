'use client';

import ComponentsAppsTSettings from '@/components/apps/tsettings/components-apps-tsettings';
import AuthGuard from '@/components/auth/AuthGuard';
import React from 'react';

const TSettings = () => {
    return (
        <AuthGuard>
            <ComponentsAppsTSettings />
        </AuthGuard>
    );
};

export default TSettings;
