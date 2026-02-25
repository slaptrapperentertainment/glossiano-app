import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { videoFile, title, description, tags } = await req.json();
    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');

    if (!YOUTUBE_API_KEY) {
      return Response.json({ error: 'YouTube API key not configured' }, { status: 500 });
    }

    // Note: YouTube Data API v3 requires OAuth 2.0 for uploads
    // This implementation requires YouTube OAuth setup via app connectors
    const response = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YOUTUBE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
            tags: tags || [],
            categoryId: '10', // Music category
          },
          status: {
            privacyStatus: 'public',
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json({ error: data.error?.message || 'YouTube upload failed' }, { status: 400 });
    }

    return Response.json({ 
      success: true, 
      videoId: data.id,
      videoUrl: `https://www.youtube.com/watch?v=${data.id}`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});