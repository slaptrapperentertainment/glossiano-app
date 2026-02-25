import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { distribution_id, genres } = body;

    // Get distribution details
    const distribution = await base44.entities.Distribution.read(distribution_id);
    if (!distribution || distribution.created_by !== user.email) {
      return Response.json({ error: 'Distribution not found' }, { status: 404 });
    }

    // Get approved playlists matching the genre
    const approvedPlaylists = await base44.entities.ApprovedPlaylist.filter({
      is_active: true
    });

    // Filter playlists by genre match
    const matchedPlaylists = approvedPlaylists.filter(playlist =>
      playlist.genres.some(g => 
        genres.some(dg => dg.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(dg.toLowerCase()))
      )
    ).slice(0, 50); // Limit to top 50 matches

    if (matchedPlaylists.length === 0) {
      return Response.json({
        error: 'No matching playlists found for your genres',
        matchCount: 0
      }, { status: 400 });
    }

    // Use AI to generate personalized pitch message
    const pitchPrompt = `Generate a compelling, professional music submission pitch for a curator. 

Artist: ${distribution.artist_name}
Song Title: ${distribution.release_title}
Genre: ${distribution.genre}
Release Date: ${distribution.release_date}

The pitch should be:
- Professional but personable
- 2-3 sentences maximum
- Focus on why this song fits their playlist
- Include a unique angle or story
- End with a call-to-action

Generate ONLY the pitch message, no other text.`;

    const pitchResponse = await base44.integrations.Core.InvokeLLM({
      prompt: pitchPrompt
    });

    const pitchMessage = pitchResponse;

    // Calculate potential reach
    const potentialReach = matchedPlaylists.reduce((sum, p) => sum + (p.follower_count || 0), 0);

    // Create playlist pitch campaign
    const playlistPitch = await base44.entities.PlaylistPitch.create({
      distribution_id,
      artist_name: distribution.artist_name,
      release_title: distribution.release_title,
      genre: distribution.genre,
      target_playlists: matchedPlaylists.map(p => ({
        playlist_id: p.id,
        playlist_name: p.playlist_name,
        platform: p.platform,
        followers: p.follower_count,
        match_score: calculateMatchScore(p.genres, genres),
        status: 'pending',
        pitched_date: null
      })),
      pitch_message: pitchMessage,
      status: 'draft',
      total_playlists: matchedPlaylists.length,
      potential_reach: potentialReach
    });

    return Response.json({
      success: true,
      campaign_id: playlistPitch.id,
      playlists_found: matchedPlaylists.length,
      potential_reach: potentialReach,
      pitch_message: pitchMessage
    });

  } catch (error) {
    console.error('Error in aiPlaylistPitching:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateMatchScore(playlistGenres, releaseGenres) {
  let matches = 0;
  for (const pg of playlistGenres) {
    if (releaseGenres.some(rg => 
      rg.toLowerCase().includes(pg.toLowerCase()) || 
      pg.toLowerCase().includes(rg.toLowerCase())
    )) {
      matches++;
    }
  }
  return Math.min(100, (matches / Math.max(playlistGenres.length, releaseGenres.length)) * 100);
}