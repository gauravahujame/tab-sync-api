import { db } from "./src/db";

console.log("Testing database connection...");

db.serialize(() => {
  db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='tabs'",
    (err, row) => {
      if (err) {
        console.error("Error querying database:", err);
        process.exit(1);
      }

      if (row) {
        console.log("Database connection successful! Found tables table.");
      } else {
        console.log("Database connection successful, but no tables found.");
      }

      db.close();
    },
  );
});
