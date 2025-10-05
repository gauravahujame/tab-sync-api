import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Get JWT secret from environment variables or use default for development
const JWT_SECRET =
  process.env.JWT_SECRET || "default-secret-key-change-in-production";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(
    "Usage: npm run generate-token -- <browser-name> [user-id] [email] [name]",
  );
  console.error(
    "Example: npm run generate-token -- chrome '123' user@example.com 'User Name'",
  );
  process.exit(1);
}

const [browserName, userIdArg, emailArg, nameArg] = args;

if (!browserName || !browserName.trim()) {
  console.error("Browser name is required to generate a token.");
  process.exit(1);
}

const userId = userIdArg?.trim() || "test-user-123";
const email = emailArg?.trim() || "test@example.com";
const name = nameArg?.trim() || "Test User";

// Generate a test token that expires in 1 year for testing
const generateTestToken = () => {
  if (!JWT_SECRET || JWT_SECRET === "change-this-in-production") {
    console.warn(
      "⚠️  Warning: Using default JWT secret. For production, set a strong JWT_SECRET in your .env file.",
    );
  }

  const payload = {
    id: userId,
    userId,
    // Add any other user-related claims you might need
    email,
    name,
    browserName,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "365d", // 1 year expiration for testing
  });

  console.log("\n🔑 Generated JWT Token:");
  console.log("=".repeat(50));
  console.log(token);
  console.log("=".repeat(50));

  console.log("\n🔧 Use this token in your frontend:");
  console.log("=".repeat(50));
  console.log(`Authorization: Bearer ${token}`);
  console.log("=".repeat(50));

  console.log("\n📝 Token Details:");
  console.log("=".repeat(50));
  console.log(`Issued To: ${payload.id}`);
  console.log(`Email: ${payload.email}`);
  console.log(`Name: ${payload.name}`);
  console.log(`Browser: ${payload.browserName}`);
  console.log(`Expires In: 365 days`);
  console.log("=".repeat(50));
};

generateTestToken();
