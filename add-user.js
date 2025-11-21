#!/usr/bin/env node

// Simple script to add a user to the database
// Usage: node add-user.js <username> <password>

const bcrypt = require('bcrypt');
const pool = require('./db');
require('dotenv').config();

async function addUser(username, password) {
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      console.error(`User "${username}" already exists`);
      process.exit(1);
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, passwordHash]
    );

    console.log(`User "${username}" added successfully with ID: ${result.rows[0].id}`);
    process.exit(0);
  } catch (error) {
    console.error('Error adding user:', error);
    process.exit(1);
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('Usage: node add-user.js <username> <password>');
  process.exit(1);
}

const [username, password] = args;
addUser(username, password);

