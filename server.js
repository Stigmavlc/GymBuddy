import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Set port from environment or default to 5000
const PORT = process.env.PORT || 5000;

// Add security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static files from dist directory with caching
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1d',
  etag: false
}));

// Handle React Router - send all requests to index.html
// Use a more specific pattern to avoid conflicts
app.get('*', (req, res) => {
  // Don't serve index.html for API calls or asset requests
  if (req.path.startsWith('/api') || req.path.includes('.')) {
    return res.status(404).send('Not Found');
  }
  
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Server Error');
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`GymBuddy server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Serving from: ${path.join(__dirname, 'dist')}`);
});