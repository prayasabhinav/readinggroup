# Reading Group Topic Voting System

A simple web application for proposing and voting on topics for a university reading group.

## Features

- Propose new reading topics
- Upvote existing topics
- Topics are automatically sorted by vote count
- Google authentication for secure access
- Admin panel for topic selection and management
- PDF upload for reading materials
- User statistics tracking

## Local Development

1. Install dependencies: `npm install`
2. Create a `.env` file with your configuration (see `.env.example`)
3. Start the development server: `npm run dev`
4. Open `http://localhost:3000` in your browser

## Deployment with CapRover

This application is ready to be deployed with CapRover. Follow these steps:

1. Make sure you have CapRover CLI installed:
   ```
   npm install -g caprover
   ```

2. Update the `.env` file with your production settings:
   - Set `NODE_ENV=production`
   - Update `BASE_URL` to your deployed app URL
   - Update `CORS_ORIGIN` to match your app URL
   - Set `MONGODB_URI` to your MongoDB connection string
   - Generate a strong `SESSION_SECRET`
   - Update Google OAuth credentials as needed

3. Deploy your app:
   ```
   caprover deploy
   ```

4. Follow the interactive prompts to deploy to your CapRover server

### Database Setup

The application requires MongoDB. You can either:
- Use MongoDB Atlas for a cloud-hosted database
- Deploy MongoDB on your server using CapRover one-click apps

## Implementation Details

- Node.js and Express backend
- MongoDB for data storage
- Passport.js with Google OAuth for authentication
- PDF file upload capabilities
- Admin panel for topic management 