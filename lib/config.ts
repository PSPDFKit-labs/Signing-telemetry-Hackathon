import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const config = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3BucketName: process.env.AWS_S3_BUCKET_NAME,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
};

export default config;
