# ReelZero

**ReelZero** is a professional-grade video generation tool that turns simple text prompts into viral-ready YouTube Shorts in seconds. It leverages the power of Google's Gemini models to handle the entire production pipeline: scripting, visual direction, image generation, voiceover synthesis, and video rendering.

## Project Structure

This project is split into two separate applications:

- **`frontend/`** - React frontend application (Vite + TypeScript)
- **`backend/`** - Express.js backend API (TypeScript)

Both applications are completely independent and can be deployed separately.

## Features

- **End-to-End Automation**: From idea to MP4 file in one workflow.
- **AI Scripting**: Generates punchy, paced scripts optimized for short-form content.
- **Multi-Modal Generation**:
  - **Visuals**: Uses `gemini-2.5-flash-image` to create consistent, styled slides.
  - **Audio**: Uses `gemini-2.5-flash-preview-tts` for high-quality, synchronized narration.
- **Real-Time Rendering**: Stitches images and audio directly in the browser using the Canvas and MediaRecorder APIs.
- **Style Presets**: Choose from professionally curated styles like Chalkboard, Anime, or Cyberpunk.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Express.js, TypeScript, Node.js
- **AI Models**: Google Gemini API (`gemini-2.5-flash`, `gemini-2.5-flash-image`, `gemini-2.5-flash-preview-tts`)
- **Video Processing**: Native Web APIs (Canvas, Web Audio, MediaRecorder)
- **Authentication**: Clerk
- **Database**: Supabase

## Getting Started

### Prerequisites

- Node.js >= 22.0.0
- npm or yarn

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000`

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env  # Create .env file with your configuration
npm run dev
```

The backend will run on `http://localhost:3001`

### Environment Variables

#### Frontend (.env in `frontend/` directory)
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `VITE_API_URL` - Backend API URL (optional, uses proxy in dev)

#### Backend (.env in `backend/` directory)
- `CLERK_SECRET_KEY` - Clerk secret key
- `CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `GEMINI_API_KEY` - Google Gemini API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `PORT` - Backend server port (default: 3001)
- `FRONTEND_URL` - Frontend URL for CORS (production)

## Usage

1. **Concept**: Enter a topic (e.g., "The History of Espresso").
2. **Script**: Review and edit the AI-generated storyboard.
3. **Style**: Select a visual aesthetic.
4. **Generate**: Watch as ReelZero paints your slides, records voiceovers, and assembles the final video.
5. **Download**: Get a ready-to-upload `.webm` or `.mp4` file.

## Deployment

### Frontend Deployment (Vercel)

The frontend can be deployed to Vercel. The `vercel.json` configuration is already set up in the `frontend/` directory.

### Backend Deployment

The backend can be deployed to any Node.js hosting service (Railway, Render, AWS, etc.). Make sure to set all required environment variables.

## Documentation

- `CLERK_AUTH_TROUBLESHOOTING.md` - Clerk authentication setup and troubleshooting
- `EXPRESS_DEPLOYMENT.md` - Backend deployment guide
- `QUOTA_SETUP.md` - Quota system setup
- `SUPABASE_SETUP.md` - Supabase database setup
