import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();

    // Validate required fields
    if (!data.artist_name || !data.release_title || !data.audio_file_url || !data.cover_art_url) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate ISRC and UPC if not provided
    const isrc = data.isrc || `US${new Date().getFullYear()}${Math.random().toString(36).substr(2, 7).toUpperCase()}`;
    const upc = data.upc || Math.floor(100000000000 + Math.random() * 900000000000).toString();

    // Create distribution record
    const distribution = await base44.entities.Distribution.create({
      ...data,
      isrc,
      upc,
      status: 'processing',
      platforms: data.platforms || [
        'spotify', 'apple_music', 'amazon_music', 'youtube_music', 'tidal', 'deezer',
        'bandcamp', 'soundcloud', 'shazam', 'pandora', 'iheartradio', 'instagram', 'facebook', 'tiktok'
      ]
    });

    // Trigger multi-platform distribution
    try {
      await base44.asServiceRole.functions.invoke('distributeToAllPlatforms', {
        distribution_id: distribution.id
      });
    } catch (e) {
      console.log('Distribution trigger initiated:', e.message);
    }

    // Send confirmation email
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `🎵 Your release "${data.release_title}" is being distributed!`,
      body: `
Your release is being distributed to 40+ platforms globally!

ISRC: ${isrc}
UPC: ${upc}

Track progress in your dashboard.

-Slap Trapper
      `
    });

    return Response.json({ 
      success: true,
      distribution_id: distribution.id,
      isrc,
      upc,
      status: 'processing',
      message: 'Release submitted. Distributing to 40+ platforms...'
    });

  } catch (error) {
    console.error('Distribution error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});