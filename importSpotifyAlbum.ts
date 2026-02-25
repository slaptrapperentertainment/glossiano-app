import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { albumId } = await req.json();

    if (!albumId) {
      return Response.json({ error: 'albumId is required' }, { status: 400 });
    }

    // Fetch album from Spotify public API (no auth needed)
    const albumResponse = await fetch(`https://api.spotify.com/v1/albums/${albumId}`);
    if (!albumResponse.ok) {
      return Response.json({ error: 'Failed to fetch album from Spotify' }, { status: 400 });
    }

    const albumData = await albumResponse.json();
    const tracks = albumData.tracks.items;

    // Create track records
    const createdTracks = [];
    for (const spotifyTrack of tracks) {
      const trackData = {
        title: spotifyTrack.name,
        artist: albumData.artists.map(a => a.name).join(', '),
        album: albumData.name,
        duration: formatDuration(spotifyTrack.duration_ms),
        year: parseInt(albumData.release_date.split('-')[0]),
        genre: albumData.genres?.length > 0 ? albumData.genres[0] : 'Music',
        cover_image: albumData.images?.[0]?.url || '',
        audio_url: spotifyTrack.external_urls?.spotify || '',
        description: `Available on Spotify`,
        featured: false,
        play_count: 0,
        for_sale: false
      };

      const created = await base44.entities.Track.create(trackData);
      createdTracks.push(created);
    }

    return Response.json({
      success: true,
      album_name: albumData.name,
      tracks_imported: createdTracks.length,
      tracks: createdTracks
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}