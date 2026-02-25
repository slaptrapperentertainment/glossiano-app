import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { membership_tier_id, billing_cycle } = await req.json();

    if (!membership_tier_id || !billing_cycle) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get membership tier details
    const membershipTier = await base44.asServiceRole.entities.Membership.get(membership_tier_id);

    if (!membershipTier) {
      return Response.json(
        { error: 'Membership tier not found' },
        { status: 404 }
      );
    }

    // Determine amount based on billing cycle
    const amount = billing_cycle === 'yearly' 
      ? membershipTier.price_yearly || membershipTier.price_monthly * 12
      : membershipTier.price_monthly;

    // Calculate renewal date
    const now = new Date();
    const renewalDate = new Date();
    if (billing_cycle === 'monthly') {
      renewalDate.setMonth(renewalDate.getMonth() + 1);
    } else {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    // Create subscription record
    const subscription = await base44.entities.MembershipSubscription.create({
      fan_email: user.email,
      fan_name: user.full_name || 'Fan',
      membership_tier_id: membership_tier_id,
      tier_name: membershipTier.tier_name,
      billing_cycle: billing_cycle,
      amount: amount,
      status: 'active',
      current_period_end: renewalDate.toISOString(),
      renewal_date: renewalDate.toISOString()
    });

    // Send confirmation email
    try {
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `Welcome to ${membershipTier.tier_name} - Slap Trapper Entertainment`,
        body: `
Welcome, ${user.full_name}!

You've successfully subscribed to the ${membershipTier.tier_name} membership tier.

Subscription Details:
- Tier: ${membershipTier.tier_name}
- Billing Cycle: ${billing_cycle === 'monthly' ? 'Monthly ($' + membershipTier.price_monthly : 'Yearly ($' + (membershipTier.price_yearly || membershipTier.price_monthly * 12)}.00)
- Renewal Date: ${renewalDate.toLocaleDateString()}

Benefits Unlocked:
${membershipTier.features.map(f => `• ${f}`).join('\n')}

${membershipTier.early_access_days ? `\n🎵 Get ${membershipTier.early_access_days} days early access to new releases!` : ''}
${membershipTier.exclusive_content ? '\n🎬 Access exclusive behind-the-scenes content' : ''}
${membershipTier.merch_discount ? `\n🛍️ ${membershipTier.merch_discount}% discount on merch` : ''}
${membershipTier.discord_access ? '\n💬 Join our exclusive Discord community' : ''}
${membershipTier.meet_and_greet ? '\n👋 Access to virtual meet and greets' : ''}

Thank you for supporting Slap Trapper Entertainment!

Best regards,
Slap Trapper Team
        `
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
    }

    return Response.json({
      success: true,
      subscription: subscription,
      message: 'Successfully subscribed to membership tier'
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});