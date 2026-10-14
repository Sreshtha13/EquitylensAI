import { ApiStatus } from '@/components/common/ApiStatus';
import { PageShell } from '@/components/common/PageShell';

export default function HomePage() {
  return (
    <PageShell
      title="EquityLensAI"
      description="AI-powered market intelligence platform. Phase 1 establishes the application foundation. Market data, research, and authentication are not implemented yet."
    >
      <ApiStatus />
    </PageShell>
  );
}
