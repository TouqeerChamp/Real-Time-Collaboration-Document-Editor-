# Real-Time Collaboration Document Editor

A Google Docs Clone with real-time synchronization, user presence tracking, and role-based permissions.

## Features

- **Real-time Sync**: Multiple users can collaborate on a document simultaneously with instant updates
- **User Presence**: See who's currently editing the document with T/M avatars showing active users
- **Role-based Permissions**: Control document access and editing capabilities based on user roles
- **Rich Text Editing**: Powered by Quill.js for a Google Docs-like editing experience
- **Firebase Integration**: Real-time database for seamless collaboration and authentication
- **Access Guard**: Secure document access with permission controls

## Technologies Used

- React + TypeScript
- Quill.js for rich text editing
- Firebase Firestore for real-time synchronization
- Firebase Authentication for user management
- Vite for fast development

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up your Firebase project and add your config to `.env`
4. Run the application with `npm run dev`

## Usage

1. Sign in to access documents
2. Create or open existing documents
3. Invite collaborators with specific permissions
4. Collaborate in real-time with other users
5. See other users' cursors and selections through the presence indicators

## Architecture

The application follows a modern React architecture with:
- Context API for state management
- Firebase for real-time synchronization
- Quill.js for rich text editing capabilities
- Component-based design for maintainability
