import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { audioFileUrl, preset } = await req.json();
    const DOLBY_API_KEY = Deno.env.get('DOLBY_API_KEY');

    if (!DOLBY_API_KEY) {
      return Response.json({ error: 'Dolby API key not configured' }, { status: 500 });
    }

    // Step 1: Start mastering job
    const jobResponse = await fetch('https://api.dolby.com/media/master', {
      method: 'POST',
      headers: {
        'x-api-key': DOLBY_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        input: audioFileUrl,
        output: 'dlb://out/mastered.mp3',
        content: {
          type: 'music',
        },
        audio: {
          master: {
            dynamic_eq: {
              enabled: true,
            },
            leveler: {
              enabled: true,
              amount: preset === 'light' ? 50 : preset === 'medium' ? 75 : 100,
            },
          },
        },
      }),
    });

    if (!jobResponse.ok) {
      const error = await jobResponse.json();
      return Response.json({ 
        error: error.message || 'Failed to start mastering job' 
      }, { status: 400 });
    }

    const jobData = await jobResponse.json();
    const jobId = jobData.job_id;

    // Step 2: Poll for job completion (simplified - in production use webhooks)
    let status = 'pending';
    let attempts = 0;
    const maxAttempts = 30;

    while (status === 'pending' || status === 'running') {
      if (attempts >= maxAttempts) {
        return Response.json({ 
          error: 'Mastering job timed out',
          jobId: jobId 
        }, { status: 408 });
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(
        `https://api.dolby.com/media/master?job_id=${jobId}`,
        {
          headers: {
            'x-api-key': DOLBY_API_KEY,
            'Accept': 'application/json',
          },
        }
      );

      const statusData = await statusResponse.json();
      status = statusData.status;
      attempts++;

      if (status === 'success') {
        // Download the mastered file
        const downloadResponse = await fetch(statusData.output, {
          headers: {
            'x-api-key': DOLBY_API_KEY,
          },
        });

        const audioBlob = await downloadResponse.blob();
        
        // Upload to Base44 storage
        const formData = new FormData();
        formData.append('file', audioBlob, 'mastered.mp3');
        
        const uploadResult = await base44.integrations.Core.UploadFile({
          file: audioBlob,
        });

        return Response.json({
          success: true,
          masteredFileUrl: uploadResult.file_url,
          jobId: jobId,
        });
      }

      if (status === 'failed') {
        return Response.json({ 
          error: 'Mastering job failed',
          details: statusData.error 
        }, { status: 500 });
      }
    }

    return Response.json({ error: 'Unexpected job status' }, { status: 500 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});