import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

const Chatbot = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! How can I help you today?", sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [chatMode, setChatMode] = useState('normal'); // 'normal' | 'emergency'
  const [emergencyData, setEmergencyData] = useState({ bloodGroup: '', city: '' });
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const getBotResponse = (text) => {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('hello') || lowerText.includes('hi')) {
      return "Hello! I'm here to help you with blood donation queries. Ask me about eligibility, how to donate, or emergency requests.";
    } else if (lowerText.includes('eligible') || lowerText.includes('eligibility')) {
      return "To be eligible to donate blood, you must be 18-65 years old, weigh at least 50kg, and be in good health. Redirecting to the dashboard now, please take the eligibility quiz to see if you are eligible to donate first.";
    } else if (lowerText.includes('donate') || lowerText.includes('donation')) {
      return "You can donate by finding a nearby camp or hospital on our platform. Redirecting to the Camps page now, please register as a donor if you haven't already.";
    } else if (lowerText.includes('emergency')) {
      return "For emergencies, please visit the 'Search' page to find compatible donors immediately or contact local hospitals.";
    } else if (lowerText.includes('where') && lowerText.includes('donate')) {
      return "You can find donation camps near you. Redirecting to the camps page now, please check for upcoming donation events.";
    } else {
      return "I'm not sure I understand. Try asking about 'eligibility', 'donation process', or 'emergency' help.";
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userText = inputValue;
    const newUserMessage = {
      id: Date.now(),
      text: userText,
      sender: 'user'
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputValue("");

    // Use current state for logic, but since we are in a closure, we need to rely on the current render's state.
    // However, if we change state here, the re-render happens. 
    // We will calculate the response logic here to determine state updates.

    setTimeout(async () => {
      let botResponseText = "";
      let newMode = chatMode;
      let newEmergencyData = { ...emergencyData };
      const lowerText = userText.toLowerCase();

      // Step A: Detect panic messages
      if (chatMode === 'normal' && (lowerText.includes("urgent") || lowerText.includes("emergency") || lowerText.includes("need blood") || lowerText.includes("map") || lowerText.includes("help"))) {
        newMode = "emergency";
        setChatMode("emergency");
        botResponseText = "🚨 I’m here to help. Please tell me the required blood group.";
      }
      // Step B: Ask Blood Group
      else if (chatMode === "emergency" && !emergencyData.bloodGroup) {
        // Standardize blood group to uppercase (e.g., "o+" -> "O+")
        const bg = userText.toUpperCase();
        newEmergencyData.bloodGroup = bg;
        setEmergencyData(prev => ({ ...prev, bloodGroup: bg }));
        botResponseText = "Got it. Please tell me your city or location.";
      }
      // Step C: Ask Location
      else if (chatMode === "emergency" && emergencyData.bloodGroup && !emergencyData.city) {
        // Simple Title Case conversion for better matching (e.g. "delhi" -> "Delhi")
        const cityInput = userText.trim();
        const city = cityInput.charAt(0).toUpperCase() + cityInput.slice(1).toLowerCase();

        newEmergencyData.city = city;
        setEmergencyData(prev => ({ ...prev, city: city }));

        try {
          // Query Firestore for matching donors
          // Schema matches ProfileSettings.jsx: isDonor (bool), isEligible (bool), donorProfile.bloodType (string), donorProfile.city (string)
          const q = query(
            collection(db, "users"),
            where("isDonor", "==", true),
            where("isEligible", "==", true),
            where("donorProfile.bloodType", "==", emergencyData.bloodGroup),
            where("donorProfile.city", "==", city)
          );

          const querySnapshot = await getDocs(q);
          const donors = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.donorProfile) {
              donors.push({
                name: data.name || "Anonymous",
                phone: data.donorProfile.phone || "N/A"
              });
            }
          });

          if (donors.length > 0) {
            const donorList = donors.slice(0, 3).map(d => `• ${d.name} (${d.phone})`).join('\n');
            botResponseText = `Found ${donors.length} match(es) in ${city}:\n${donorList}\n\nRedirecting to the map now, please use the search filters to find and contact more donors.`;
          } else {
            botResponseText = `I couldn't find any registered donors for ${emergencyData.bloodGroup} in ${city}. Redirecting to the map now, please try expanding your search area or contacting nearby hospitals directly.`;
          }
        } catch (error) {
          console.error("Error searching donors:", error);
          botResponseText = "Sorry, I encountered an error while searching. Please try again later.";
        }

        // Reset to normal mode
        setChatMode("normal");
        setEmergencyData({ bloodGroup: '', city: '' });

        // Redirect to find blood page (map) with a delay to allow reading
        setTimeout(() => {
          navigate('/search');
        }, 3000);
      }
      else {
        // Normal flow
        botResponseText = getBotResponse(userText);

        // Navigation logic for normal flow with delay
        if (lowerText.includes('where') && lowerText.includes('donate')) {
          setTimeout(() => {
            navigate('/camps');
          }, 3000);
        } else if (lowerText.includes('eligible') || lowerText.includes('eligibility') || lowerText.includes('donate') || lowerText.includes('donation')) {
          setTimeout(() => {
            navigate('/dashboard');
          }, 3000);
        }
      }

      const botResponse = {
        id: Date.now() + 1,
        text: botResponseText,
        sender: 'bot'
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-xl w-80 sm:w-96 h-[500px] flex flex-col mb-4 border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out">
          {/* Header */}
          <div className="bg-red-600 p-4 flex justify-between items-center text-white shrink-0">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageCircle size={20} />
              Support Chat
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-red-700 p-1 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[80%] p-3 rounded-lg text-sm whitespace-pre-wrap ${msg.sender === 'user'
                      ? 'bg-red-600 text-white self-end rounded-br-none'
                      : 'bg-white border border-gray-200 text-gray-800 self-start rounded-bl-none shadow-sm'
                    }`}
                >
                  {msg.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="bg-red-600 text-white p-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 flex items-center justify-center"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
};

export default Chatbot;
