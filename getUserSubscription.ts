import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's active subscription
    const subscriptions = await base44.entities.MembershipSubscription.filter(
      { fan_email: user.email, status: 'active' },
      '-created_date',
      1
    );

    if (subscriptions.length === 0) {
      return Response.json({
        success: true,
        subscription: null,
        message: 'No active subscription'
      });
    }

    return Response.json({
      success: true,
      subscription: subscriptions[0]
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});