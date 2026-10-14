'use client';

import { getHealth } from '@/services/api/health';
import { useQuery } from '@tanstack/react-query';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
    retry: false,
  });
}
