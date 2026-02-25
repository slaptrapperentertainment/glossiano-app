import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all user's distributions
    const distributions = await base44.entities.Distribution.filter({
      created_by: user.email,
      status: 'live'
    });

    const updates = [];

    // Simulate stats sync (in production, this would fetch from FUGA API)
    for (const dist of distributions) {
      try {
        // Simulate random growth in streams
        const currentStreams = dist.total_streams || 0;
        const newStreams = currentStreams + Math.floor(Math.random() * 500);
        const estimatedEarnings = newStreams * 0.004;

        await base44.entities.Distribution.update(dist.id, {
          total_streams: newStreams,
          estimated_earnings: estimatedEarnings
        });

        updates.push({
          id: dist.id,
          title: dist.release_title,
          streams: newStreams,
          earnings: estimatedEarnings
        });
      } catch (error) {
        console.error(`Failed to sync stats for ${dist.id}:`, error);
      }
    }

    return Response.json({ 
      success: true, 
      updated: updates.length,
      distributions: updates
    });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});