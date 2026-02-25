import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      artist_name,
      song_title,
      genre,
      reference_url,
      special_instructions,
      service_tier,
      audio_url
    } = await req.json();

    if (!artist_name || !song_title || !audio_url) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const apiKey = Deno.env.get('MIXMEA_API_KEY');
    if (!apiKey) {
      return Response.json(
        { error: 'Mastering service not configured' },
        { status: 500 }
      );
    }

    // Submit to MIXMEA API
    let mastering_id = null;
    try {
      const mixmeaResponse = await fetch('https://api.mixmea.com/api/orders/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artist_name,
          song_title,
          genre,
          audio_url,
          reference_url: reference_url || null,
          instructions: special_instructions || null,
          service_tier,
          callback_url: `${Deno.env.get('BASE44_APP_URL')}/api/webhooks/mixmea`
        })
      });

      const mixmeaData = await mixmeaResponse.json();
      if (!mixmeaResponse.ok) {
        throw new Error(mixmeaData.message || 'Failed to submit to MIXMEA');
      }

      mastering_id = mixmeaData.order_id;
    } catch (apiError) {
      console.error('MIXMEA API error:', apiError);
      return Response.json(
        { error: 'Failed to submit mastering order: ' + apiError.message },
        { status: 500 }
      );
    }

    // Send notification email
    try {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `Mastering Order Submitted - ${mastering_id}`,
        body: `
Your mastering order has been submitted to MIXMEA!

Order Details:
- Order ID: ${mastering_id}
- Artist: ${artist_name}
- Song: ${song_title}
- Genre: ${genre}
- Service Tier: ${service_tier}

You can track your order status on the MIXMEA dashboard.
${special_instructions ? `\nSpecial Instructions:\n${special_instructions}` : ''}

Best regards,
Slap Trapper Entertainment
        `
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
    }

    return Response.json({
      success: true,
      mastering_id,
      message: 'Your track has been submitted to MIXMEA for mastering',
      artist_name,
      song_title
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});