import React, { useState, useEffect } from 'react';
import { User, Calendar, Droplet, Clock, ChevronRight, AlertCircle, Plus, CheckCircle, Lock, MessageCircle, MapPin, X, Award, BadgeCheck, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getUserProfile,
  subscribeToUserProfile,
  updateDonorStatus,
  subscribeToBloodRequests,
  updateRequestStatus,
  bookAppointment,
  getDonorAppointments,
  cancelAppointment,
  getVenues
} from '../lib/firestore';
import { sendRequestAcceptedNotification } from '../lib/emailService';
import DonorEligibilityQuiz from '../components/DonorEligibilityQuiz';
import { Toaster, toast } from 'react-hot-toast';

export default function DonorDashboard() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [bloodRequests, setBloodRequests] = useState([]);

  // Appointment State
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [venues, setVenues] = useState([]);
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [venueTab, setVenueTab] = useState('hospital'); // 'hospital' or 'camp'
  const [locationFilter, setLocationFilter] = useState('');
  const [userLocation, setUserLocation] = useState(null);

  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [bookingData, setBookingData] = useState({
    venueId: '',
    venueName: '',
    venueType: '',
    date: '',
    timeSlot: ''
  });
  const [isBooking, setIsBooking] = useState(false);

  // Certificate Modal State
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateData, setCertificateData] = useState(null);

  // Form state
  const [bloodType, setBloodType] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');

  // Get User Location for Proximity Sorting
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log("Location access denied or error:", error);
          // Default to NY or just don't sort by distance
        }
      );
    }
  }, []);

  // Helper function to calculate distance
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d.toFixed(1);
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  useEffect(() => {
    let unsubscribe;
    
    async function fetchProfile() {
      if (currentUser) {
        // Initial fetch to show something quickly (optional, but good for perceived speed)
        // Then subscribe for updates
        unsubscribe = subscribeToUserProfile(currentUser.uid, (data) => {
          setProfile(data);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }
    fetchProfile();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, showQuiz]); // Refresh when quiz closes (showQuiz changes)

  // Fetch Appointments & Venues
  useEffect(() => {
    async function loadData() {
      if (currentUser && profile?.isDonor) {
        try {
          const appts = await getDonorAppointments(currentUser.uid);
          setUpcomingAppointments(appts);

          const venueList = await getVenues();
          setVenues(venueList);
        } catch (error) {
          console.error("Error loading dashboard data:", error);
        }
      }
    }
    loadData();
  }, [currentUser, profile]);

  // Filter and Sort Venues
  useEffect(() => {
    let result = venues.filter(v => v.type === venueTab);

    // Filter by Location Search
    if (locationFilter) {
      const search = locationFilter.toLowerCase();
      result = result.filter(v =>
        (typeof v.address === 'string' && v.address.toLowerCase().includes(search)) ||
        (v.name.toLowerCase().includes(search))
      );
    }

    // Sort by Proximity if User Location is available
    if (userLocation) {
      result = result.map(v => {
        let distance = null;
        if (v.location && v.location.lat && v.location.lng) {
          distance = parseFloat(getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, v.location.lat, v.location.lng));
        }
        return { ...v, distance };
      }).sort((a, b) => {
        if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
        if (a.distance !== null) return -1;
        if (b.distance !== null) return 1;
        return 0;
      });
    }

    setFilteredVenues(result);
  }, [venues, venueTab, locationFilter, userLocation]);

  // Listen for real-time blood requests
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToBloodRequests(currentUser.uid, (requests) => {
      // If new request comes in (length increased), show notification
      if (requests.length > bloodRequests.length && requests.length > 0) {
        const latest = requests[0];
        toast((t) => (
          <div className="flex items-start gap-3">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900">Urgent Request!</h4>
              <p className="text-sm text-slate-600 mt-1">
                {latest.seekerName} needs {latest.bloodType} blood.
              </p>
            </div>
          </div>
        ), { duration: 5000, position: 'top-right' });
      }
      setBloodRequests(requests);
    });

    return () => unsubscribe();
  }, [currentUser, bloodRequests.length]);

  const handleRequestResponse = async (requestId, status) => {
    try {
      // If accepting, share phone number (from profile)
      const donorPhone = status === 'accepted' ? (profile?.donorProfile?.phone || null) : null;

      await updateRequestStatus(requestId, status, donorPhone);

      if (status === 'accepted') {
        toast.success(`Request accepted! Seeker will be notified.`);
        
        // Find the request to get Seeker ID
        const request = bloodRequests.find(r => r.id === requestId);
        if (request && request.seekerId) {
             sendRequestAcceptedNotification(request.seekerId, {
                name: profile.name || 'A Donor',
                phone: donorPhone,
                bloodType: profile.donorProfile?.bloodType || 'Unknown'
             });
        }
      } else {
        toast.success(`Request rejected.`);
      }
    } catch (error) {
      console.error("Error updating request:", error);
      toast.error("Failed to update request.");
    }
  };

  const handleRegisterDonor = async (e) => {
    e.preventDefault();
    try {
      await updateDonorStatus(currentUser.uid, {
        bloodType,
        phone,
        city
      });
      // Refresh profile
      const data = await getUserProfile(currentUser.uid);
      setProfile(data);
      setShowRegistration(false);
    } catch (error) {
      console.error("Error registering as donor:", error);
    }
  };

  const handleQuizComplete = async (isEligible) => {
    // Profile will be refreshed by the useEffect dependency on showQuiz when it closes
    // But we can also manually refresh here if needed logic requires it immediately
    const data = await getUserProfile(currentUser.uid);
    setProfile(data);
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!bookingData.venueId || !bookingData.date || !bookingData.timeSlot) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsBooking(true);
    try {
      await bookAppointment({
        donorId: currentUser.uid,
        donorName: profile.name,
        ...bookingData
      });

      toast.success("Appointment Scheduled Successfully!");
      setShowAppointmentModal(false);

      // Refresh list
      const appts = await getDonorAppointments(currentUser.uid);
      setUpcomingAppointments(appts);

      // Reset form
      setBookingData({
        venueId: '',
        venueName: '',
        venueType: '',
        date: '',
        timeSlot: ''
      });
    } catch (error) {
      toast.error(error.message || "Failed to book appointment");
    }
    setIsBooking(false);
  };

  const handleCancelAppointment = async (apptId) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await cancelAppointment(apptId);
      toast.success("Appointment cancelled");
      // Refresh list
      const appts = await getDonorAppointments(currentUser.uid);
      setUpcomingAppointments(appts);
    } catch (error) {
      toast.error("Failed to cancel");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">Please Log In</h2>
        <p className="text-slate-600 mt-2">You need to be logged in to access the dashboard.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAppointmentModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-20"
            >
              <X className="h-6 w-6" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2 sticky top-0 bg-white z-10 pb-2">
              <Calendar className="h-6 w-6 text-brand-500" />
              Schedule Donation
            </h2>

            <form onSubmit={handleBookAppointment} className="space-y-6">

              {/* Step 1: Venue Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Venue</label>

                {/* Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => setVenueTab('hospital')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${venueTab === 'hospital' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    Hospitals
                  </button>
                  <button
                    type="button"
                    onClick={() => setVenueTab('camp')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${venueTab === 'camp' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    Upcoming Camps
                  </button>
                </div>

                {/* Search Filter */}
                <div className="relative mb-4">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-sm"
                    placeholder="Filter by City or Area..."
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  />
                </div>

                {/* Venue List */}
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {filteredVenues.length > 0 ? (
                    filteredVenues.map(v => (
                      <div
                        key={v.id}
                        onClick={() => {
                          setBookingData({
                            ...bookingData,
                            venueId: v.id,
                            venueName: v.name,
                            venueType: v.type
                          });
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all hover:border-brand-300 relative ${bookingData.venueId === v.id
                          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                          : 'border-slate-200 bg-white'
                          }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{v.name}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {typeof v.address === 'string' ? v.address : 'View Map for Location'}
                            </p>
                          </div>
                          {v.distance && (
                            <span className="text-xs font-bold text-blue-600 whitespace-nowrap bg-blue-50 px-2 py-0.5 rounded-full">
                              {v.distance} km
                            </span>
                          )}
                        </div>
                        {bookingData.venueId === v.id && (
                          <div className="absolute top-3 right-3 text-brand-500">
                            <CheckCircle className="h-5 w-5 fill-brand-100" />
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 font-medium">No registered venues found in this area yet.</p>
                      <p className="text-xs text-slate-400">Try a different search term.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Date & Time (Only show if venue selected) */}
              <div className={`transition-all duration-300 ${bookingData.venueId ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      required={!!bookingData.venueId}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-sm"
                      value={bookingData.date}
                      onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Time Slot</label>
                    <select
                      className="w-full p-2.5 rounded-xl border border-slate-200 focus:border-brand-500 outline-none text-sm"
                      value={bookingData.timeSlot}
                      onChange={(e) => setBookingData({ ...bookingData, timeSlot: e.target.value })}
                      required={!!bookingData.venueId}
                    >
                      <option value="">Select Time</option>
                      <option value="10:00 AM">10:00 AM</option>
                      <option value="01:00 PM">01:00 PM</option>
                      <option value="04:00 PM">04:00 PM</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isBooking || !bookingData.venueId}
                  className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isBooking ? 'Checking Availability...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toaster />
      {showQuiz && (
        <DonorEligibilityQuiz
          userId={currentUser.uid}
          onComplete={handleQuizComplete}
          onClose={() => setShowQuiz(false)}
        />
      )}

      {/* Certificate Modal */}
      {showCertificateModal && certificateData && (
        <CertificateModal
          donorName={profile.name}
          venueName={certificateData.venueName}
          date={certificateData.date}
          onClose={() => setShowCertificateModal(false)}
        />
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Welcome back, {profile.name}
            </h1>
            <p className="text-slate-600 mt-1">Here's your donation activity and health overview.</p>
          </div>
          {profile?.isDonor && (
            // ... existing buttons ...
            <div className="flex gap-3">
              {profile?.isEligible ? (
                <button
                  onClick={() => setShowAppointmentModal(true)}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Donation
                </button>
              ) : (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="bg-slate-200 text-slate-500 px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 cursor-not-allowed"
                  title="You must pass the eligibility quiz first"
                >
                  <Lock className="h-4 w-4" />
                  Donate Now
                </button>
              )}

              {!profile?.isEligible && (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="bg-white border-2 border-brand-100 text-brand-600 hover:bg-brand-50 px-6 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Check Eligibility
                </button>
              )}

              {profile?.isEligible && (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="bg-white border-2 border-brand-100 text-brand-600 hover:bg-brand-50 px-6 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Re-check Eligibility
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upcoming Appointments Section */}
        {profile?.isDonor && (
          <MyAppointmentSection
            upcomingAppointments={upcomingAppointments}
            handleCancelAppointment={handleCancelAppointment}
          />
        )}

        {/* Blood Requests Section */}
        {profile?.isDonor && bloodRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-red-600" />
              Incoming Requests ({bloodRequests.length})
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {bloodRequests.map(request => (
                <div key={request.id} className="bg-white border-l-4 border-red-500 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in slide-in-from-top-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">URGENT</span>
                      <span className="text-slate-400 text-xs">{new Date(request.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <h3 className="font-bold text-lg text-slate-900">{request.seekerName} needs {request.bloodType}</h3>
                    <p className="text-sm text-slate-500">Please help if you are available.</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleRequestResponse(request.id, 'rejected')}
                      className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleRequestResponse(request.id, 'accepted')}
                      className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-md shadow-red-100 transition-colors"
                    >
                      Accept & Help
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!profile?.isDonor ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center max-w-2xl mx-auto">
            {!showRegistration ? (
              <>
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="h-8 w-8 text-brand-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Become a Donor</h2>
                <p className="text-slate-600 mb-6">Join our community of life-savers. Registering as a donor takes less than a minute.</p>
                <button
                  onClick={() => setShowRegistration(true)}
                  className="bg-brand-500 hover:bg-brand-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-brand-200 transition-all"
                >
                  Register Now
                </button>
              </>
            ) : (
              <form onSubmit={handleRegisterDonor} className="text-left space-y-4">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Donor Registration</h2>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Blood Type</label>
                  <select
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                  >
                    <option value="">Select Blood Type</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. New York"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRegistration(false)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-md transition-all"
                  >
                    Complete Registration
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard
                icon={<Droplet className="h-6 w-6 text-white" />}
                iconBg="bg-brand-500"
                label="Blood Type"
                value={profile.donorProfile.bloodType}
                subtext="Universal Donor"
              />
              <StatCard
                icon={<User className="h-6 w-6 text-white" />}
                iconBg="bg-blue-500"
                label="Total Donations"
                value={profile.donorProfile.totalDonations}
                subtext="Lives Saved: ~0"
              />
              <StatCard
                icon={<Clock className="h-6 w-6 text-white" />}
                iconBg="bg-emerald-500"
                label="Next Eligible"
                value={profile.isEligible ? 'Now' : 'N/A'}
                subtext={profile.isEligible ? 'You can donate now' : 'Not eligible to donate'}
                isHighlight={profile.isEligible ? true : false}
              />
            </div>

            {/* Donation History */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">Donation History</h2>
              </div>

              {profile.donationHistory && profile.donationHistory.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {[...profile.donationHistory]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((history, index) => (
                      <div key={index} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                            <CheckCircle className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-lg">{history.venueName}</h4>
                            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(history.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-bold text-sm border border-red-200">
                            Blood Type: {history.bloodType}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                            Success
                          </span>
                          <button
                            onClick={() => {
                              setCertificateData(history);
                              setShowCertificateModal(true);
                            }}
                            className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="View Certificate"
                          >
                            <Award className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Droplet className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-600">Your hero journey starts here!</p>
                  <p className="text-sm mt-1">Complete a donation to see your history.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MyAppointmentSection({ upcomingAppointments, handleCancelAppointment }) {
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'cancelled'

  // Filter logic
  const displayedAppointments = upcomingAppointments.filter(appt => {
    if (activeTab === 'upcoming') {
      return appt.status === 'scheduled';
    } else {
      return appt.status === 'cancelled' || appt.status === 'no-show';
    }
  });

  if (upcomingAppointments.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-500" />
          My Appointments
        </h2>

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'upcoming' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('cancelled')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'cancelled' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            Cancelled / Missed
          </button>
        </div>
      </div>

      {displayedAppointments.length === 0 ? (
        <div className="bg-white rounded-xl p-8 border border-dashed border-slate-200 text-center">
          <p className="text-slate-500 font-medium">No {activeTab} appointments found.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {displayedAppointments.map(appt => (
            <div key={appt.id} className={`bg-white rounded-xl p-5 shadow-sm border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${appt.status === 'cancelled' || appt.status === 'no-show' ? 'border-red-100 opacity-80' : 'border-slate-100'
              }`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${appt.status === 'scheduled' ? 'bg-green-100 text-green-700' :
                    appt.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-600'
                    }`}>
                    {appt.status.toUpperCase()}
                  </span>
                  <span className="text-slate-500 text-sm flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(appt.date).toLocaleDateString()} @ {appt.timeSlot}
                  </span>
                </div>
                <h3 className="font-bold text-lg text-slate-900">
                  {appt.venueName}
                </h3>
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" /> {appt.venueType === 'hospital' ? 'Hospital Visit' : 'Donation Camp'}
                </p>
              </div>

              {appt.status === 'scheduled' && (
                <button
                  onClick={() => handleCancelAppointment(appt.id)}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, iconBg, label, value, subtext, isHighlight }) {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border ${isHighlight ? 'border-emerald-200 ring-2 ring-emerald-50' : 'border-slate-100'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className={`text-sm ${isHighlight ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>{subtext}</p>
      </div>
    </div>
  );
}

// Helper component for Heart icon since it was missing in imports
function Heart({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function CertificateModal({ donorName, venueName, date, onClose }) {
  const handleDownload = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      <style>
        {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #certificate-container, #certificate-container * {
                            visibility: visible;
                        }
                        #certificate-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: 100%;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: white;
                            border: none !important;
                        }
                        #certificate-content {
                            border: 4px solid #0f172a !important; 
                            width: 100%;
                            max-width: 800px;
                            margin: 20px;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                `}
      </style>

      <div id="certificate-container" className="bg-white rounded-xl shadow-2xl w-full max-w-2xl relative animate-in zoom-in-95 border-8 border-double border-slate-200 p-2">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10 no-print"
        >
          <X className="h-8 w-8" />
        </button>

        <div id="certificate-content" className="border-4 border-slate-900 p-8 md:p-12 text-center bg-slate-50 relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-32 h-32 border-t-4 border-l-4 border-brand-500 -mt-2 -ml-2"></div>
          <div className="absolute bottom-0 right-0 w-32 h-32 border-b-4 border-r-4 border-brand-500 -mb-2 -mr-2"></div>
          <div className="absolute top-0 right-0 w-32 h-32 border-t-4 border-r-4 border-brand-500 -mt-2 -mr-2"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 border-b-4 border-l-4 border-brand-500 -mb-2 -ml-2"></div>

          <div className="relative z-10">
            <div className="flex justify-center mb-4 relative">
              <Award className="h-20 w-20 text-brand-500" />
              <BadgeCheck className="h-8 w-8 text-yellow-500 absolute -right-4 top-0 fill-yellow-100" />
            </div>

            <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-2 uppercase tracking-wider">
              Certificate
            </h1>
            <h2 className="text-xl md:text-2xl font-serif text-slate-600 mb-8 uppercase tracking-widest">
              of Appreciation
            </h2>

            <p className="text-lg text-slate-600 mb-2">This certificate is proudly presented to</p>

            <div className="text-3xl md:text-4xl font-cursive text-brand-600 mb-6 font-bold italic py-2 border-b-2 border-slate-300 inline-block px-8" style={{ fontFamily: "'Dancing Script', cursive" }}>
              {donorName}
            </div>

            <p className="text-lg text-slate-600 mb-12 max-w-lg mx-auto leading-relaxed">
              For your selfless act of kindness and generosity in donating blood at <strong>{venueName}</strong> on <strong>{new Date(date).toLocaleDateString()}</strong>. Your contribution has helped save lives.
            </p>

            <div className="flex flex-col sm:flex-row justify-between items-end gap-8 mt-auto w-full px-8">
              <div className="text-left">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Certificate ID</p>
                <p className="font-mono text-sm text-slate-600">LF-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider mt-2 mb-1">Date of Issue</p>
                <p className="font-mono text-sm text-slate-600">{new Date().toLocaleDateString()}</p>
              </div>

              <div className="text-center">
                <div className="mb-2">
                  <div className="font-cursive text-2xl text-slate-800 transform -rotate-6" style={{ fontFamily: "'Dancing Script', cursive" }}>Dr. Sameer Kumar</div>
                </div>
                <div className="w-48 border-b border-slate-400 mb-2"></div>
                <p className="text-xs font-bold uppercase text-slate-900 tracking-wider">Chief Medical Officer</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">RedLife Foundation</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center no-print">
          <button
            onClick={handleDownload}
            className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-colors flex items-center gap-2 mx-auto"
          >
            <Download className="h-4 w-4" />
            Download Certificate
          </button>
        </div>
      </div>
    </div>
  );
}
