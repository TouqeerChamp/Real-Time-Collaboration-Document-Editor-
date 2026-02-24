# Project Specifications

## 1. Functional Requirements

### Day 1: Project Init & Authentication
- Set up React + Vite + TypeScript project with Tailwind CSS
- Implement Firebase Authentication with Email/Google Auth
- Create user dashboard to list documents
- Implement document creation functionality
- Implement document deletion functionality
- Create Firestore collection for documents with ownership tracking
- Implement basic security rules for user-owned documents

### Day 2: Real-time Editor
- Integrate TipTap editor with collaboration support
- Implement real-time document synchronization via Firestore
- Add debounced write functionality to prevent excessive updates
- Show list of active users/presence indicators
- Implement basic rich text editing capabilities
- Add title editing functionality

### Day 3: Collaboration & Sharing
- Create share modal for document collaboration
- Implement invite-by-email functionality
- Support viewer/editor roles with appropriate permissions
- Update Firestore security rules to support collaboration
- Display collaborator presence in real-time
- Implement role-based access controls

### Day 4: History & Polish
- Implement version history with snapshots
- Add autosave functionality with visual indicators
- Polish UI/UX with Tailwind styling
- Implement comprehensive security audit
- Add error handling and user feedback mechanisms

## 2. Non-Functional Requirements
- Real-time collaboration with <200ms latency for document updates
- Support for 2-5 simultaneous collaborators per document
- Secure authentication with Firebase identity management
- Responsive design that works on desktop and tablet devices
- 99.9% uptime for document access and collaboration
- Data encryption at rest and in transit
- Load time <3 seconds for document editor
- Support for documents up to 10MB in size

## 3. User Stories with Acceptance Criteria

### As an authenticated user, I want to create new documents
- Given I am logged in, I can click a "New Document" button
- When I click the button, a new document is created with my user ID as owner
- Then I am redirected to the editor with auto-generated title

### As an authenticated user, I want to view my documents
- Given I am logged in, I can see a list of documents I own
- When I navigate to the dashboard, documents are loaded from Firestore
- Then I can see document titles and last modified dates

### As an authenticated user, I want to edit documents in real-time
- Given I am in the document editor, I can type and see my changes
- When I type, changes are reflected in real-time for all collaborators
- Then changes are debounced and saved to Firestore periodically

### As an authenticated user, I want to share documents with others
- Given I have a document, I can open the share modal
- When I enter an email and select a role (viewer/editor), the user is invited
- Then the invited user receives appropriate permissions to access the document

### As a collaborator, I want to see who else is editing the document
- Given I am viewing or editing a document, I can see active collaborators
- When others join/leave the document, the status updates in real-time
- Then I can see presence indicators for each active user

## 4. Firestore Data Model

### Users Collection
- users/{userId}
  - email: string
  - displayName: string
  - photoURL: string
  - createdAt: timestamp
  - lastLoginAt: timestamp

### Documents Collection
- documents/{documentId}
  - title: string
  - content: object (TipTap JSON format)
  - ownerId: string (userId)
  - createdAt: timestamp
  - lastModifiedAt: timestamp
  - collaborators: object (map of userId to role)
  - permissions: object (access control list)

### Document Presence Collection
- documents/{documentId}/presence/{userId}
  - timestamp: timestamp
  - cursorPosition: number
  - displayName: string
  - isActive: boolean

### Document History Collection
- documents/{documentId}/history/{historyId}
  - timestamp: timestamp
  - content: object (TipTap JSON format)
  - userId: string
  - version: number

## 5. Tech Stack & Versions
- React 18 with TypeScript (strict mode)
- Vite 5+ for build tooling
- Firebase v10+ (Auth, Firestore, Security Rules)
- @tiptap/react 2+ with collaboration extension
- @tiptap/starter-kit for basic formatting
- Tailwind CSS v3+ for styling
- React Router v6+ for navigation
- YJS for collaborative editing support
- ESLint + Prettier for code formatting
- Vitest for testing

## 6. Out of Scope for v1
- Commenting system
- Offline editing capabilities
- Document templates
- Advanced embeds (videos, iframes)
- Document export functionality (PDF, etc.)
- File attachments
- Advanced permissions (granular editing controls)
- Document search functionality
- Version comparison tools

## 7. Phase Definition of Done

### Day 1 DoD:
- [ ] React + TypeScript + Tailwind project set up
- [ ] Firebase Auth configured with email/Google login
- [ ] Dashboard showing user's documents
- [ ] Create/delete document functionality working
- [ ] Firestore security rules protecting document access
- [ ] User authentication state managed globally

### Day 2 DoD:
- [ ] TipTap editor integrated with basic formatting
- [ ] Real-time document synchronization working
- [ ] Debounced writes preventing excessive Firestore updates
- [ ] Active users presence indicators visible
- [ ] Document title editing and autosave implemented
- [ ] Collaborative editing conflict resolution functional

### Day 3 DoD:
- [ ] Share modal with email invitation system
- [ ] Role-based access (viewer/editor) implemented
- [ ] Collaborators can access shared documents
- [ ] Firestore security rules updated for collaboration
- [ ] Email notifications for document sharing (if possible)
- [ ] Role changes reflected in real-time permissions

### Day 4 DoD:
- [ ] Version history with snapshot capability
- [ ] Autosave UI with status indicators
- [ ] UI/UX polish and responsive design
- [ ] Security audit completed and vulnerabilities addressed
- [ ] Performance optimization for large documents
- [ ] Error boundaries and user feedback mechanisms
- [ ] Cross-browser testing completed