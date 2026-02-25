import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { distribution_id } = await req.json();

    // Get the distribution
    const distribution = await base44.asServiceRole.entities.Distribution.get(distribution_id);

    if (!distribution) {
      return Response.json({ error: 'Distribution not found' }, { status: 404 });
    }

    // Mark as hot new artist
    const updated = await base44.asServiceRole.entities.Distribution.update(distribution_id, {
      is_hot_new_artist: true,
      processing_status: 'live'
    });

    // Send notification email to artist
    await base44.integrations.Core.SendEmail({
      to: distribution.created_by,
      subject: `🎉 Your Release "${distribution.release_title}" is Now Live!`,
      body: `
Congratulations! Your release "${distribution.release_title}" is now live on Spotify and other major streaming platforms.

Your track has been featured as a "Hot New Release" and has been pitched to ${distribution.playlist_pitch_count || 0} playlist curators.

Track Details:
- Artist: ${distribution.artist_name}
- Title: ${distribution.release_title}
- Genre: ${distribution.genre}
- Status: ${distribution.status}

Keep an eye on your analytics dashboard to track streams and earnings!

Best of luck!
Slap Trapper Team
      `,
      from_name: 'Slap Trapper Entertainment'
    });

    return Response.json({
      success: true,
      message: 'Release marked as hot new artist and featured',
      distribution: updated
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});