import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { DocumentDataModel } from '../services/db';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { Save, ArrowLeft, Users, UserPlus } from 'lucide-react';
import type { PresenceData } from '../services/presence';
import { setupPresenceListener, removePresence, updatePresence } from '../services/presence';

interface DocumentEditorProps {
  initialDocument?: DocumentDataModel;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ initialDocument }) => {
  const { docId } = useParams<{ docId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState(initialDocument?.title || 'Untitled Document');
  const [titleLocal, setTitleLocal] = useState(initialDocument?.title || 'Untitled Document');
  const [content, setContent] = useState<string>(initialDocument?.content || '<p><br/></p>'); // Empty content for Quill
  const isLocalTitleChange = useRef(false);
  const isLocalContentChange = useRef(false);
  const isEditingTitle = useRef(false);
  const [collaborators, setCollaborators] = useState<PresenceData[]>([]);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'synced' | 'error'>('connecting');
  const [titleSaving, setTitleSaving] = useState(false);
  const contentUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceUnsubscribeRef = useRef<(() => void) | null>(null);
  const documentUnsubscribeRef = useRef<(() => void) | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const quillInitializedRef = useRef(false);

  // Determine user role and permissions
  const [, setUserRole] = useState<string>('owner'); // Default to owner - role state is set but not directly used
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Sharing functionality
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer'); // default role
  const [authorizedUsers, setAuthorizedUsers] = useState<Record<string, { role: string; email: string; invitedBy: string }> | null>(null);

  // Generate a random color for this user
  const [userColor] = useState(() => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  });

  // Presence heartbeat - update presence every 5 seconds
  useEffect(() => {
    if (!docId || !currentUser) return;

    const updateCurrentUserPresence = async () => {
      if (!docId || !currentUser) return;

      try {
        await updatePresence(
          docId,
          currentUser.uid,
          currentUser.displayName || currentUser.email || 'Anonymous',
          userColor
        );
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    };

    // Initial presence update
    updateCurrentUserPresence();

    // Set up interval for heartbeat
    const intervalId = setInterval(updateCurrentUserPresence, 5000);

    // Set up beforeunload handler for immediate cleanup
    const handleBeforeUnload = () => {
      if (docId && currentUser) {
        // Use navigator.sendBeacon for reliable cleanup on page close
        removePresence(docId, currentUser.uid).catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Clean up interval and event listener
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Remove user from presence when leaving
      if (docId && currentUser) {
        removePresence(docId, currentUser.uid).catch(console.error);
      }
    };
  }, [docId, currentUser, userColor]);

  // Set up presence listener
  useEffect(() => {
    if (!docId || !currentUser) return;

    const unsubscribe = setupPresenceListener(
      docId,
      (presences) => {
        setCollaborators(presences);
      },
      currentUser.uid
    );

    presenceUnsubscribeRef.current = unsubscribe;

    return () => {
      if (presenceUnsubscribeRef.current) {
        presenceUnsubscribeRef.current();
      }
    };
  }, [docId, currentUser]);

  // Set up document content listener
  useEffect(() => {
    if (!docId) return;

    const docRef = doc(db, 'documents', docId);
    const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();

        // Only update content if it's not a local change
        if (data.content !== undefined && data.content !== content && !isLocalContentChange.current) {
          setContent(data.content || '<p><br/></p>');
        }

        // Only update title if it's not a local change and user is not currently editing the title
        // Check both isEditingTitle ref and document.activeElement to ensure the title input is not focused
        const isTitleInputFocused = document.activeElement?.tagName === 'INPUT' &&
                                   (document.activeElement as HTMLInputElement).type === 'text' &&
                                   (document.activeElement as HTMLInputElement).placeholder === 'Document title';

        if (data.title !== undefined && data.title !== title && !isLocalTitleChange.current && !isEditingTitle.current && !isTitleInputFocused) {
          setTitle(data.title);
          setTitleLocal(data.title); // Also update local title
        }
      }
      setSyncStatus('synced');
    }, (error) => {
      console.error('Error in document listener:', error);
      setSyncStatus('error');
    });

    documentUnsubscribeRef.current = unsubscribe;

    return () => {
      if (documentUnsubscribeRef.current) {
        documentUnsubscribeRef.current();
      }
    };
  }, [docId, content, title, titleLocal]);

  // Handle content updates with 500ms debounce
  useEffect(() => {
    if (!docId || !currentUser || isReadOnly) return; // Don't sync if in read-only mode

    if (contentUpdateTimeoutRef.current) {
      clearTimeout(contentUpdateTimeoutRef.current);
    }

    contentUpdateTimeoutRef.current = setTimeout(async () => {
      if (isLocalContentChange.current) { // Only sync if it's a local change
        try {
          setSyncStatus('connecting');
          await updateDoc(doc(db, 'documents', docId), {
            content,
            lastModifiedAt: serverTimestamp()
          });
          setSyncStatus('synced');
          // Reset the local change flag after successful sync
          isLocalContentChange.current = false;
        } catch (error) {
          console.error('Error updating document content:', error);
          setSyncStatus('error');
        }
      }
    }, 500); // 500ms debounce

    return () => {
      if (contentUpdateTimeoutRef.current) {
        clearTimeout(contentUpdateTimeoutRef.current);
      }
    };
  }, [content, docId, currentUser, isReadOnly]);

  // Initialize Quill editor
  useEffect(() => {
    if (!editorRef.current) return;

    // Check if already initialized to prevent double initialization in React Strict Mode
    if (quillInitializedRef.current) {
      return;
    }

    // DOM Reset: Clear the container before initializing to ensure clean DOM
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }

    // Targeted Toolbar Removal: Remove any existing toolbar element
    const containerElement = editorRef.current.parentElement;
    const existingToolbar = containerElement?.querySelector('.ql-toolbar');
    if (existingToolbar) {
      existingToolbar.remove();
    }

    // Create Quill instance
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{'list': 'ordered'}, {'list': 'bullet'}],
          ['link', 'image'],
          ['clean']
        ],
      },
    });

    // Mark as initialized to prevent double initialization
    quillInitializedRef.current = true;
    quillRef.current = quill;

    // Set initial content if available
    if (content) {
      quill.root.innerHTML = content;
    }

    // Handle text changes
    quill.on('text-change', () => {
      // Only update content if not in read-only mode
      if (!isReadOnly) {
        const html = quill.root.innerHTML;
        // Only update if the content actually changed to prevent unnecessary updates
        if (html !== content) {
          isLocalContentChange.current = true;
          setContent(html);
        }
      }
    });

    // Focus the editor after initialization
    setTimeout(() => {
      if (quillRef.current) {
        quillRef.current.focus();
      }
    }, 100);

    return () => {
      // Reset the initialized flag to allow re-initialization if component remounts
      quillInitializedRef.current = false;

      // Cleanup Quill instance on unmount
      if (quillRef.current) {
        quillRef.current = null;
      }

      // Cleanup: Clear the editorRef to prevent leaks
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    };
  }, []); // Empty dependency array - initialize only once

  // Update Quill content when content changes externally
  useEffect(() => {
    if (quillRef.current && content !== quillRef.current.root.innerHTML) {
      // Check if this is a local change to prevent updating when user is editing
      if (!isLocalContentChange.current) {
        quillRef.current.root.innerHTML = content;
      }
    }
  }, [content]);

  // Handle title updates with debouncing
  useEffect(() => {
    if (!docId || !currentUser || isEditingTitle.current || isReadOnly) return; // Don't sync if in read-only mode

    // Only trigger the update when the title changes and we're not editing
    if (titleUpdateTimeoutRef.current) {
      clearTimeout(titleUpdateTimeoutRef.current);
    }

    titleUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        setTitleSaving(true);
        // Use updateDoc directly for immediate sync
        await updateDoc(doc(db, 'documents', docId), {
          title,
          lastModifiedAt: serverTimestamp()
        });
        // Reset the local change flag after successful sync
        isLocalTitleChange.current = false;
      } catch (error) {
        console.error('Error updating document title:', error);
      } finally {
        setTitleSaving(false);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => {
      if (titleUpdateTimeoutRef.current) {
        clearTimeout(titleUpdateTimeoutRef.current);
      }
    };
  }, [title, docId, currentUser, isEditingTitle.current, isReadOnly]);

  // Focus editor when it's ready
  useEffect(() => {
    if (quillRef.current) {
      // Ensure editor is enabled and focused after initialization
      quillRef.current.enable(true);
      setTimeout(() => {
        quillRef.current?.focus();
      }, 100);
    }
  }, []);

  // Update Quill editor read-only state when isReadOnly changes
  useEffect(() => {
    if (quillRef.current) {
      quillRef.current.enable(!isReadOnly);
    }
  }, [isReadOnly]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (contentUpdateTimeoutRef.current) {
        clearTimeout(contentUpdateTimeoutRef.current);
      }
      if (titleUpdateTimeoutRef.current) {
        clearTimeout(titleUpdateTimeoutRef.current);
      }
      // Clean up Quill editor instance
      if (quillRef.current) {
        quillRef.current = null;
      }
      // Reset the initialized flag
      quillInitializedRef.current = false;
    };
  }, []);

  // Load authorized users when document loads
  useEffect(() => {
    if (!docId) return;

    const docRef = doc(db, 'documents', docId);
    const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (data.authorizedUsers) {
          setAuthorizedUsers(data.authorizedUsers);

          // Determine user role and set read-only state
          if (data.ownerId === currentUser?.uid) {
            setUserRole('owner');
            setIsReadOnly(false);
          } else if (currentUser?.email && data.authorizedUsers[currentUser.email]) {
            const userRole = data.authorizedUsers[currentUser.email].role;
            setUserRole(userRole);
            setIsReadOnly(userRole === 'viewer');
          } else {
            // User should not have access, but this check is handled in wrapper
            setUserRole('');
            setIsReadOnly(true);
          }
        } else {
          setAuthorizedUsers({});
          // If no authorizedUsers field exists, owner has full access
          if (data.ownerId === currentUser?.uid) {
            setUserRole('owner');
            setIsReadOnly(false);
          } else {
            // Redirect should have happened in wrapper
            setUserRole('');
            setIsReadOnly(true);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [docId, currentUser]);

  // Format sync status for display
  const syncStatusText = {
    connecting: 'Connecting...',
    synced: 'Synced',
    error: 'Sync Error'
  }[syncStatus];

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  // Function to invite a user
  const handleInviteUser = async () => {
    if (!email || !role || !docId) return;

    try {
      // Update the document with the new user
      const docRef = doc(db, 'documents', docId);
      const currentDoc = await getDoc(docRef);
      const currentData = currentDoc.data();
      const currentAuthorizedUsers = currentData?.authorizedUsers || {};

      // Add the new user
      const updatedAuthorizedUsers = {
        ...currentAuthorizedUsers,
        [email]: {
          role,
          email,
          invitedBy: currentUser.email || currentUser.uid
        }
      };

      await updateDoc(docRef, {
        authorizedUsers: updatedAuthorizedUsers,
        lastModifiedAt: serverTimestamp()
      });

      // Reset form
      setEmail('');
      setRole('viewer');
      // Don't close modal yet, let user see the updated list
    } catch (error) {
      console.error('Error inviting user:', error);
      alert('Failed to invite user: ' + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      {/* Collaborators Bar - Top of the editor */}
      <div className="sticky top-16 z-10 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 p-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-slate-500" size={18} />
            <span className="text-sm font-medium text-slate-500">
              {collaborators.length > 0
                ? `${collaborators.length + 1} people editing`
                : 'Editing alone'}
            </span>

            {/* Show collaborators with avatars/circles */}
            {collaborators.length > 0 && (
              <div className="flex -space-x-2">
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="relative w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: collaborator.color }}
                    title={collaborator.name}
                  >
                    {collaborator.name.charAt(0).toUpperCase()}
                    <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                ))}
                {/* Current user indicator */}
                <div
                  className="relative w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: userColor }}
                  title={currentUser?.displayName || currentUser?.email || 'You'}
                >
                  {currentUser?.displayName?.charAt(0).toUpperCase() ||
                   currentUser?.email?.charAt(0).toUpperCase() ||
                   'Y'}
                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
              </div>
            )}
          </div>

          {/* Sync Status Indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              syncStatus === 'synced' ? 'bg-green-500' :
              syncStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`}></div>
            <span className="text-sm text-slate-500">{syncStatusText}</span>
          </div>
        </div>
      </div>

      {/* Editor Header */}
      <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-4 py-2 backdrop-blur-md bg-white/70 border border-slate-200">
        <div className="max-w-4xl mx-auto flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft size={20} />
              Dashboard
            </button>

            {!isReadOnly && (
              <input
                type="text"
                value={titleLocal}
                onChange={(e) => {
                  setTitleLocal(e.target.value);
                  isLocalTitleChange.current = true;
                  isEditingTitle.current = true;
                }}
                onBlur={async () => {
                  // Update the main title state when the input loses focus
                  setTitle(titleLocal);
                  isEditingTitle.current = false;

                  // Immediately update Firestore with the new title
                  if (docId && currentUser && titleLocal.trim() !== '') {
                    try {
                      setTitleSaving(true);
                      await updateDoc(doc(db, 'documents', docId), {
                        title: titleLocal,
                        lastModifiedAt: serverTimestamp()
                      });
                      isLocalTitleChange.current = false;
                    } catch (error) {
                      console.error('Error updating document title:', error);
                    } finally {
                      setTitleSaving(false);
                    }
                  }
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    // Update the main title state and sync when Enter is pressed
                    setTitle(titleLocal);
                    isEditingTitle.current = false;

                    // Immediately update Firestore with the new title
                    if (docId && currentUser && titleLocal.trim() !== '') {
                      try {
                        setTitleSaving(true);
                        await updateDoc(doc(db, 'documents', docId), {
                          title: titleLocal,
                          lastModifiedAt: serverTimestamp()
                        });
                        isLocalTitleChange.current = false;
                      } catch (error) {
                        console.error('Error updating document title:', error);
                      } finally {
                        setTitleSaving(false);
                      }
                    }

                    (e.target as HTMLInputElement).blur(); // Remove focus to trigger proper sync
                  }
                }}
                onFocus={() => {
                  isEditingTitle.current = true;
                }}
                className="text-lg font-bold bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-slate-900"
                placeholder="Document title"
              />
            )}
            {title && isReadOnly && (
              <h1 className="text-lg font-bold text-slate-900">{title}</h1>
            )}
            {titleSaving && (
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                Saving...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500">
              <Save size={16} />
              Saved
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <UserPlus size={16} />
                Share
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Editor Content */}
      <div className="max-w-4xl mx-auto p-5">
        <div className="bg-white rounded-lg shadow-2xl border border-slate-200 min-h-[70vh]">
          <div ref={editorRef} className="h-[600px]"></div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Share Document</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
              </div>

              <button
                onClick={handleInviteUser}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Invite
              </button>
            </div>

            {/* People with access */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-900 mb-3">People with access</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {/* Document owner */}
                {currentUser && (
                  <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <div className="relative w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                        {currentUser.displayName?.charAt(0).toUpperCase() ||
                         currentUser.email?.charAt(0).toUpperCase() ||
                         'Y'}
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white"></div>
                      </div>
                      <span className="text-sm text-slate-700">{currentUser.email || 'Owner'}</span>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-medium">Owner</span>
                  </div>
                )}

                {/* Invited users */}
                {authorizedUsers && Object.entries(authorizedUsers).map(([email, userData]) => (
                  <div key={email} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                    <div className="flex items-center gap-2">
                      <div className="relative w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                        {email.charAt(0).toUpperCase()}
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white"></div>
                      </div>
                      <span className="text-sm text-slate-700">{email}</span>
                    </div>
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded capitalize font-medium">
                      {userData.role}
                    </span>
                  </div>
                ))}

                {(!authorizedUsers || Object.keys(authorizedUsers).length === 0) && (
                  <p className="text-sm text-slate-500 italic">No one else has access</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Wrapper component that fetches document data
const DocumentEditorWrapper: React.FC = () => {
  const { docId } = useParams<{ docId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentDataModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (!docId || !currentUser) return;

    const fetchDocument = async () => {
      try {
        const docRef = doc(db, 'documents', docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();

          // Check access permission
          const isOwner = data.ownerId === currentUser.uid;
          const isAuthorizedUser = data.authorizedUsers && data.authorizedUsers[currentUser.email || ''];

          if (isOwner) {
            // Owner has full access
            setDocument({
              id: docId,
              title: data.title || 'Untitled Document',
              ownerId: data.ownerId,
              createdAt: data.createdAt,
              lastModifiedAt: data.lastModifiedAt,
              content: data.content || '<p><br/></p>', // Default empty content for Quill
              collaborators: data.collaborators,
              authorizedUsers: data.authorizedUsers
            });
            setHasPermission(true);
          } else if (isAuthorizedUser && currentUser.email && data.authorizedUsers[currentUser.email]) {
            // Authorized user has access based on role
            setDocument({
              id: docId,
              title: data.title || 'Untitled Document',
              ownerId: data.ownerId,
              createdAt: data.createdAt,
              lastModifiedAt: data.lastModifiedAt,
              content: data.content || '<p><br/></p>', // Default empty content for Quill
              collaborators: data.collaborators,
              authorizedUsers: data.authorizedUsers
            });
            setHasPermission(true);
          } else {
            // User does not have permission - redirect with error message
            navigate('/dashboard', { state: { errorMessage: 'You do not have permission to view this document' } });
            setHasPermission(false);
            return;
          }
        } else {
          // Document doesn't exist, create it
          console.log('Document does not exist, creating a new one');
          setDocument({
            id: docId,
            title: 'Untitled Document',
            ownerId: currentUser.uid,
            createdAt: null,
            lastModifiedAt: null,
            content: '<p><br/></p>', // Default empty content for Quill
            collaborators: {},
            authorizedUsers: {}
          });
          setHasPermission(true);
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        navigate('/dashboard');
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [docId, currentUser, navigate]);

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (hasPermission === false) {
    return null;
  }

  return <DocumentEditor initialDocument={document || undefined} />;
};

export default DocumentEditorWrapper;