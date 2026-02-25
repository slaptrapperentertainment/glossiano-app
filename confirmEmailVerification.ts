import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json();

    if (!token) {
      return Response.json({ 
        error: 'Verification token is required' 
      }, { status: 400 });
    }

    // Find fan with this token
    const fans = await base44.asServiceRole.entities.Fan.filter({ 
      verification_token: token 
    });

    if (fans.length === 0) {
      return Response.json({ 
        error: 'Invalid or expired verification link' 
      }, { status: 404 });
    }

    const fan = fans[0];

    if (fan.email_verified) {
      return Response.json({ 
        success: true,
        message: 'Email already verified!',
        alreadyVerified: true
      });
    }

    // Update fan to verified and subscribed
    await base44.asServiceRole.entities.Fan.update(fan.id, {
      email_verified: true,
      subscribed: true,
      verification_token: null // Clear token after use
    });

    // Send welcome email
    await base44.integrations.Core.SendEmail({
      to: fan.email,
      subject: 'Welcome to the Family! 🔥',
      from_name: 'Slap Trapper Entertainment',
      body: `
What's good ${fan.name}!

Your email is verified! You're now part of the official Slap Trapper Entertainment crew 🎵

You'll be the first to know about:
• New music drops & releases
• Exclusive content & freestyles
• Live shows & events
• Behind-the-scenes studio sessions

Follow us on the gram: @slaptrapper

Stay locked in,
Slap Trapper Entertainment

P.S. Reply to this email anytime - we read every message!
      `
    });

    return Response.json({ 
      success: true,
      message: 'Email verified successfully! Welcome to the family 🔥'
    });

  } catch (error) {
    console.error('Confirmation error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});