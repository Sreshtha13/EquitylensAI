'use client';

import { useMutation } from '@tanstack/react-query';
import { requestResearch, type ResearchRequest } from '@/services/api/research';

export function useResearch() {
  return useMutation({
    mutationFn: (request: ResearchRequest) => requestResearch(request),
  });
}
