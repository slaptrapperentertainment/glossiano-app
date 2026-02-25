import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const MILLICAST_API_KEY = Deno.env.get('MILLICAST_API_KEY');

    if (!MILLICAST_API_KEY) {
      return Response.json({ error: 'Millicast API key not configured' }, { status: 500 });
    }

    const tokenData = await req.json();

    const response = await fetch('https://api.millicast.com/api/publish_token/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MILLICAST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenData),
    });

    const result = await response.json();

    if (!response.ok) {
      return Response.json({ 
        error: result.message || 'Failed to create Millicast token',
        details: result
      }, { status: response.status });
    }

    return Response.json({ 
      success: true,
      token: result
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});