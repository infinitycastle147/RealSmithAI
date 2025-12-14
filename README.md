# ReelSmith AI

**ReelSmith AI** is a professional-grade video generation tool that turns simple text prompts into viral-ready YouTube Shorts in seconds. It leverages the power of Google's Gemini models to handle the entire production pipeline: scripting, visual direction, image generation, voiceover synthesis, and video rendering.

## Features

- **End-to-End Automation**: From idea to MP4 file in one workflow.
- **AI Scripting**: Generates punchy, paced scripts optimized for short-form content.
- **Multi-Modal Generation**:
  - **Visuals**: Uses `gemini-2.5-flash-image` to create consistent, styled slides.
  - **Audio**: Uses `gemini-2.5-flash-preview-tts` for high-quality, synchronized narration.
- **Real-Time Rendering**: Stitches images and audio directly in the browser using the Canvas and MediaRecorder APIs.
- **Style Presets**: Choose from professionally curated styles like Chalkboard, Anime, or Cyberpunk.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI Models**: Google Gemini API (`gemini-2.5-flash`, `gemini-2.5-flash-image`, `gemini-2.5-flash-preview-tts`)
- **Video Processing**: Native Web APIs (Canvas, Web Audio, MediaRecorder)

## Usage

1. **Concept**: Enter a topic (e.g., "The History of Espresso").
2. **Script**: Review and edit the AI-generated storyboard.
3. **Style**: Select a visual aesthetic.
4. **Generate**: Watch as ReelSmith AI paints your slides, records voiceovers, and assembles the final video.
5. **Download**: Get a ready-to-upload `.webm` file.
