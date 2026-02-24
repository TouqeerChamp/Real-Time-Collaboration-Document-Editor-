import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

// Define the document interface
export interface DocumentDataModel {
  id?: string;
  title: string;
  content?: string; // Quill Delta as string (HTML format)
  ownerId: string;
  createdAt: any; // Firestore timestamp
  lastModifiedAt: any; // Firestore timestamp
  collaborators?: Record<string, string>; // userId to role mapping
  authorizedUsers?: Record<string, { role: string; email: string; invitedBy: string }>;
}

// Create a new document
export const createDocument = async (userId: string, title: string): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'documents'), {
      title: title || 'Untitled Document',
      ownerId: userId,
      content: '<p><br/></p>', // Empty content for Quill
      createdAt: serverTimestamp(),
      lastModifiedAt: serverTimestamp(),
      collaborators: {},
      authorizedUsers: {}
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

// Get user's documents with real-time listener
export const getUserDocuments = (
  userId: string,
  callback: (documents: DocumentDataModel[]) => void
): (() => void) => {
  // Create a query to get documents where the user is the owner
  const q = query(
    collection(db, 'documents'),
    where('ownerId', '==', userId)
  );

  // Set up real-time listener
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const documents: DocumentDataModel[] = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      documents.push({
        id: docSnapshot.id,
        title: data.title,
        ownerId: data.ownerId,
        createdAt: data.createdAt,
        lastModifiedAt: data.lastModifiedAt,
        content: data.content,
        collaborators: data.collaborators,
        authorizedUsers: data.authorizedUsers
      });
    });

    callback(documents);
  }, (error) => {
    console.error('Error getting documents:', error);
  });

  return unsubscribe;
};

// Delete a document
export const deleteDocument = async (docId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'documents', docId));
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

// Update document
export const updateDocument = async (docId: string, updates: Partial<DocumentDataModel>): Promise<void> => {
  try {
    const docRef = doc(db, 'documents', docId);
    await updateDoc(docRef, {
      ...updates,
      lastModifiedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};