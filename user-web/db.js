const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
});

async function initDatabase() {
  try {
    // Attempt to connect to the database
    const client = await pool.connect();
    console.log("Database connection established successfully.");
    
    // Read the schema file
    const schemaPath = path.join(__dirname, "../db/schema.sql");
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, "utf-8");
      // Execute the schema
      await client.query(schemaSql);
      console.log("Database schema execution successful.");
    } else {
      console.warn("Schema file not found at:", schemaPath);
    }
    
    client.release();
  } catch (error) {
    console.error("Database initialization failed:", error);
    // Exit the process if the database is not available
    process.exit(1);
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDatabase,
};
