import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const {
      distribution_id,
      artist_name,
      release_title,
      genre,
      audio_file_url,
      cover_art_url
    } = await req.json();

    // Get all active curators with auto-pitch enabled
    const curators = await base44.asServiceRole.entities.SpotifyPlaylistCurator.filter({
      auto_pitch: true,
      status: 'active'
    });

    // Filter curators by genre match
    const matchingCurators = curators.filter(curator => {
      return curator.genres && curator.genres.some(
        curatorGenre => curatorGenre.toLowerCase() === genre.toLowerCase()
      );
    });

    // Prepare pitch records and send emails
    const pitchResults = [];

    for (const curator of matchingCurators) {
      try {
        // Create pitch record
        const pitchTemplate = curator.pitch_template || `
Hi ${curator.curator_name},

I'm reaching out about a new track that I think would be a great fit for your playlist "${curator.playlist_name}".

Artist: ${artist_name}
Track: ${release_title}
Genre: ${genre}

Your playlist is known for curating quality ${genre} content, and I believe this track aligns perfectly with your audience.

Would love to get it added!

Best,
${artist_name}
        `;

        // Send pitch email if curator_email exists
        if (curator.curator_email) {
          await base44.integrations.Core.SendEmail({
            to: curator.curator_email,
            subject: `New Track Submission: ${release_title} by ${artist_name}`,
            body: pitchTemplate,
            from_name: 'Slap Trapper Entertainment'
          });
        }

        // Update curator's last_pitched timestamp
        await base44.asServiceRole.entities.SpotifyPlaylistCurator.update(curator.id, {
          last_pitched: new Date().toISOString()
        });

        pitchResults.push({
          curator_id: curator.id,
          playlist_name: curator.playlist_name,
          status: 'pitched'
        });
      } catch (error) {
        pitchResults.push({
          curator_id: curator.id,
          playlist_name: curator.playlist_name,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Update distribution with pitch count
    const totalPitches = pitchResults.length;
    await base44.asServiceRole.entities.Distribution.update(distribution_id, {
      processing_status: 'spotify_pitching',
      playlist_pitch_count: totalPitches
    });

    return Response.json({
      success: true,
      distribution_id,
      total_curators_pitched: totalPitches,
      matching_curators: matchingCurators.length,
      results: pitchResults
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});