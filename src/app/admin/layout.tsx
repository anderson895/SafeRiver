'use client';

import { AdminAuthProvider, useAdminAuth } from '@/components/admin/AdminAuthProvider';
import AdminLogin from '@/components/admin/AdminLogin';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';

/**
 * Gate for the admin console.
 *
 * This decides what to RENDER, nothing more. It is client-side and therefore
 * trivially bypassed by calling the API directly, so every privileged route
 * re-verifies the ID token server-side against an active adminUsers record.
 * Treating this as the security boundary would be a mistake.
 */
function Gate({ children }: { children: ReactNode }) {
  const { user, loading } = useAdminAuth();

  if (loading) {
    return (
      <Stack sx={{ alignItems: 'center', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!user) return <AdminLogin />;

  return <Box>{children}</Box>;
}

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <AdminAuthProvider>
      <Gate>{children}</Gate>
    </AdminAuthProvider>
  );
}
