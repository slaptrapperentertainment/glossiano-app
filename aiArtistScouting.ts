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

    // Analyze commercial appeal
    const commercialAppealPrompt = `Analyze this song's commercial appeal:

Title: ${distribution.release_title}
Artist: ${distribution.artist_name}
Genre: ${distribution.genre}
${distribution.lyrics ? `Lyrics Preview: ${distribution.lyrics.substring(0, 500)}...` : ''}

Provide:
1. Song Structure: Identify the structure (verse-chorus pattern), rate how well it follows proven hit formulas (0-100)
2. Melody Analysis: Assess memorability/catchiness (0-100) and uniqueness (0-100)
3. Lyrical Content: Rate relatability (0-100) and identify commercial themes (love, empowerment, party, heartbreak, etc.)
4. Overall Commercial Appeal Score (0-100)

Be specific about what makes it commercially viable or what could be improved.`;

    const commercialResponse = await base44.integrations.Core.InvokeLLM({
      prompt: commercialAppealPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          overall_score: { type: "number" },
          structure_type: { type: "string" },
          structure_score: { type: "number" },
          structure_analysis: { type: "string" },
          memorability_score: { type: "number" },
          uniqueness_score: { type: "number" },
          melody_analysis: { type: "string" },
          relatability_score: { type: "number" },
          commercial_themes: { type: "array", items: { type: "string" } },
          lyrical_analysis: { type: "string" }
        }
      }
    });

    // Analyze hit potential
    const hitPotentialPrompt = `Predict hit potential for this release:

Title: ${distribution.release_title}
Artist: ${distribution.artist_name}
Genre: ${distribution.genre}
Release Date: ${distribution.release_date}

Provide:
1. Hit Potential Score (0-100): Based on structure, production quality, market trends
2. Comparable Successful Tracks: Name 3-4 similar tracks that became hits, with their chart performance
3. Peak Chart Prediction: Conservative estimate of chart potential (e.g., "Top 10 on Genre Charts", "Potential Viral Hit")
4. Market Timing: Current market conditions for this genre - is this the right time?
5. Detailed Analysis: What factors increase hit potential? What are risks?

Focus on data-driven predictions based on current music industry trends.`;

    const hitResponse = await base44.integrations.Core.InvokeLLM({
      prompt: hitPotentialPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          hit_score: { type: "number" },
          comparable_tracks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                track_name: { type: "string" },
                artist: { type: "string" },
                similarity_percentage: { type: "number" },
                chart_performance: { type: "string" }
              }
            }
          },
          chart_prediction: { type: "string" },
          market_timing: { type: "string" },
          analysis: { type: "string" }
        }
      }
    });

    // Analyze artist potential
    const artistPotentialPrompt = `Assess this emerging artist's growth potential:

Artist: ${distribution.artist_name}
Genre: ${distribution.genre}
Release: ${distribution.release_title}

Evaluate:
1. Career Stage: Is this an artist at breakthrough stage, developing, or more established?
2. Growth Indicators: Identify 3-5 positive signals suggesting they could become successful
   - Sound originality and distinctiveness
   - Production quality and professionalism
   - Genre market demand
   - Viral/trending potential
   - Artist brand personality
3. Risk Factors: What could prevent mainstream success?
4. Recommendations: 3-5 strategic actions to accelerate growth
5. Emerging Artist Score (0-100): Overall potential for breakthrough success

Provide actionable insights for artist development and label investment decisions.`;

    const artistResponse = await base44.integrations.Core.InvokeLLM({
      prompt: artistPotentialPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          career_stage: { type: "string" },
          growth_indicators: { type: "array", items: { type: "string" } },
          risk_factors: { type: "array", items: { type: "string" } },
          recommendations: { type: "array", items: { type: "string" } },
          emerging_artist_score: { type: "number" }
        }
      }
    });

    // Determine investment recommendation
    const avgScore = (commercialResponse.overall_score + hitResponse.hit_score + artistResponse.emerging_artist_score) / 3;
    let investmentRec = 'hold';
    if (avgScore >= 80) {
      investmentRec = 'strong_buy';
    } else if (avgScore >= 65) {
      investmentRec = 'buy';
    } else if (avgScore >= 40) {
      investmentRec = 'hold';
    } else {
      investmentRec = 'sell';
    }

    // Generate executive summary
    const summaryPrompt = `Write a brief executive A&R summary (5-7 sentences) for:

Artist: ${distribution.artist_name}
Release: ${distribution.release_title}
Genre: ${distribution.genre}

Key Findings:
- Commercial Appeal Score: ${commercialResponse.overall_score}
- Hit Potential: ${hitResponse.hit_score}
- Artist Growth Potential: ${artistResponse.emerging_artist_score}
- Investment Recommendation: ${investmentRec.toUpperCase()}

Create a compelling summary that would be presented to a label executive or A&R director.`;

    const summaryResponse = await base44.integrations.Core.InvokeLLM({
      prompt: summaryPrompt
    });

    // Create A&R scout record
    const scout = await base44.entities.ARArtistScout.create({
      distribution_id,
      artist_name: distribution.artist_name,
      release_title: distribution.release_title,
      genre: distribution.genre,
      analysis_date: new Date().toISOString(),
      commercial_appeal: {
        score: commercialResponse.overall_score,
        song_structure: {
          structure_type: commercialResponse.structure_type,
          structure_score: commercialResponse.structure_score,
          analysis: commercialResponse.structure_analysis
        },
        melody_analysis: {
          memorability_score: commercialResponse.memorability_score,
          uniqueness_score: commercialResponse.uniqueness_score,
          analysis: commercialResponse.melody_analysis
        },
        lyrical_content: {
          relatability_score: commercialResponse.relatability_score,
          commercial_themes: commercialResponse.commercial_themes,
          analysis: commercialResponse.lyrical_analysis
        }
      },
      hit_potential: {
        hit_score: hitResponse.hit_score,
        comparable_tracks: hitResponse.comparable_tracks,
        peak_chart_prediction: hitResponse.chart_prediction,
        market_timing: hitResponse.market_timing,
        analysis: hitResponse.analysis
      },
      artist_potential: {
        emerging_artist_score: artistResponse.emerging_artist_score,
        career_stage: artistResponse.career_stage,
        growth_indicators: artistResponse.growth_indicators,
        risk_factors: artistResponse.risk_factors,
        recommendations: artistResponse.recommendations
      },
      investment_recommendation: investmentRec,
      detailed_report: summaryResponse
    });

    return Response.json({
      success: true,
      scout_id: scout.id,
      commercial_appeal_score: scout.commercial_appeal.score,
      hit_potential_score: scout.hit_potential.hit_score,
      artist_potential_score: scout.artist_potential.emerging_artist_score,
      investment_recommendation: scout.investment_recommendation
    });

  } catch (error) {
    console.error('Error in aiArtistScouting:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});