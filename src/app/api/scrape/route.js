import { buildGraphFromWeb } from '@/lib/scraper';

export async function POST(request) {
  try {
    const { startUrl, maxDepth } = await request.json();
    
    if (!startUrl || maxDepth === undefined) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
    }
    
    const encoder = new TextEncoder();
    const abortController = new AbortController();

    const stream = new ReadableStream({
      async start(controller) {
        const onUpdate = (event) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch (e) {
            // Ignore if controller is closed
          }
        };

        try {
          await buildGraphFromWeb(startUrl, parseInt(maxDepth), onUpdate, abortController.signal);
        } catch (error) {
          onUpdate({ type: 'error', message: error.message });
        } finally {
          try {
            controller.close();
          } catch (e) {}
        }
      },
      cancel() {
        abortController.abort();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
