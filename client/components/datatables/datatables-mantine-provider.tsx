'use client';

import { MantineProvider } from '@mantine/core';
import { ReactNode } from 'react';

export default function DatatablesMantineProvider({ children }: { children: ReactNode }) {
    return <MantineProvider>{children}</MantineProvider>;
}
