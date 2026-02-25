import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { distribution_id } = body;

    // Get distribution details
    const distribution = await base44.entities.Distribution.read(distribution_id);
    if (!distribution || distribution.created_by !== user.email) {
      return Response.json({ error: 'Distribution not found' }, { status: 404 });
    }

    // Generate comprehensive metadata using LLM
    const metadataPrompt = `Analyze this music release and generate comprehensive metadata:

Title: ${distribution.release_title}
Artist: ${distribution.artist_name}
Genre: ${distribution.genre}
Release Date: ${distribution.release_date}
${distribution.lyrics ? `Lyrics Preview: ${distribution.lyrics.substring(0, 500)}...` : ''}
${distribution.description ? `Description: ${distribution.description}` : ''}

Generate a JSON response with:

1. "genre_tags": Array of objects with {tag: string (specific sub-genres), confidence: 0-100, primary: boolean}. Include 3-5 tags.

2. "keywords": Array of 8-12 relevant keywords with {keyword: string, relevance: 0-100, category: "production"/"lyrical"/"vibe"/"cultural"/"trend"}
   - Include production elements (beats, production style, instrumentation)
   - Lyrical themes (topics, storytelling elements)
   - Vibe/mood keywords
   - Cultural/trend references
   - Current trend alignment

3. "mood_descriptors": Array of 5-8 mood descriptors (e.g., "energetic", "introspective", "hypnotic", "aggressive", "uplifting")

4. "potential_playlists": Array of 5-8 playlist types with {playlist_type: string, reason: string, fit_score: 0-100}
   - Include DSP playlists (Spotify playlists)
   - Mood playlists
   - Trend playlists
   - Genre-specific playlists
   - Discovery playlists

5. "market_analysis": Object with:
   - trend_alignment: Description of alignment with current music trends
   - comparable_artists: Array of 3-5 similar artists
   - target_audience: Demographic description
   - release_timing_notes: Notes on optimal timing

6. "seo_metadata": Object with:
   - meta_title: SEO-optimized title
   - meta_description: Description for search engines
   - hashtags: Array of 10-15 relevant hashtags

Return only valid JSON with these 6 top-level keys.`;

    const metadata = await base44.integrations.Core.InvokeLLM({
      prompt: metadataPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          genre_tags: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tag: { type: "string" },
                confidence: { type: "number" },
                primary: { type: "boolean" }
              }
            }
          },
          keywords: {
            type: "array",
            items: {
              type: "object",
              properties: {
                keyword: { type: "string" },
                relevance: { type: "number" },
                category: { type: "string" }
              }
            }
          },
          mood_descriptors: {
            type: "array",
            items: { type: "string" }
          },
          potential_playlists: {
            type: "array",
            items: {
              type: "object",
              properties: {
                playlist_type: { type: "string" },
                reason: { type: "string" },
                fit_score: { type: "number" }
              }
            }
          },
          market_analysis: {
            type: "object",
            properties: {
              trend_alignment: { type: "string" },
              comparable_artists: { type: "array", items: { type: "string" } },
              target_audience: { type: "string" },
              release_timing_notes: { type: "string" }
            }
          },
          seo_metadata: {
            type: "object",
            properties: {
              meta_title: { type: "string" },
              meta_description: { type: "string" },
              hashtags: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    });

    // Create metadata record
    const releaseMetadata = await base44.entities.ReleaseMetadata.create({
      distribution_id,
      artist_name: distribution.artist_name,
      release_title: distribution.release_title,
      genre_tags: metadata.genre_tags,
      keywords: metadata.keywords,
      mood_descriptors: metadata.mood_descriptors,
      potential_playlists: metadata.potential_playlists,
      market_analysis: metadata.market_analysis,
      seo_metadata: metadata.seo_metadata,
      analysis_date: new Date().toISOString(),
      status: "generated"
    });

    return Response.json({
      success: true,
      metadata_id: releaseMetadata.id,
      genre_tags: releaseMetadata.genre_tags,
      keywords_count: releaseMetadata.keywords.length,
      playlists_count: releaseMetadata.potential_playlists.length
    });

  } catch (error) {
    console.error('Error in generateReleaseMetadata:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});