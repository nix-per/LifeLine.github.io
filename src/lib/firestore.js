import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  arrayUnion
} from 'firebase/firestore';

// User Profile Management
export const createUserProfile = async (uid, userData) => {
  try {
    await setDoc(doc(db, 'users', uid), {
      ...userData,
      createdAt: new Date().toISOString(),
      isDonor: false
    });
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

export const getUserProfile = async (uid) => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};

export const subscribeToUserProfile = (uid, callback) => {
  return onSnapshot(doc(db, 'users', uid), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    } else {
      callback(null);
    }
  });
};

export const updateDonorStatus = async (uid, donorData) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      isDonor: true,
      donorProfile: {
        ...donorData,
        lastDonation: null,
        totalDonations: 0
      }
    });
  } catch (error) {
    console.error("Error updating donor status:", error);
    throw error;
  }
};

export const updateDonorEligibility = async (uid, isEligible) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      isEligible: isEligible,
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error updating eligibility:", error);
    throw error;
  }
};

// Search Functionality
export const searchDonors = async (bloodType, location) => {
  try {
    let results = [];
    
    // 1. Search Individual Donors
    const usersRef = collection(db, 'users');
    // Filter for donors who are both registered (isDonor) and eligible (isEligible)
    let qUsers = query(usersRef, where("isDonor", "==", true), where("isEligible", "==", true));
    
    if (bloodType) {
      qUsers = query(qUsers, where("donorProfile.bloodType", "==", bloodType));
    }

    const userSnapshot = await getDocs(qUsers);
    userSnapshot.forEach((doc) => {
      const data = doc.data();
      if (!location || (data.donorProfile.city && data.donorProfile.city.toLowerCase().includes(location.toLowerCase()))) {
        results.push({ 
          id: doc.id, 
          type: 'donor',
          ...data 
        });
      }
    });

    // 2. Search Hospital Inventory
    const inventoryRef = collection(db, 'inventory');
    let qInventory = query(inventoryRef, where("status", "==", "available"));

    if (bloodType) {
      qInventory = query(qInventory, where("bloodType", "==", bloodType));
    }

    const inventorySnapshot = await getDocs(qInventory);
    inventorySnapshot.forEach((doc) => {
      const data = doc.data();
      if (!location || (data.location && data.location.toLowerCase().includes(location.toLowerCase()))) {
        results.push({ 
          id: doc.id, 
          type: 'hospital',
          // Normalizing structure to match UI expectation
          donorProfile: {
            bloodType: data.bloodType,
            city: data.location,
            phone: data.phoneNumber || '', // Include phone number from inventory
          },
          email: 'Hospital Inventory', // Placeholder
          hospitalName: data.hospitalName,
          address: data.address,
          locationCoordinates: data.location // {lat, lng}
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error("Error searching:", error);
    throw error;
  }
};

// Watchlist Functionality
export const addToWatchlist = async (uid, bloodType, location) => {
  try {
    const watchlistRef = doc(collection(db, 'watchlists'));
    await setDoc(watchlistRef, {
      userId: uid,
      bloodType,
      location,
      createdAt: new Date().toISOString(),
      status: 'active'
    });
    return watchlistRef.id;
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    throw error;
  }
};

export const getWatchlist = async (uid) => {
  try {
    const q = query(
      collection(db, 'watchlists'), 
      where("userId", "==", uid),
      where("status", "==", "active")
    );
    const querySnapshot = await getDocs(q);
    let watchlist = [];
    querySnapshot.forEach((doc) => {
      watchlist.push({ id: doc.id, ...doc.data() });
    });
    return watchlist;
  } catch (error) {
    console.error("Error getting watchlist:", error);
    throw error;
  }
};

export const createHospitalProfile = async (uid, hospitalData) => {
  try {
    // 1. Create User Profile
    await setDoc(doc(db, 'users', uid), {
      email: hospitalData.email,
      role: 'hospital',
      hospitalName: hospitalData.hospitalName,
      phoneNumber: hospitalData.phoneNumber, // Added phone number
      createdAt: new Date().toISOString()
    });

    // 2. Initialize Inventory Document
    await setDoc(doc(db, 'inventory', uid), {
      hospitalId: uid,
      hospitalName: hospitalData.hospitalName,
      licenseId: hospitalData.licenseId,
      address: hospitalData.address,
      phoneNumber: hospitalData.phoneNumber, // Added phone number to inventory as well for easy access
      location: hospitalData.location, // { lat: ..., lng: ... }
      bloodStock: {
        'A+': 0, 'A-': 0,
        'B+': 0, 'B-': 0,
        'AB+': 0, 'AB-': 0,
        'O+': 0, 'O-': 0
      },
      lastUpdated: new Date().toISOString(),
      status: 'active'
    });
  } catch (error) {
    console.error("Error creating hospital profile:", error);
    throw error;
  }
};

export const updateHospitalStock = async (hospitalId, bloodType, change) => {
  try {
    const inventoryRef = doc(db, 'inventory', hospitalId);
    const docSnap = await getDoc(inventoryRef);
    
    if (docSnap.exists()) {
      const currentStock = docSnap.data().bloodStock || {};
      const currentAmount = currentStock[bloodType] || 0;
      const newAmount = Math.max(0, currentAmount + change); // Prevent negative stock

      await updateDoc(inventoryRef, {
        [`bloodStock.${bloodType}`]: newAmount,
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Error updating stock:", error);
    throw error;
  }
};

// Kept for backward compatibility with TestAdminPage, but using new inventory structure
export const addInventoryItem = async (hospitalId, bloodType, location, quantity) => {
  try {
    // This is a bit hacky for the test page, as it tries to simulate adding stock 
    // to a hospital. In the real app, hospitals have fixed IDs.
    // For testing, we'll try to find an existing inventory with this ID or create a dummy one.
    
    const inventoryRef = doc(db, 'inventory', hospitalId);
    const docSnap = await getDoc(inventoryRef);
    
    if (!docSnap.exists()) {
        // Create dummy hospital inventory if it doesn't exist
        await setDoc(inventoryRef, {
            hospitalName: "Test Hospital",
            address: location,
            location: { lat: 40.7128, lng: -74.0060 }, // Default to NY
            bloodStock: { [bloodType]: Number(quantity) },
            lastUpdated: new Date().toISOString(),
            status: 'active'
        });
    } else {
        // Update existing
        const currentStock = docSnap.data().bloodStock || {};
        const currentAmount = currentStock[bloodType] || 0;
        
        await updateDoc(inventoryRef, {
            [`bloodStock.${bloodType}`]: currentAmount + Number(quantity),
            lastUpdated: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error("Error adding inventory:", error);
    throw error;
  }
};

export const subscribeToHospitalInventory = (hospitalId, callback) => {
  return onSnapshot(doc(db, 'inventory', hospitalId), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() });
    }
  });
};

export const subscribeToAllInventory = (callback) => {
  const q = query(collection(db, 'inventory'), where('status', '==', 'active'));
  return onSnapshot(q, (snapshot) => {
    const items = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    callback(items);
  });
};

export const subscribeToMatchingInventory = (bloodTypes, callback) => {
  if (!bloodTypes || bloodTypes.length === 0) return () => {};

  const q = query(
    collection(db, 'inventory'),
    where('status', '==', 'active')
    // Note: complex queries with arrays and 'in' operator might require an index
    // Simplified: Just listen to all active inventory and filter client-side if the list is small
    // or use a more specific query if possible.
  );

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "modified" || change.type === "added") {
         const data = change.doc.data();
         // Check if any of the updated blood stocks match the user's watchlist
         // This is a bit complex because the document structure is { bloodStock: { 'A+': 5 } }
         // We need to iterate through the watched blood types and see if they exist in the update
         
         bloodTypes.forEach(type => {
             if (data.bloodStock && data.bloodStock[type] > 0) {
                 callback({
                     id: change.doc.id,
                     bloodType: type,
                     location: data.location, // Note: this is an object {lat, lng} now
                     ...data
                 });
             }
         });
      }
    });
  });
};

// Blood Request System (Seeker -> Donor)
export const requestBlood = async (seekerId, seekerName, donorId, bloodType, donorName) => {
  try {
    const requestRef = doc(collection(db, 'blood_requests'));
    await setDoc(requestRef, {
      seekerId,
      seekerName,
      donorId,
      donorName, // Added donorName for better seeker visibility
      bloodType,
      status: 'pending', // pending, accepted, rejected
      createdAt: new Date().toISOString()
    });
    return requestRef.id;
  } catch (error) {
    console.error("Error creating blood request:", error);
    throw error;
  }
};

export const subscribeToBloodRequests = (donorId, callback) => {
  const q = query(
    collection(db, 'blood_requests'),
    where('donorId', '==', donorId),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, (snapshot) => {
    const requests = [];
    snapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() });
    });
    // Sort by newest first
    requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    callback(requests);
  });
};

