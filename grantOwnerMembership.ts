import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isOwner = user.email === 'slaptrapperentertainment@gmail.com';

    if (!isOwner) {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get the highest tier membership
    const memberships = await base44.entities.Membership.list('-price_monthly', 1);
    
    if (!memberships || memberships.length === 0) {
      return Response.json({ error: 'No memberships available' }, { status: 400 });
    }

    const highestTier = memberships[0];

    // Check if owner already has an active subscription
    const existingSubs = await base44.entities.MembershipSubscription.filter({
      fan_email: user.email,
      status: 'active'
    });

    if (existingSubs.length > 0) {
      return Response.json({
        success: true,
        message: 'Owner already has active membership',
        subscription: existingSubs[0]
      });
    }

    // Create free premium subscription
    const subscription = await base44.entities.MembershipSubscription.create({
      fan_email: user.email,
      fan_name: user.full_name,
      membership_tier_id: highestTier.id,
      tier_name: highestTier.tier_name,
      billing_cycle: 'monthly',
      amount: 0,
      status: 'active',
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    });

    return Response.json({
      success: true,
      message: 'Premium membership granted',
      subscription
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});