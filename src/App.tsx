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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {errorMessage}
          </div>
        )}
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Documents Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome, {currentUser?.email}</span>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-700">Your Documents</h2>
          <button
            onClick={handleCreateDocument}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            New Document
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-md text-center">
            <FileText className="mx-auto text-gray-400" size={64} />
            <h3 className="text-xl font-medium text-gray-700 mt-4">No documents yet</h3>
            <p className="text-gray-500 mt-2">Create your first document to get started</p>
            <button
              onClick={handleCreateDocument}
              className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <Plus size={18} />
              Create Document
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start">
                  <h3
                    className="text-lg font-medium text-gray-800 cursor-pointer hover:text-blue-600"
                    onClick={() => doc.id && navigate(`/editor/${doc.id}`)}
                  >
                    {doc.title}
                  </h3>
                  <button
                    onClick={() => doc.id && handleDeleteDocument(doc.id!)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete document"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-4 flex items-center text-sm text-gray-500">
                  <Calendar size={14} className="mr-1" />
                  <span>Created: {formatDate(doc.createdAt)}</span>
                </div>
                <div className="mt-1 flex items-center text-sm text-gray-500">
                  <User size={14} className="mr-1" />
                  <span>Last modified: {formatDate(doc.lastModifiedAt)}</span>
                </div>
                <button
                  onClick={() => doc.id && navigate(`/editor/${doc.id}`)}
                  className="mt-4 w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Open
                </button>
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