export const subscribeToSentRequests = (seekerId, callback) => {
  const q = query(
    collection(db, 'blood_requests'),
    where('seekerId', '==', seekerId)
  );

  return onSnapshot(q, (snapshot) => {
    const requests = [];
    snapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() });
    });
    // Sort by newest first
    requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    callback(requests);
  });
};

export const updateRequestStatus = async (requestId, status, donorPhone = null) => {
  try {
    const requestRef = doc(db, 'blood_requests', requestId);
    const updateData = {
      status,
      respondedAt: new Date().toISOString()
    };
    
    if (donorPhone) {
        updateData.donorPhone = donorPhone;
    }
    
    await updateDoc(requestRef, updateData);
  } catch (error) {
    console.error("Error updating request status:", error);
    throw error;
  }
};

export const cancelRequest = async (requestId) => {
  try {
    await updateDoc(doc(db, 'blood_requests', requestId), {
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error cancelling request:", error);
    throw error;
  }
};

export const archiveRequest = async (requestId) => {
  try {
    await updateDoc(doc(db, 'blood_requests', requestId), {
      status: 'archived',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error archiving request:", error);
    throw error;
  }
};

export const markRequestsFulfilled = async (seekerId) => {
  try {
    const q = query(
      collection(db, 'blood_requests'),
      where('seekerId', '==', seekerId),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    const batchPromises = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { 
        status: 'closed',
        updatedAt: new Date().toISOString()
      })
    );
    await Promise.all(batchPromises);
  } catch (error) {
    console.error("Error marking requests fulfilled:", error);
    throw error;
  }
};

// Donation Camp Management (Organizer Side)
export const addDonationCamp = async (organizerId, campData) => {
  try {
    const campRef = doc(collection(db, 'donationCamps'));
    await setDoc(campRef, {
      organizerId,
      ...campData,
      createdAt: new Date().toISOString(),
      status: 'upcoming'
    });
    return campRef.id;
  } catch (error) {
    console.error("Error adding donation camp:", error);
    throw error;
  }
};

export const getDonationCamps = async () => {
  try {
    const q = query(
      collection(db, 'donationCamps')
    );
    const querySnapshot = await getDocs(q);
    let camps = [];
    querySnapshot.forEach((doc) => {
      camps.push({ id: doc.id, ...doc.data() });
    });
    return camps;
  } catch (error) {
    console.error("Error getting donation camps:", error);
    throw error;
  }
};

export const getOrganizerCamps = async (organizerId) => {
  try {
    const q = query(
      collection(db, 'donationCamps'),
      where("organizerId", "==", organizerId)
    );
    const querySnapshot = await getDocs(q);
    let camps = [];
    querySnapshot.forEach((doc) => {
      camps.push({ id: doc.id, ...doc.data() });
    });
    return camps;
  } catch (error) {
    console.error("Error getting organizer camps:", error);
    throw error;
  }
};

export const deleteOldCamps = async () => {
    try {
        const today = new Date();
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(today.getDate() - 2);
        const dateString = twoDaysAgo.toISOString().split('T')[0];

        // Query camps where date is older than 2 days
        const q = query(
            collection(db, 'donationCamps'),
            where("date", "<", dateString)
        );

        const snapshot = await getDocs(q);
        const batchPromises = snapshot.docs.map(doc => 
            // In a real app we might archive instead of delete
            // deleteDoc(doc.ref) 
            updateDoc(doc.ref, { status: 'archived' }) // For safety, let's archive first
        );
        await Promise.all(batchPromises);
    } catch (error) {
        console.error("Error deleting old camps:", error);
        // Don't throw here to avoid blocking UI rendering
    }
};

// Appointment System
export const getVenues = async () => {
  try {
    const venues = [];
    
    // 1. Get Hospitals
    const inventorySnapshot = await getDocs(collection(db, 'inventory'));
    inventorySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status === 'active') {
        venues.push({
          id: doc.id,
          type: 'hospital',
          name: data.hospitalName,
          address: data.address,
          location: data.location
        });
      }
    });

    // 2. Get Donation Camps
    const campsSnapshot = await getDocs(query(collection(db, 'donationCamps'), where('status', '==', 'upcoming')));
    campsSnapshot.forEach((doc) => {
      const data = doc.data();
      venues.push({
        id: doc.id,
        type: 'camp',
        name: data.name,
        address: data.location, // Camp data structure uses 'location' for address string usually, check addDonationCamp usage
        date: data.date,
        time: data.time
      });
    });

    return venues;
  } catch (error) {
    console.error("Error fetching venues:", error);
    throw error;
  }
};

