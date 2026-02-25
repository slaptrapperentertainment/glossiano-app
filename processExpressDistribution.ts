import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { distribution_id } = await req.json();

    // Get the distribution
    const distribution = await base44.entities.Distribution.get(distribution_id);

    if (!distribution) {
      return Response.json({ error: 'Distribution not found' }, { status: 404 });
    }

    // Verify ownership
    if (distribution.created_by !== user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update status to processing
    await base44.entities.Distribution.update(distribution_id, {
      processing_status: 'processing',
      processing_speed: 'express',
      estimated_live_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });

    // After 24 hours simulated processing, move to ready_for_spotify
    const delay = async (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // In production, this would be a scheduled job
    // For now, immediately transition to playlist pitching stage
    await base44.entities.Distribution.update(distribution_id, {
      processing_status: 'ready_for_spotify',
      is_hot_new_artist: true
    });

    // Invoke playlist pitching
    const pitchResult = await base44.asServiceRole.functions.invoke('pitchToSpotifyPlaylists', {
      distribution_id: distribution_id,
      artist_name: distribution.artist_name,
      release_title: distribution.release_title,
      genre: distribution.genre,
      audio_file_url: distribution.audio_file_url,
      cover_art_url: distribution.cover_art_url
    });

    return Response.json({
      success: true,
      message: 'Express distribution processing started',
      playlist_pitching: pitchResult.data
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});