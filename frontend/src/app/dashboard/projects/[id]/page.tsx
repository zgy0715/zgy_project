'use client';

import { use } from 'react';
import { redirect } from 'next/navigation';

// Default page redirects to workflow tab
export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  redirect(`/dashboard/projects/${id}/workflow`);
}
