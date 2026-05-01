require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate() {
    try {
        console.log("Running migration...");
        const sql = fs.readFileSync(path.join(__dirname, '../db/migration.sql'), 'utf-8');
        await db.query(sql);
        console.log("Migration successful");
        process.exit(0);
    } catch (e) {
        console.error("Migration failed", e);
        process.exit(1);
    }
}
migrate();
