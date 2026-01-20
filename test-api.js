import axios from 'axios';

const API_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('Testing async video generation API...\n');

  try {
    // Step 1: Create video job
    console.log('1. Creating video job...');
    const startTime = Date.now();

    const createResponse = await axios.post(`${API_URL}/api/videos`, {
      script: 'This is a test video to verify async processing works correctly.',
      useDefaultMusic: 'true',
      quality: 'fast'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;
    console.log(`✓ Job created in ${responseTime}ms (should be < 1000ms)`);
    console.log(`  JobId: ${createResponse.data.jobId}`);
    console.log(`  Status URL: ${createResponse.data.statusUrl}\n`);

    if (responseTime > 2000) {
      console.log('⚠️  WARNING: Response took more than 2 seconds. API may not be async!\n');
    }

    const jobId = createResponse.data.jobId;

    // Step 2: Poll for status
    console.log('2. Polling job status...');
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    while (attempts < maxAttempts) {
      attempts++;

      const statusResponse = await axios.get(`${API_URL}/api/videos/${jobId}`);
      const status = statusResponse.data;

      console.log(`  [${attempts}] Status: ${status.status} | Progress: ${status.progress}% | ${status.message}`);

      if (status.status === 'completed') {
        console.log('\n✓ Video generation completed!');
        console.log('  Result:', JSON.stringify(status.result, null, 2));
        break;
      }

      if (status.status === 'failed') {
        console.log('\n✗ Video generation failed!');
        console.log('  Error:', status.error);
        break;
      }

      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    if (attempts >= maxAttempts) {
      console.log('\n✗ Timeout: Job did not complete in time');
    }

  } catch (error) {
    console.error('\n✗ Error:', error.response?.data || error.message);
  }
}

// Run test
testAPI();
