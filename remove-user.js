#!/usr/bin/env node

// Simple script to remove a user from the database
// Usage: node remove-user.js <username>

const pool = require('./db');
require('dotenv').config();

async function removeUser(username) {
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE username = $1 RETURNING id, username',
      [username]
    );

    if (result.rowCount === 0) {
      console.error(`User "${username}" not found`);
      process.exit(1);
    }

    const removedUser = result.rows[0];
    console.log(
      `User "${removedUser.username}" removed successfully (ID: ${removedUser.id})`
    );
    process.exit(0);
  } catch (error) {
    console.error('Error removing user:', error);
    process.exit(1);
  }
}

const args = process.argv.slice(2);

if (args.length !== 1) {
  console.error('Usage: node remove-user.js <username>');
  process.exit(1);
}

const [username] = args;
removeUser(username);