export const bookAppointment = async (appointmentData) => {
  try {
    const appointmentRef = doc(collection(db, 'appointments'));
    await setDoc(appointmentRef, {
      ...appointmentData,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    });
    return appointmentRef.id;
  } catch (error) {
    console.error("Error booking appointment:", error);
    throw error;
  }
};

export const getDonorAppointments = async (uid) => {
  try {
    const q = query(
      collection(db, 'appointments'),
      where("donorId", "==", uid)
    );
    const querySnapshot = await getDocs(q);
    let appointments = [];
    querySnapshot.forEach((doc) => {
      appointments.push({ id: doc.id, ...doc.data() });
    });
    // Sort by date
    appointments.sort((a, b) => new Date(a.date) - new Date(b.date));
    return appointments;
  } catch (error) {
    console.error("Error getting appointments:", error);
    throw error;
  }
};

export const getVenueAppointments = async (venueId) => {
  try {
    const q = query(
      collection(db, 'appointments'),
      where("venueId", "==", venueId),
      where("status", "==", "scheduled")
    );
    const querySnapshot = await getDocs(q);
    let appointments = [];
    querySnapshot.forEach((doc) => {
      appointments.push({ id: doc.id, ...doc.data() });
    });
    // Sort by date
    appointments.sort((a, b) => new Date(a.date) - new Date(b.date));
    return appointments;
  } catch (error) {
    console.error("Error getting venue appointments:", error);
    throw error;
  }
};

