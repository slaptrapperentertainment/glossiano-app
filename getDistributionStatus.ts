import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const FUGA_API_URL = 'https://api.fuga.com/v3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { distributionId } = await req.json();

    if (!distributionId) {
      return Response.json({ error: 'Distribution ID required' }, { status: 400 });
    }

    // Get distribution record
    const distribution = await base44.entities.Distribution.get(distributionId);

    if (!distribution || distribution.created_by !== user.email) {
      return Response.json({ error: 'Distribution not found' }, { status: 404 });
    }

    const fugaApiKey = Deno.env.get('FUGA_API_KEY');
    const fugaApiSecret = Deno.env.get('FUGA_API_SECRET');

    if (!fugaApiKey || !fugaApiSecret) {
      return Response.json({ error: 'API credentials not configured' }, { status: 500 });
    }

    // Check delivery status from FUGA
    const deliveriesResponse = await fetch(
      `${FUGA_API_URL}/products/${distributionId}/deliveries`,
      {
        headers: {
          'Authorization': `Bearer ${fugaApiKey}`,
          'X-API-Secret': fugaApiSecret
        }
      }
    );

    if (!deliveriesResponse.ok) {
      return Response.json({ 
        status: distribution.status,
        message: 'Unable to fetch live status'
      });
    }

    const deliveries = await deliveriesResponse.json();

    // Parse delivery status for each platform
    const platformStatus = {};
    if (deliveries && Array.isArray(deliveries)) {
      deliveries.forEach(delivery => {
        platformStatus[delivery.platform] = {
          status: delivery.status,
          url: delivery.url,
          delivered_at: delivery.delivered_at
        };
      });
    }

    return Response.json({ 
      success: true,
      distribution_id: distributionId,
      overall_status: distribution.status,
      platforms: platformStatus
    });

  } catch (error) {
    console.error('Status check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});