import React, { useState, useEffect } from 'react';
import { User, Calendar, Droplet, Clock, ChevronRight, AlertCircle, Plus, CheckCircle, Lock, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, updateDonorStatus, subscribeToBloodRequests, updateRequestStatus } from '../lib/firestore';
import DonorEligibilityQuiz from '../components/DonorEligibilityQuiz';
import { Toaster, toast } from 'react-hot-toast';

export default function DonorDashboard() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [bloodRequests, setBloodRequests] = useState([]);

  // Form state
  const [bloodType, setBloodType] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      if (currentUser) {
        const data = await getUserProfile(currentUser.uid);
        setProfile(data);
      }
      setLoading(false);
    }
    fetchProfile();
  }, [currentUser, showQuiz]); // Refresh when quiz closes (showQuiz changes)

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
      <Toaster />
      {showQuiz && (
        <DonorEligibilityQuiz
          userId={currentUser.uid}
          onComplete={handleQuizComplete}
          onClose={() => setShowQuiz(false)}
        />
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Welcome back, {currentUser.email}</h1>
            <p className="text-slate-600 mt-1">Here's your donation activity and health overview.</p>
          </div>
          {profile?.isDonor && (
            <div className="flex gap-3">
              {profile?.isEligible ? (
                <button className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2">
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
            </div>
          )}
        </div>

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

            {/* Donation History Placeholder */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">Donation History</h2>
              </div>
              <div className="p-8 text-center text-slate-500">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p>No donation history yet. Schedule your first donation today!</p>
              </div>
            </div>
          </>
        )}
      </div>
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
