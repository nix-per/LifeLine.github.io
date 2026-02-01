import React from 'react';
import { ArrowRight, Activity, Users, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { userRole } = useAuth();

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-50 to-red-50 py-20 lg:py-32 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-brand-100 rounded-full blur-3xl opacity-50"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
              Donate Blood, <span className="text-brand-500">Save Lives</span>
            </h1>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed">
              Connect with donors and find blood in emergencies. LifeLine makes the process of blood donation and retrieval seamless, secure, and fast.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/search" className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full text-white bg-brand-500 hover:bg-brand-600 shadow-lg hover:shadow-brand-300 transition-all transform hover:-translate-y-1">
                Find Blood Now
              </Link>

              {/* Conditional Button based on Role */}
              {(userRole === 'hospital' || userRole === 'organizer') ? (
                <Link
                  to={userRole === 'hospital' ? "/hospital-dashboard" : "/organizer"}
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full text-brand-600 bg-white border-2 border-brand-100 hover:border-brand-200 hover:bg-brand-50 shadow-sm transition-all"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <Link to="/dashboard" className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full text-brand-600 bg-white border-2 border-brand-100 hover:border-brand-200 hover:bg-brand-50 shadow-sm transition-all">
                  Become a Donor
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How Blood Donation Works Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">How Blood Donation Works</h2>
            <p className="mt-4 text-xl text-slate-600 max-w-2xl mx-auto">A simple 3-step process to saving a life.</p>
          </div>

          <div className="relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-red-100 via-red-200 to-red-100 -translate-y-1/2 z-0 rounded-full"></div>
            
            <div className="grid md:grid-cols-3 gap-12 relative z-10">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center group">
                <div className="w-24 h-24 bg-white border-4 border-red-100 rounded-full flex items-center justify-center shadow-lg mb-8 relative transition-all duration-300 group-hover:border-brand-400 group-hover:scale-110">
                  <span className="text-4xl font-bold text-brand-500 group-hover:text-brand-600">1</span>
                  <div className="absolute -bottom-3 bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">REGISTER</div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">Registration Process</h3>
                <p className="text-slate-600 leading-relaxed px-4">
                  Sign up and schedule your first donation with ease. It takes less than 10 minutes.
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center group">
                <div className="w-24 h-24 bg-white border-4 border-red-100 rounded-full flex items-center justify-center shadow-lg mb-8 relative transition-all duration-300 group-hover:border-brand-400 group-hover:scale-110">
                  <span className="text-4xl font-bold text-brand-500 group-hover:text-brand-600">2</span>
                  <div className="absolute -bottom-3 bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">SCREENING</div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">Health Screening</h3>
                <p className="text-slate-600 leading-relaxed px-4">
                  A simple check-up to ensure you’re ready to donate. We check your pulse, blood pressure, and hemoglobin.
                </p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center group">
                <div className="w-24 h-24 bg-white border-4 border-red-100 rounded-full flex items-center justify-center shadow-lg mb-8 relative transition-all duration-300 group-hover:border-brand-400 group-hover:scale-110">
                  <span className="text-4xl font-bold text-brand-500 group-hover:text-brand-600">3</span>
                  <div className="absolute -bottom-3 bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">DONATE</div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-4">Donation Day</h3>
                <p className="text-slate-600 leading-relaxed px-4">
                  Relax as our professional staff guide you through. The actual donation takes just 8-10 minutes.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-20 text-center">
            <Link to="/camps" className="inline-flex items-center justify-center px-10 py-4 text-lg font-bold rounded-full text-white bg-slate-900 hover:bg-slate-800 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1">
              Start Your Journey <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Why Choose LifeLine?</h2>
            <p className="mt-4 text-lg text-slate-600">We bridge the gap between donors and those in need.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <FeatureCard
              icon={<Activity className="h-10 w-10 text-brand-500" />}
              title="Real-time Availability"
              description="Check blood availability in real-time from verified donors and blood banks near you."
            />
            <FeatureCard
              icon={<Users className="h-10 w-10 text-brand-500" />}
              title="Community Driven"
              description="Join a growing community of life-savers. Every donation makes a difference."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-10 w-10 text-brand-500" />}
              title="Verified & Secure"
              description="All donors and requests are verified to ensure safety and trust in the platform."
            />
          </div>
        </div>
      </section>

      {/* Benefits of Blood Donation Section */}
      <section className="py-20 bg-slate-50 border-t border-slate-200 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 relative z-10">
            <h2 className="text-3xl font-bold text-slate-900">Benefits of Blood Donation</h2>
            <p className="mt-4 text-lg text-slate-600">Giving blood helps others and is good for you too.</p>
          </div>

          {/* Floating Bubbles Container */}
          <div className="flex flex-wrap justify-center items-center gap-2 max-w-4xl mx-auto py-10 relative">
            
            {/* Mixed Bubbles */}
            {[
              { type: 'benefit', text: 'Saves 3 Lives' },
              { type: 'group', text: 'O+' },
              { type: 'benefit', text: 'Free Health Checkup' },
              { type: 'group', text: 'A-' },
              { type: 'benefit', text: 'Reduces Cancer Risk' },
              { type: 'group', text: 'B+' },
              { type: 'benefit', text: 'Improves Heart Health' },
              { type: 'group', text: 'AB+' },
              { type: 'benefit', text: 'Burns Calories' },
              { type: 'group', text: 'O-' },
              { type: 'benefit', text: 'New Blood Cells' },
              { type: 'group', text: 'A+' },
              { type: 'benefit', text: 'Mental Well-being' },
              { type: 'group', text: 'B-' },
              { type: 'benefit', text: 'Community Impact' },
              { type: 'group', text: 'AB-' },
              { type: 'benefit', text: 'Free Blood Analysis' },
              { type: 'benefit', text: 'Lower Cholesterol' },
            ].map((item, index) => {
               // Deterministic random-like delay based on index
               const delay = `${(index * 0.2) % 2}s`;
               const isBenefit = item.type === 'benefit';
               
               // Staggered layout logic
               let positionClass = '';
               if (index % 3 === 0) positionClass = 'mt-8';
               if (index % 3 === 1) positionClass = '-mt-4';
               
               return (
                 <div
                   key={index}
                   className={`
                     animate-float flex items-center justify-center text-center rounded-full shadow-sm hover:shadow-xl transition-all duration-300 cursor-default border border-red-200
                     ${positionClass}
                     ${isBenefit 
                        ? 'w-32 h-32 md:w-40 md:h-40 bg-red-50 text-red-900 font-bold text-sm md:text-base p-4 z-10 hover:bg-red-100 hover:scale-105' 
                        : 'w-12 h-12 md:w-16 md:h-16 bg-red-200 text-red-900 font-bold text-xs md:text-sm z-0 hover:bg-red-300 hover:scale-110 opacity-90'
                     }
                   `}
                   style={{ animationDelay: delay }}
                 >
                   {item.text}
                 </div>
               );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-brand-100 shadow-sm hover:shadow-xl transition-all duration-300 group">
      <div className="mb-6 bg-white w-16 h-16 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
