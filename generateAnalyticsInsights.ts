import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { distributions, timeframe = '30' } = body;

    if (!distributions || distributions.length === 0) {
      return Response.json({ 
        predictiveEarnings: { currentMonth: 0, nextMonth: 0, growth: 0 },
        audienceInsights: { topAgeGroup: '25-34', growthAgeGroup: '18-24', retention: 0 },
        trendingPlatforms: [],
        recommendations: []
      });
    }

    // Generate AI insights using LLM
    const prompt = `Analyze these music distribution metrics and provide insights:

    Distributions: ${JSON.stringify(distributions.map(d => ({
      title: d.release_title,
      genre: d.genre,
      streams: d.total_streams,
      earnings: d.estimated_earnings,
      platforms: d.platforms_live,
      createdDate: d.created_date
    })))}

    Provide JSON response with:
    1. predictiveEarnings: {currentMonth, nextMonth, growth%}
    2. audienceInsights: {topAgeGroup, growthAgeGroup, retention%, preferredGenres[], topRegions[]}
    3. trendingPlatforms: [{name, growth%, potential}]
    4. recommendations: [3-5 actionable strategies for growth]`;

    const insights = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          predictiveEarnings: {
            type: 'object',
            properties: {
              currentMonth: { type: 'number' },
              nextMonth: { type: 'number' },
              growth: { type: 'number' }
            }
          },
          audienceInsights: {
            type: 'object',
            properties: {
              topAgeGroup: { type: 'string' },
              growthAgeGroup: { type: 'string' },
              retention: { type: 'number' },
              preferredGenres: { type: 'array', items: { type: 'string' } },
              topRegions: { type: 'array', items: { type: 'string' } }
            }
          },
          trendingPlatforms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                growth: { type: 'number' },
                potential: { type: 'string' }
              }
            }
          },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    return Response.json(insights);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});