import { useState, useEffect } from 'react';
import { CookieManager } from '../lib/cookies';

interface CookieConsentProps {
  onAccept: () => void;
}

export const CookieConsent = ({ onAccept }: CookieConsentProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show banner if no consent cookie exists
    const consent = CookieManager.getCookie('telehash-pirate-consent');
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    CookieManager.setCookie('telehash-pirate-consent', 'accepted');
    setShow(false);
    onAccept();
  };

  const handleDecline = () => {
    CookieManager.setCookie('telehash-pirate-consent', 'declined');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg z-50">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm">
            <span className="font-semibold">🏴‍☠️ Ahoy!</span> We store a unique pirate key in cookies to make your browser its own Telehash Pirate. This key persists your Nostr identity for mining surveys.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors font-medium"
          >
            Accept & Set Sail 🏴‍☠️
          </button>
        </div>
      </div>
    </div>
  );
};