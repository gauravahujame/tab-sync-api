import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Get JWT secret from environment variables or use default for development
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';

// Generate a test token that expires in 1 year for testing
const generateTestToken = () => {
  if (!JWT_SECRET || JWT_SECRET === 'change-this-in-production') {
    console.warn('⚠️  Warning: Using default JWT secret. For production, set a strong JWT_SECRET in your .env file.');
  }

  const payload = {
    userId: 'test-user-123',
    // Add any other user-related claims you might need
    email: 'test@example.com',
    name: 'Test User'
  };

  const token = jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '365d' // 1 year expiration for testing
  });

  console.log('\n🔑 Generated JWT Token:');
  console.log('='.repeat(50));
  console.log(token);
  console.log('='.repeat(50));
  
  console.log('\n🔧 Use this token in your frontend:');
  console.log('='.repeat(50));
  console.log(`Authorization: Bearer ${token}`);
  console.log('='.repeat(50));
  
  console.log('\n📝 Token Details:');
  console.log('='.repeat(50));
  console.log(`Issued To: ${payload.userId}`);
  console.log(`Email: ${payload.email}`);
  console.log(`Name: ${payload.name}`);
  console.log(`Expires In: 365 days`);
  console.log('='.repeat(50));
};

generateTestToken();
