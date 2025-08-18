import React, { useRef, useEffect, useState } from 'react';

interface ProxyFrameProps {
  url: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const ProxyFrame: React.FC<ProxyFrameProps> = ({ url, onLoad, onError }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [proxyAttempt, setProxyAttempt] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // List of proxy services to try in order
  const proxyServices = [
    // Most reliable proxies first
    (url: string) => `https://cors.bridged.cc/${url}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://cors-anywhere.herokuapp.com/${url}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    // Fallback to direct URL (might work for some sites)
    (url: string) => url
  ];

  const getCurrentProxyUrl = () => {
    if (proxyAttempt < proxyServices.length) {
      return proxyServices[proxyAttempt](url);
    }
    return url; // Fallback to direct URL
  };

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    console.log(`Proxy attempt ${proxyAttempt + 1} failed for ${url}`);
    
    // Try next proxy service
    if (proxyAttempt < proxyServices.length - 1) {
      setProxyAttempt(prev => prev + 1);
      setIsLoading(true);
    } else {
      setIsLoading(false);
      onError?.();
    }
  };

  // Reset proxy attempt when URL changes
  useEffect(() => {
    setProxyAttempt(0);
    setIsLoading(true);
  }, [url]);

  // Update iframe src when proxy attempt changes
  useEffect(() => {
    if (iframeRef.current) {
      const proxyUrl = getCurrentProxyUrl();
      console.log(`Attempting to load ${url} via proxy attempt ${proxyAttempt + 1}: ${proxyUrl}`);
      iframeRef.current.src = proxyUrl;
    }
  }, [proxyAttempt, url]);

  return (
    <>
      {isLoading && (
        <div className="proxy-loading">
          <div className="loading-spinner"></div>
          <p>Loading via proxy (attempt {proxyAttempt + 1}/{proxyServices.length})...</p>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        className="tile-iframe"
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          display: isLoading ? 'none' : 'block',
          width: '100%',
          height: '100%',
          border: 'none'
        }}
      />
    </>
  );
};