export const cancelAppointment = async (appointmentId) => {
  try {
    const appointmentRef = doc(db, 'appointments', appointmentId);
    await updateDoc(appointmentRef, {
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    throw error;
  }
};

export const markAppointmentNoShow = async (appointmentId) => {
  try {
    const appointmentRef = doc(db, 'appointments', appointmentId);
    await updateDoc(appointmentRef, {
      status: 'no-show',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error marking appointment no-show:", error);
    throw error;
  }
};

export const completeAppointment = async (appointmentId, venueId, bloodType, donorId, venueName, venueType) => {
  try {
    // 1. Update Appointment Status
    const appointmentRef = doc(db, 'appointments', appointmentId);
    await updateDoc(appointmentRef, {
      status: 'completed',
      collectedBloodType: bloodType,
      completedAt: new Date().toISOString()
    });

    // 2. Update Stock (if hospital)
    if (venueType === 'hospital') {
      await updateHospitalStock(venueId, bloodType, 1);
    }

    // 3. Update Donor Stats
    const userRef = doc(db, 'users', donorId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentTotal = userData.donorProfile?.totalDonations || 0;
      
      const donationRecord = {
        id: appointmentId,
        venueId,
        venueName,
        bloodType,
        date: new Date().toISOString(),
        status: 'completed'
      };

      await updateDoc(userRef, {
        'donorProfile.lastDonation': new Date().toISOString(),
        'donorProfile.totalDonations': currentTotal + 1,
        donationHistory: arrayUnion(donationRecord)
      });
    }

    // 4. Create Donation History Record
    await setDoc(doc(collection(db, 'donations')), {
      donorId,
      venueId,
      venueName,
      bloodType,
      date: new Date().toISOString(),
      type: 'donation'
    });

  } catch (error) {
    console.error("Error completing appointment:", error);
    throw error;
  }
};
