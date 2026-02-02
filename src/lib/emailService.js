import emailjs from '@emailjs/browser';
import { getUserProfile } from './firestore';

// Initialize EmailJS with your Public Key
// You should store these in your .env file
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'your_service_id';
const REQUEST_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_REQUEST_TEMPLATE_ID || 'template_32tcqmi';
const ACCEPTANCE_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_ACCEPTANCE_TEMPLATE_ID || 'template_il7a1m8';
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'your_public_key';

/**
 * Sends a blood request notification to multiple donors.
 * @param {Array} donors - List of donor objects (must contain email)
 * @param {Object} requestDetails - { bloodType, location, urgency, seekerName, link }
 */
export const sendBloodRequestNotification = async (donors, requestDetails) => {
  if (!donors || donors.length === 0) return;

  console.log(`Attempting to send emails to ${donors.length} donors...`);

  // EmailJS limits might apply, so be careful with large lists in production.
  // For client-side, we iterate.
  const promises = donors.map(donor => {
    // Check if donor has an email (and maybe skip if it's the current user/seeker? handled by caller)
    if (!donor.email) return Promise.resolve();

    const templateParams = {
      to_email: donor.email,
      to_name: donor.name || 'Hero',
      blood_type: requestDetails.bloodType,
      urgency: requestDetails.urgency || 'High',
      seeker_name: requestDetails.seekerName,
      action_link: requestDetails.link || `${window.location.origin}/dashboard`,
      message: `A seeker needs ${requestDetails.bloodType} blood immediately.`
    };

    return emailjs.send(SERVICE_ID, REQUEST_TEMPLATE_ID, templateParams, PUBLIC_KEY)
      .then(response => {
        console.log('SUCCESS!', response.status, response.text);
        return { success: true, email: donor.email };
      })
      .catch(err => {
        console.log('FAILED...', err);
        return { success: false, email: donor.email, error: err };
      });
  });

  return Promise.all(promises);
};

/**
 * Sends a notification to the seeker when a donor accepts their request.
 * @param {string} seekerId - The UID of the seeker
 * @param {Object} donorDetails - { name, phone, bloodType }
 */
export const sendRequestAcceptedNotification = async (seekerId, donorDetails) => {
  try {
    // 1. Fetch Seeker's Email
    const seekerProfile = await getUserProfile(seekerId);
    
    if (!seekerProfile || !seekerProfile.email) {
      console.error("Seeker profile or email not found.");
      return;
    }

    const templateParams = {
      to_email: seekerProfile.email,
      to_name: seekerProfile.name || 'Seeker',
      donor_name: donorDetails.name,
      donor_phone: donorDetails.phone || 'Not shared',
      blood_type: donorDetails.bloodType,
      next_steps: 'Please contact the donor immediately to coordinate the donation. Time is of the essence!',
      action_link: `${window.location.origin}/search`
    };

    const response = await emailjs.send(SERVICE_ID, ACCEPTANCE_TEMPLATE_ID, templateParams, PUBLIC_KEY);
    console.log('Accepted Notification Sent!', response.status, response.text);
    return response;

  } catch (error) {
    console.error("Error sending acceptance notification:", error);
    // Don't throw, just log, so UI doesn't break
  }
};
