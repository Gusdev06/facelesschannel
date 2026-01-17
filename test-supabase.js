import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSupabaseConnection() {
  console.log('\n🧪 Testing Supabase Connection\n');
  console.log('=' .repeat(60));

  // Check environment variables
  console.log('\n📋 Environment Variables:');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ SET' : '❌ MISSING'}`);
  console.log(`   SUPABASE_ANON_KEY: ${supabaseKey ? '✅ SET' : '❌ MISSING'}`);

  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ Missing required environment variables!');
    process.exit(1);
  }

  console.log(`\n   URL: ${supabaseUrl}`);
  console.log(`   Key: ${supabaseKey.substring(0, 20)}...`);

  // Initialize client
  console.log('\n🔌 Initializing Supabase client...');
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Client initialized');

  // Test bucket access
  console.log('\n🪣 Testing bucket access...');
  const buckets = ['music', 'images', 'videos', 'thumbnails'];

  for (const bucketName of buckets) {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1 });

      if (error) {
        console.log(`   ❌ ${bucketName}: ${error.message}`);
      } else {
        console.log(`   ✅ ${bucketName}: Accessible (${data.length} items in root)`);
      }
    } catch (err) {
      console.log(`   ❌ ${bucketName}: ${err.message}`);
    }
  }

  // Test upload with a small dummy file
  console.log('\n📤 Testing file upload...');
  const testContent = Buffer.from('Test upload from faceless channel app');
  const testFileName = `test-${Date.now()}.txt`;

  try {
    const { data, error } = await supabase.storage
      .from('images')
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        upsert: false
      });

    if (error) {
      console.error('   ❌ Upload failed:', error.message);
      console.error('   Error details:', error);
    } else {
      console.log('   ✅ Upload successful!');
      console.log(`   Path: ${data.path}`);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(data.path);

      console.log(`   URL: ${urlData.publicUrl}`);

      // Cleanup - delete test file
      const { error: deleteError } = await supabase.storage
        .from('images')
        .remove([data.path]);

      if (deleteError) {
        console.log(`   ⚠️  Could not delete test file: ${deleteError.message}`);
      } else {
        console.log('   🗑️  Test file deleted');
      }
    }
  } catch (err) {
    console.error('   ❌ Upload error:', err.message);
    console.error('   Stack:', err.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete!\n');
}

testSupabaseConnection().catch(console.error);
