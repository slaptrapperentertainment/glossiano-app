import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { fanId } = await req.json();

    if (!fanId) {
      return Response.json({ error: 'Fan ID required' }, { status: 400 });
    }

    // Update last engagement time
    await base44.asServiceRole.entities.Fan.update(fanId, {
      last_engagement: new Date().toISOString()
    });

    return Response.json({ success: true });

  } catch (error) {
    console.error('Email tracking error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});