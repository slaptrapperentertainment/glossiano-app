import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { earnings_data } = await req.json();

    if (!earnings_data || !Array.isArray(earnings_data)) {
      return Response.json(
        { error: 'Invalid earnings data format' },
        { status: 400 }
      );
    }

    // Get all user's distributions
    const distributions = await base44.entities.Distribution.filter({
      created_by: user.email
    });

    const reconciled = [];
    const unmatched = [];

    // Process each earnings record
    for (const earning of earnings_data) {
      const match = distributions.find(dist => 
        dist.release_title.toLowerCase() === earning.release_title?.toLowerCase() &&
        dist.artist_name.toLowerCase() === earning.artist_name?.toLowerCase()
      );

      if (match) {
        // Update the distribution with earnings data
        const previousEarnings = match.estimated_earnings || 0;
        const newEarnings = earning.total_earnings || 0;
        const platformStreams = earning.streams || 0;

        await base44.entities.Distribution.update(match.id, {
          estimated_earnings: newEarnings,
          total_streams: (match.total_streams || 0) + platformStreams,
          last_reconciliation_date: new Date().toISOString(),
          reconciliation_status: 'reconciled'
        });

        reconciled.push({
          release_id: match.id,
          release_title: match.release_title,
          previous_earnings: previousEarnings,
          new_earnings: newEarnings,
          streams_added: platformStreams,
          platform: earning.platform,
          reconciled_at: new Date().toISOString()
        });
      } else {
        unmatched.push({
          release_title: earning.release_title,
          artist_name: earning.artist_name,
          platform: earning.platform,
          earnings: earning.total_earnings
        });
      }
    }

    // Send summary email
    try {
      const summary = `
Earnings Reconciliation Report
==============================

Reconciled Releases: ${reconciled.length}
Unmatched Records: ${unmatched.length}

${reconciled.length > 0 ? `Recent Updates:
${reconciled.map(r => 
  `- ${r.release_title}: $${r.previous_earnings.toFixed(2)} → $${r.new_earnings.toFixed(2)} (+${r.streams_added} streams from ${r.platform})`
).join('\n')}` : ''}

${unmatched.length > 0 ? `\nUnmatched Records:
${unmatched.map(r => 
  `- ${r.release_title} by ${r.artist_name} (${r.platform}): $${r.earnings.toFixed(2)}`
).join('\n')}` : ''}

Check your Analytics dashboard for detailed breakdowns.
      `;

      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `Earnings Reconciliation - ${reconciled.length} releases updated`,
        body: summary
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
    }

    return Response.json({
      success: true,
      reconciled_count: reconciled.length,
      unmatched_count: unmatched.length,
      total_earnings_updated: reconciled.reduce((sum, r) => sum + r.new_earnings, 0),
      reconciled_releases: reconciled,
      unmatched_records: unmatched
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});