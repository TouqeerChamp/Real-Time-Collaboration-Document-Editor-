import { doc, serverTimestamp, collection, query, onSnapshot, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Interface for presence data
export interface PresenceData {
  id: string;
  name: string;
  color: string;
  lastSeen: any; // Firestore timestamp
}

// Update user presence in a document's presence sub-collection
export const updatePresence = async (docId: string, userId: string, name: string, color: string) => {
  try {
    const presenceRef = doc(db, `documents/${docId}/presence`, userId);
    await setDoc(presenceRef, {
      id: userId,
      name,
      color,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating presence:', error);
    // Don't throw error for presence updates as they shouldn't break the editor
    // Presence is just for collaboration indicators
    console.warn('Presence update failed, but continuing without error');
  }
};

// Remove user presence when they leave (actually delete the document)
export const removePresence = async (docId: string, userId: string) => {
  try {
    const presenceRef = doc(db, `documents/${docId}/presence`, userId);
    // First update with last seen timestamp
    await setDoc(presenceRef, {
      lastSeen: serverTimestamp()
    }, { merge: true });

    // Schedule deletion after 300ms to ensure it happens but allow for brief disconnections
    setTimeout(async () => {
      try {
        await deleteDoc(presenceRef);
      } catch (error) {
        console.error('Error during presence cleanup:', error);
      }
    }, 300); // Short delay to ensure the update goes through
  } catch (error) {
    console.error('Error removing presence:', error);
    // Don't throw error for presence cleanup as it shouldn't break the editor
    // Presence is just for collaboration indicators
    console.warn('Presence cleanup failed, but continuing without error');
  }
};

// Set up presence listener for a document
export const setupPresenceListener = (
  docId: string,
  callback: (presences: PresenceData[]) => void,
  currentUserId: string
) => {
  const presenceCollectionRef = collection(db, `documents/${docId}/presence`);
  const q = query(presenceCollectionRef);

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const now = new Date();
    const activePresences: PresenceData[] = [];

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      let lastSeen = null;

      // Properly handle Firestore timestamp
      if (data.lastSeen && typeof data.lastSeen.toDate === 'function') {
        lastSeen = data.lastSeen.toDate();
      } else if (data.lastSeen && data.lastSeen._seconds) {
        // Handle timestamp object format
        lastSeen = new Date(data.lastSeen._seconds * 1000);
      } else if (data.lastSeen instanceof Date) {
        lastSeen = data.lastSeen;
      }

      // Consider user offline if last seen more than 15 seconds ago
      if (lastSeen && (now.getTime() - lastSeen.getTime()) < 15000) {
        // Don't include current user in collaborators list
        if (docSnapshot.id !== currentUserId) {
          activePresences.push({
            id: docSnapshot.id,
            name: data.name || 'Anonymous',
            color: data.color || '#999999',
            lastSeen: data.lastSeen
          });
        }
      }
    });

    callback(activePresences);
  }, (error) => {
    console.error('Error in presence listener:', error);
  });

  return unsubscribe;
};