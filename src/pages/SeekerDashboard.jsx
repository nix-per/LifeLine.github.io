import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, Filter, Phone, Droplet, AlertCircle, Bell, Trash2, Building, User, Navigation, Heart, CheckCircle, XCircle, Archive, Clock, Share2, Copy, X } from 'lucide-react';
import { searchDonors, addToWatchlist, getWatchlist, subscribeToMatchingInventory, subscribeToAllInventory, requestBlood, subscribeToSentRequests, cancelRequest, archiveRequest, markRequestsFulfilled, getUserProfile } from '../lib/firestore';
import { sendBloodRequestNotification } from '../lib/emailService';
import { useAuth } from '../context/AuthContext';
import { Toaster, toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import GlobalMap from '../components/GlobalMap';

// Simple Haversine distance calculator
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d.toFixed(1);
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

export default function SeekerDashboard() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('hospitals'); // 'hospitals' or 'donors'

    // Search Filters
    const [bloodType, setBloodType] = useState('');
    const [location, setLocation] = useState('');

    // Data States
    const [donors, setDonors] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [userLocation, setUserLocation] = useState(null);
    const [selectedHospitalForShare, setSelectedHospitalForShare] = useState(null);

    // UI States
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

    // Watchlist state
    const [watchlist, setWatchlist] = useState([]);
    const [addingToWatchlist, setAddingToWatchlist] = useState(false);
    const [sentRequests, setSentRequests] = useState([]);
    const [requestFilter, setRequestFilter] = useState('active'); // 'active' | 'past'
    const [seekerProfile, setSeekerProfile] = useState(null);

    // Get User Location on mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => console.error("Error getting location:", error)
            );
        }
    }, []);

    // Fetch Seeker Profile
    useEffect(() => {
        if (currentUser) {
            getUserProfile(currentUser.uid).then(profile => {
                setSeekerProfile(profile);
            }).catch(err => console.error("Error fetching profile:", err));
        }
    }, [currentUser]);

    // Fetch Real-time Hospital Inventory
    useEffect(() => {
        const unsubscribe = subscribeToAllInventory((data) => {
            setHospitals(data);
        });
        return () => unsubscribe();
    }, []);

    const loadWatchlist = useCallback(async () => {
        if (!currentUser) return;
        try {
            const list = await getWatchlist(currentUser.uid);
            setWatchlist(list);
        } catch (error) {
            console.error("Error loading watchlist:", error);
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser) {
            loadWatchlist();
        }
    }, [currentUser, loadWatchlist]);

    // Listen for status of sent requests
    useEffect(() => {
        if (!currentUser) return;

        const unsubscribe = subscribeToSentRequests(currentUser.uid, (requests) => {
            // Check if any request just got accepted (simplified logic for notification)
            const acceptedReq = requests.find(r => r.status === 'accepted' && !r.notified);

            // In a real app, we'd mark 'notified' in DB to avoid repeated toasts.
            // Here we just update state. For simplicity, if we see a NEW accepted one in the list compared to prev state...
            // (Skipping complex diffing for now, just listening to updates)

            setSentRequests(requests);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Subscribe to matching inventory for notifications
    useEffect(() => {
        if (!currentUser || watchlist.length === 0) return;
        const watchedTypes = [...new Set(watchlist.map(item => item.bloodType))];
        const unsubscribe = subscribeToMatchingInventory(watchedTypes, (newItem) => {
            const match = watchlist.find(w =>
                w.bloodType === newItem.bloodType &&
                (!w.location || (newItem.location && newItem.location.toLowerCase().includes(w.location.toLowerCase())))
            );

            if (match) {
                if (Notification.permission === 'granted') {
                    new Notification('Blood Type Match Found!', {
                        body: `${newItem.bloodType} blood is now available in ${newItem.location}.`,
                        icon: '/vite.svg'
                    });
                } else {
                    alert(`New Match: ${newItem.bloodType} available in ${newItem.location}!`);
                }
            }
        });
        return () => unsubscribe();
    }, [currentUser, watchlist]);

    const handleCancelRequest = async (requestId) => {
        if (!window.confirm("Are you sure you want to cancel this request?")) return;
        try {
            await cancelRequest(requestId);
            toast.success("Request cancelled.");
        } catch (error) {
            console.error("Error cancelling request:", error);
            toast.error("Failed to cancel request.");
        }
    };

    const handleArchiveRequest = async (requestId) => {
        try {
            await archiveRequest(requestId);
            toast.success("Request archived.");
        } catch (error) {
            console.error("Error archiving request:", error);
            toast.error("Failed to archive request.");
        }
    };

    const handleMarkFulfilled = async () => {
        if (!window.confirm("This will close all your pending requests. Are you sure you found a donor?")) return;
        try {
            await markRequestsFulfilled(currentUser.uid);
            toast.success("All pending requests closed! Glad you found help.");
        } catch (error) {
            console.error("Error marking fulfilled:", error);
            toast.error("Failed to update requests.");
        }
    };

    const handleSearch = async () => {
        setLoading(true);
        setHasSearched(true);
        try {
            // Search donors (and hospitals technically, but we filter)
            const results = await searchDonors(bloodType, location);
            // Filter to only show individual donors for the 'donors' tab
            // (Hospitals are handled by the real-time listener)
            const individualDonors = results.filter(r => r.type === 'donor');
            setDonors(individualDonors);
        } catch (error) {
            console.error("Error searching:", error);
        }
        setLoading(false);
    };

    const requestNotificationPermission = async () => {
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
        } catch (error) {
            console.error("Error requesting permission:", error);
        }
    };

    const handleNotifyMe = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }
        if (!bloodType) {
            alert("Please select a blood type first.");
            return;
        }

        if (notificationPermission !== 'granted') {
            await requestNotificationPermission();
        }

        setAddingToWatchlist(true);
        try {
            await addToWatchlist(currentUser.uid, bloodType, location);
            await loadWatchlist();
            alert(`You will be notified when ${bloodType} becomes available${location ? ` in ${location}` : ''}.`);
        } catch (error) {
            console.error("Error adding to watchlist:", error);
            alert("Failed to add to watchlist. Please try again.");
        }
        setAddingToWatchlist(false);
    };

    const handleRequestBlood = async (donor) => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        // Optimistic UI update or loading state could go here
        const loadingToast = toast.loading('Sending request...');

        try {
            await requestBlood(
                currentUser.uid,
                currentUser.displayName || currentUser.email.split('@')[0],
                donor.id,
                bloodType || donor.donorProfile.bloodType,
                donor.name || donor.email.split('@')[0]
            );

            // Send email notification using registered location
            const registeredLocation = seekerProfile?.donorProfile?.city || seekerProfile?.address || seekerProfile?.city || location || 'Unknown Location';
            
            await sendBloodRequestNotification([donor], {
                bloodType: bloodType || donor.donorProfile.bloodType || 'Any',
                location: registeredLocation,
                seekerName: currentUser.displayName || currentUser.email.split('@')[0],
                urgency: 'High',
                link: `${window.location.origin}/dashboard`
            });

            toast.success(`Request sent to ${donor.name || donor.email.split('@')[0]}!`, { id: loadingToast });
        } catch (error) {
            console.error("Error requesting blood:", error);
            toast.error("Failed to send request. Please try again.", { id: loadingToast });
        }
    };

    // Filter sent requests based on tab
    const filteredRequests = sentRequests.filter(req => {
        if (requestFilter === 'active') {
            return req.status === 'pending' || req.status === 'accepted';
        } else {
            return req.status === 'cancelled' || req.status === 'rejected' || req.status === 'archived' || req.status === 'closed';
        }
    });

    const activeCount = sentRequests.filter(r => r.status === 'pending' || r.status === 'accepted').length;

    // Filter hospitals based on search criteria
    const filteredHospitals = hospitals.filter(h => {
        // Filter by blood type availability if selected
        const hasStock = !bloodType || (h.bloodStock && h.bloodStock[bloodType] > 0);
        // Filter by location or hospital name
        const matchesLocation = !location ||
            (h.address && h.address.toLowerCase().includes(location.toLowerCase())) ||
            (h.hospitalName && h.hospitalName.toLowerCase().includes(location.toLowerCase()));
        return hasStock && matchesLocation;
    });

    const handleShareDetails = (hospital) => {
        setSelectedHospitalForShare(hospital);
    };

    const handleBroadcastNotification = async () => {
        if (donors.length === 0) return;
        if (!currentUser) {
            navigate('/login');
            return;
        }

        if (!window.confirm(`Are you sure you want to send an emergency email notification AND blood requests to all ${donors.length} donors in this list?`)) {
            return;
        }

        const loadingToast = toast.loading('Processing emergency broadcast...');

        // Determine registered location
        const registeredLocation = seekerProfile?.donorProfile?.city || seekerProfile?.address || seekerProfile?.city || location || 'Unknown Location';
        const seekerName = currentUser.displayName || currentUser.email.split('@')[0];

        try {
            // 1. Create database requests for each donor
            // We handle individual failures so one bad request doesn't stop the whole batch
            const requestPromises = donors.map(donor => 
                requestBlood(
                    currentUser.uid,
                    seekerName,
                    donor.id,
                    bloodType || donor.donorProfile.bloodType,
                    donor.name || donor.email.split('@')[0]
                ).catch(err => {
                    console.error(`Failed to request blood from donor ${donor.id}:`, err);
                    return null; 
                })
            );

            // 2. Send email notifications
            const emailPromise = sendBloodRequestNotification(donors, {
                bloodType: bloodType || 'Any',
                location: registeredLocation,
                seekerName: seekerName,
                urgency: 'High',
                link: window.location.origin + '/dashboard'
            });

            // Execute all operations
            await Promise.all([...requestPromises, emailPromise]);

            toast.success(`Broadcast sent! Requests created and emails sent to ${donors.length} donors.`, { id: loadingToast });
        } catch (error) {
            console.error("Error in broadcast:", error);
            toast.error("Broadcast completed with some errors. Check console.", { id: loadingToast });
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success("Details copied to clipboard!");
            setSelectedHospitalForShare(null);
        }).catch((err) => {
            console.error('Failed to copy: ', err);
            toast.error("Failed to copy details.");
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <Toaster position="top-center" />
            
            {/* Share Details Modal */}
            {selectedHospitalForShare && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-float">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-slate-900">Hospital Details</h3>
                                <button 
                                    onClick={() => setSelectedHospitalForShare(null)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                            
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                                <p className="font-bold text-lg text-slate-900 mb-2">{selectedHospitalForShare.hospitalName}</p>
                                <div className="space-y-2 text-sm text-slate-600">
                                    <p className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                        {selectedHospitalForShare.address}
                                    </p>
                                    {selectedHospitalForShare.phoneNumber && (
                                        <p className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                                            {selectedHospitalForShare.phoneNumber}
                                        </p>
                                    )}
                                    {selectedHospitalForShare.email && (
                                        <p className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-slate-400 shrink-0" />
                                            {selectedHospitalForShare.email}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    const details = `Hospital Name: ${selectedHospitalForShare.hospitalName}\nAddress: ${selectedHospitalForShare.address}\nPhone: ${selectedHospitalForShare.phoneNumber || 'N/A'}\nEmail: ${selectedHospitalForShare.email || 'N/A'}`;
                                    copyToClipboard(details);
                                }}
                                className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-200"
                            >
                                <Copy className="h-5 w-5" />
                                Copy Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Find Blood & Donors</h1>
                    <p className="mt-2 text-slate-600">Locate nearby hospitals or connect with individual donors.</p>
                </div>

                {/* Sent Requests Section */}
                {sentRequests.length > 0 && (
                    <div className="mb-8 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Heart className="h-5 w-5 text-red-600" />
                                    My Sent Requests
                                </h2>
                                <p className="text-sm text-slate-500 mt-1">Manage your SOS requests to donors.</p>
                            </div>

                            {activeCount > 0 && (
                                <button
                                    onClick={handleMarkFulfilled}
                                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-bold hover:bg-green-200 transition-colors flex items-center gap-2"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                    I Found a Donor (Close All)
                                </button>
                            )}
                        </div>

                        {/* Request Tabs */}
                        <div className="flex border-b border-slate-100">
                            <button
                                onClick={() => setRequestFilter('active')}
                                className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${requestFilter === 'active' ? 'bg-slate-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                Active ({activeCount})
                            </button>
                            <button
                                onClick={() => setRequestFilter('past')}
                                className={`flex-1 py-3 text-sm font-bold text-center transition-colors ${requestFilter === 'past' ? 'bg-slate-50 text-slate-900 border-b-2 border-slate-900' : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                Past / Archived
                            </button>
                        </div>

                        <div className="p-6">
                            {filteredRequests.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    No {requestFilter} requests found.
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-2 gap-4">
                                    {filteredRequests.map(req => (
                                        <div key={req.id} className={`p-5 rounded-xl border shadow-sm flex flex-col justify-between gap-4 ${req.status === 'accepted' ? 'border-green-200 bg-green-50' :
                                            req.status === 'pending' ? 'border-slate-100 bg-white' : 'border-slate-100 bg-slate-50 opacity-75'
                                            }`}>
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${req.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                                        req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                            req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-600'
                                                        }`}>
                                                        {req.status.toUpperCase()}
                                                    </span>
                                                    <span className="text-slate-400 text-xs flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(req.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="font-bold text-slate-900">
                                                    {req.donorName ? `Request to ${req.donorName}` : `Request for ${req.bloodType}`}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">Blood Type: {req.bloodType}</p>
                                            </div>

                                            <div className="flex items-center gap-2 pt-2 border-t border-black/5">
                                                {req.status === 'accepted' ? (
                                                    <>
                                                        <a
                                                            href={`tel:${req.donorPhone}`}
                                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm flex items-center justify-center gap-2"
                                                        >
                                                            <Phone className="h-4 w-4" />
                                                            Call Donor
                                                        </a>
                                                        <button
                                                            onClick={() => handleArchiveRequest(req.id)}
                                                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                                                            title="Archive"
                                                        >
                                                            <Archive className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                ) : req.status === 'pending' ? (
                                                    <>
                                                        <span className="text-sm text-slate-500 italic flex-1">Waiting...</span>
                                                        <button
                                                            onClick={() => handleCancelRequest(req.id)}
                                                            className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-slate-400 w-full text-center">
                                                        {req.status === 'rejected' ? 'Donor declined' : 'Request closed'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab Switcher */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex">
                        <button
                            onClick={() => setActiveTab('hospitals')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'hospitals'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <Building className="h-4 w-4" />
                            Hospitals & Banks
                        </button>
                        <button
                            onClick={() => setActiveTab('donors')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'donors'
                                ? 'bg-red-600 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <User className="h-4 w-4" />
                            Individual Donors
                        </button>
                    </div>
                </div>

                {/* Shared Search Filters */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Blood Type</label>
                            <div className="relative">
                                <select
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none appearance-none bg-slate-50"
                                    value={bloodType}
                                    onChange={(e) => setBloodType(e.target.value)}
                                >
                                    <option value="">All Blood Types</option>
                                    <option value="A+">A+</option>
                                    <option value="A-">A-</option>
                                    <option value="B+">B+</option>
                                    <option value="B-">B-</option>
                                    <option value="AB+">AB+</option>
                                    <option value="AB-">AB-</option>
                                    <option value="O+">O+</option>
                                    <option value="O-">O-</option>
                                </select>
                                <Droplet className="absolute left-3 top-3.5 h-5 w-5 text-brand-500" />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Location (City)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="e.g. New York"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none bg-slate-50"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                />
                                <MapPin className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                            </div>
                        </div>

                        <div className="flex items-end gap-2">
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className={`flex-1 text-white font-bold py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${activeTab === 'hospitals' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                    }`}
                            >
                                {loading ? '...' : (
                                    <>
                                        <Search className="h-5 w-5" />
                                        Search
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleNotifyMe}
                                disabled={addingToWatchlist}
                                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                                title="Notify me when this blood type becomes available"
                            >
                                <Bell className="h-5 w-5" />
                                Notify Me
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'hospitals' && (
                    <div className="space-y-6">
                        {/* Map Section */}
                        <div className="mb-8">
                            <GlobalMap
                                hospitals={filteredHospitals}
                                userLocation={userLocation ? [userLocation.lat, userLocation.lng] : null}
                            />
                        </div>

                        {/* Hospital List */}
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Building className="h-5 w-5 text-blue-600" />
                            Nearby Hospitals ({filteredHospitals.length})
                        </h2>

                        <div className="grid md:grid-cols-2 gap-4">
                            {filteredHospitals.map(hospital => {
                                const distance = userLocation && hospital.location
                                    ? getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, hospital.location.lat, hospital.location.lng)
                                    : null;

                                const totalStock = hospital.bloodStock ? Object.values(hospital.bloodStock).reduce((a, b) => a + b, 0) : 0;

                                return (
                                    <div key={hospital.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all flex flex-col lg:flex-row justify-between lg:items-center gap-4 w-full overflow-hidden">
                                        {/* Left Side: Hospital Info */}
                                        <div className="flex-1 min-w-0"> {/* min-w-0 allows text truncation to work */}
                                            <h3 className="font-bold text-lg text-slate-900 truncate">{hospital.hospitalName}</h3>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 mt-1">
                                                {distance && (
                                                    <span className="flex items-center gap-1 text-blue-600 font-medium shrink-0">
                                                        <Navigation className="h-3.5 w-3.5" /> {distance} km away
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1 shrink-0">
                                                    <Droplet className="h-3.5 w-3.5 text-red-500" /> {totalStock} units
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-2 line-clamp-3">
                                                {hospital.address}
                                            </p>
                                        </div>

                                        {/* Right Side: Action Buttons */}
                                        <div className="grid grid-cols-2 lg:flex lg:flex-col gap-2 w-full lg:w-auto lg:min-w-[140px]">
                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.location?.lat},${hospital.location?.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 px-3 py-2.5  rounded-lg text-xs sm:text-sm font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 "
                                            >
                                                <Navigation className="h-4 w-4" />
                                                Directions
                                            </a>

                                            {hospital.phoneNumber ? (
                                                <a
                                                    href={`tel:${hospital.phoneNumber}`}
                                                    className="flex-1 px-3 py-2.5 bg-white border border-green-500 text-green-600 rounded-lg text-xs sm:text-sm font-bold hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Phone className="h-4 w-4" />
                                                    <span>Call</span>
                                                </a>
                                            ) : (
                                                <button
                                                    disabled
                                                    className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-400 rounded-lg text-xs sm:text-sm font-bold cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    <Phone className="h-4 w-4" />
                                                    <span>No Phone</span>
                                                </button>
                                            )}
                                            
                                            <button
                                                onClick={() => handleShareDetails(hospital)}
                                                className="col-span-2 lg:col-span-1 flex-1 px-3 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs sm:text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Share2 className="h-4 w-4" />
                                                <span>Share Details</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'donors' && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
                            <User className="h-5 w-5 text-red-600" />
                            Available Donors {hasSearched && `(${donors.length})`}
                        </h2>

                        {donors.length > 0 && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-red-800">Emergency Broadcast</h3>
                                    <p className="text-sm text-red-600">Send an urgent email notification to all {donors.length} donors in this list.</p>
                                </div>
                                <button
                                    onClick={handleBroadcastNotification}
                                    className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center gap-2 whitespace-nowrap"
                                >
                                    <Bell className="h-4 w-4" />
                                    Notify All
                                </button>
                            </div>
                        )}

                        {!hasSearched && donors.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-xl border border-slate-100">
                                <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">Search to find individual donors.</p>
                            </div>
                        )}

                        {donors.map(donor => (
                            <div key={donor.id} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:border-red-100 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="text-red-600 font-bold text-xl h-14 w-14 rounded-full flex items-center justify-center border-2 bg-red-50 border-red-100">
                                        {donor.donorProfile.bloodType}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">
                                            {donor.name || donor.email.split('@')[0]}
                                        </h3>
                                        <div className="flex items-center text-slate-500 text-sm mt-1 gap-4">
                                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {donor.donorProfile.city}</span>
                                            {/* Mock Distance for now as donor location isn't lat/lng yet */}
                                            <span className="flex items-center gap-1 text-slate-400"><Navigation className="h-3 w-3" /> ~5km away</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleRequestBlood(donor)}
                                    className="w-full md:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium shadow-sm shadow-red-200"
                                >
                                    <Heart className="h-4 w-4" />
                                    Request Blood
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
