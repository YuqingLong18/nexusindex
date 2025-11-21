# Credential Database

A simple PostgreSQL-based credential database service for authentication. Other websites can call this API to verify user credentials.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up PostgreSQL database:**
   - Create a PostgreSQL database (e.g., `credentials`)
   - Run the schema: `psql -d credentials -f schema.sql`
   - Or manually create the database and run the SQL in `schema.sql`

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your PostgreSQL credentials.

4. **Start the server:**
   ```bash
   npm start
   ```

## API Endpoints

### POST /verify
Verify user credentials.

**Request:**
```json
{
  "username": "user123",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "user123"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

### GET /user/:username
Check if a user exists.

**Response:**
```json
{
  "exists": true,
  "user": {
    "id": 1,
    "username": "user123",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /health
Health check endpoint.

## Managing Users

### Add a user:
```bash
node add-user.js <username> <password>
```

Example:
```bash
node add-user.js john mypassword123
```

## Usage from Other Websites

Example using fetch:
```javascript
const response = await fetch('http://your-api-url/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'user123',
    password: 'password123'
  })
});

const result = await response.json();
if (result.success) {
  // User authenticated
  console.log('Authenticated:', result.user);
} else {
  // Authentication failed
  console.error('Failed:', result.error);
}
```

## Security Notes

- Passwords are hashed using bcrypt before storage
- Never expose this API publicly without proper authentication/rate limiting
- Consider adding HTTPS in production
- Consider adding rate limiting to prevent brute force attacks

