import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { imageUrl, caption } = await req.json();
    const INSTAGRAM_ACCESS_TOKEN = Deno.env.get('INSTAGRAM_ACCESS_TOKEN');

    if (!INSTAGRAM_ACCESS_TOKEN) {
      return Response.json({ error: 'Instagram access token not configured' }, { status: 500 });
    }

    // Step 1: Create media container
    const createResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption,
          access_token: INSTAGRAM_ACCESS_TOKEN,
        }),
      }
    );

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      return Response.json({ 
        error: createData.error?.message || 'Failed to create Instagram media' 
      }, { status: 400 });
    }

    // Step 2: Publish the media
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: INSTAGRAM_ACCESS_TOKEN,
        }),
      }
    );

    const publishData = await publishResponse.json();

    if (!publishResponse.ok) {
      return Response.json({ 
        error: publishData.error?.message || 'Failed to publish Instagram post' 
      }, { status: 400 });
    }

    return Response.json({ 
      success: true, 
      postId: publishData.id,
      message: 'Successfully posted to Instagram'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});