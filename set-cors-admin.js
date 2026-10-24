const { Storage } = require('@google-cloud/storage');
const path = require('path');

// 1. Path to your service account key
const serviceAccountPath = path.join(__dirname, 'seed', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

// 2. Initialize the Google Cloud Storage client
const storage = new Storage({
  projectId: serviceAccount.project_id,
  keyFilename: serviceAccountPath
});

const cors = [
  {
    origin: ['*'],
    method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    responseHeader: [
      'Content-Type',
      'x-firebase-storage-version',
      'x-goog-resumable',
      'Authorization',
      'Content-Length',
      'ETag',
      'x-goog-meta-*'
    ],
    maxAgeSeconds: 3600
  }
];

async function forceApply(name) {
  console.log(`\n--- Attempting Force Update: ${name} ---`);
  try {
    const bucket = storage.bucket(name);
    // Directly attempt to set CORS without checking if it exists
    await bucket.setCorsConfiguration(cors);
    console.log(`✓ SUCCESS: CORS forced on ${name}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed for ${name}:`, err.message);
    return false;
  }
}

async function run() {
  console.log(`Firebase Project: ${serviceAccount.project_id}`);

  // Try the specific bucket names from your browser error logs
  const success1 = await forceApply('mycomplaintstcr.firebasestorage.app');
  const success2 = await forceApply('mycomplaintstcr.appspot.com');

  if (success1 || success2) {
    console.log('\nFinal Status: Success! Please perform a Hard Refresh (Ctrl+F5) in your browser.');
  } else {
    console.error('\nFinal Status: All attempts failed.');
    console.log('\nIf this persists, please try the MANUAL method below:');
    console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/storage/browser');
    console.log('2. Find your bucket: mycomplaintstcr.firebasestorage.app');
    console.log('3. Open the "Cloud Shell" at the top right of the page.');
    console.log('4. Paste and run:');
    console.log('   echo "[{\\"origin\\": [\\"*\\"], \\"method\\": [\\"GET\\", \\"POST\\", \\"PUT\\", \\"DELETE\\", \\"HEAD\\", \\"OPTIONS\\"], \\"responseHeader\\": [\\"Content-Type\\", \\"x-firebase-storage-version\\", \\"x-goog-resumable\\", \\"Authorization\\", \\"Content-Length\\", \\"ETag\\", \\"x-goog-meta-*\\"], \\"maxAgeSeconds\\": 3600}]" > cors.json');
    console.log('   gsutil cors set cors.json gs://mycomplaintstcr.firebasestorage.app');
  }
  process.exit((success1 || success2) ? 0 : 1);
}

run();
