import { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import DocumentEditorWrapper from './components/DocumentEditor';
import { Plus, Trash2, FileText, Calendar, User } from 'lucide-react';
import type { DocumentDataModel } from './services/db';
import { createDocument, getUserDocuments, deleteDocument } from './services/db';

// Protected Route Component
import React from 'react';

function ProtectedRoute({ children }: { children: React.JSX.Element }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/login" replace />;
}

// Dashboard Component (Updated with Document CRUD)
function Dashboard() {
  const { currentUser, logout } = useAuth();
  const [documents, setDocuments] = useState<DocumentDataModel[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  // Check for error message from state
  useEffect(() => {
    if (location.state?.errorMessage) {
      setErrorMessage(location.state.errorMessage);
      // Clear the state after showing the message
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Load user documents when component mounts
  useEffect(() => {
    if (currentUser) {
      const unsubscribeFunc = getUserDocuments(currentUser.uid, (docs) => {
        setDocuments(docs);
        setLoading(false);
      });

      return () => {
        unsubscribeFunc();
      };
    }
  }, [currentUser]);

  const handleCreateDocument = async () => {
    if (currentUser) {
      try {
        const newDocId = await createDocument(currentUser.uid, 'Untitled Document');
        navigate(`/editor/${newDocId}`);
      } catch (error) {
        console.error('Error creating document:', error);
      }
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocument(docId);
        // The real-time listener will automatically update the documents list
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    try {
      // Convert Firestore timestamp to JS Date
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Just now';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      <div className="max-w-6xl mx-auto p-6">
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Header */}
        <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-4 py-2 mb-6 backdrop-blur-md bg-white/70 border border-slate-200 rounded-lg">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Documents</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Welcome, {currentUser?.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium tracking-tight text-slate-900">Your Documents</h2>
          <button
            onClick={handleCreateDocument}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium tracking-tight hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            New Document
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-lg p-12 text-center shadow-sm">
            <FileText className="mx-auto text-slate-400" size={64} />
            <h3 className="text-lg font-medium text-slate-900 mt-4">No documents yet</h3>
            <p className="text-slate-500 mt-2">Create your first document to get started</p>
            <button
              onClick={handleCreateDocument}
              className="mt-4 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium tracking-tight hover:bg-indigo-700 transition-colors shadow-sm mx-auto"
            >
              <Plus size={18} />
              Create Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-slate-100 rounded-lg p-5 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                onClick={() => doc.id && navigate(`/editor/${doc.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="text-slate-400 flex-shrink-0" size={18} />
                    <h3 className="text-base font-medium text-slate-900 truncate max-w-[70%]">
                      {doc.title}
                    </h3>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      doc.id && handleDeleteDocument(doc.id!);
                    }}
                    className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Delete document"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center text-xs text-slate-500 mb-1">
                  <Calendar size={12} className="mr-1" />
                  <span>Created: {formatDate(doc.createdAt)}</span>
                </div>
                <div className="flex items-center text-xs text-slate-500">
                  <User size={12} className="mr-1" />
                  <span>Last modified: {formatDate(doc.lastModifiedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper component to use auth context inside the router
function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/editor/:docId"
        element={
          <ProtectedRoute>
            <DocumentEditorWrapper />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        }>
          <AppContent />
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App