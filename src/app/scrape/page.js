'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect to home with the scrape tab active
export default function ScrapeRedirect() {
  const router = useRouter();

  useEffect(() => {
    // In our current architecture, the application is on the root route.
    // We could either redirect to /?tab=scrape or just show a message.
    // However, the user specifically tried http://localhost:3000/scrape.
    // I will implement a real route for them that mirrors the scrape visualization.
    router.replace('/?tab=scrape');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white/40 font-black uppercase tracking-widest text-xs">
      Initializing Topology Engine...
    </div>
  );
}
