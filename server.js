const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'credential-database' });
});

// Verify credentials endpoint
// POST /verify
// Body: { username: string, password: string }
app.post('/verify', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }

    // Query database for user
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (isValid) {
      res.json({ 
        success: true, 
        user: { id: user.id, username: user.username } 
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
  } catch (error) {
    console.error('Error verifying credentials:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Check if user exists (useful for other services)
// GET /user/:username
app.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const result = await pool.query(
      'SELECT id, username, created_at FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        exists: false 
      });
    }

    res.json({ 
      exists: true, 
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Credential database API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

