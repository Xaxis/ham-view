import React, { useState, useRef, useEffect } from 'react';

interface WebViewTileProps {
  url: string;
  title: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const WebViewTile: React.FC<WebViewTileProps> = ({ url, title, onLoad, onError }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sites known to block iframes completely
  const blockedSites = [
    'dxview.org',
    'google.com',
    'facebook.com',
    'twitter.com',
    'youtube.com'
  ];

  // Check if this site is known to block iframes
  const isKnownBlocked = () => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return blockedSites.some(blocked => hostname.includes(blocked));
    } catch {
      return false;
    }
  };

  // Progressive enhancement strategies with optimized sandbox settings
  const strategies = [
    {
      name: 'Direct Load',
      getUrl: (url: string) => url,
      sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox'
    },
    {
      name: 'Enhanced Proxy',
      getUrl: (url: string) => {
        // Use different proxies based on site type
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes('dxview.org')) {
          return `https://cors.bridged.cc/${url}`;
        } else if (hostname.includes('pskreporter.info')) {
          return `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        } else if (hostname.includes('qrz.com')) {
          return `https://cors-anywhere.herokuapp.com/${url}`;
        }
        return `https://cors.bridged.cc/${url}`;
      },
      sandbox: 'allow-scripts allow-same-origin allow-forms'
    },
    {
      name: 'Mobile/Lite Version',
      getUrl: (url: string) => {
        try {
          const urlObj = new URL(url);
          if (urlObj.hostname.includes('dxview.org')) {
            return url.replace('hf.dxview.org', 'm.dxview.org');
          } else if (urlObj.hostname.includes('qrz.com')) {
            return url.replace('www.qrz.com', 'm.qrz.com');
          }
          return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        } catch {
          return url;
        }
      },
      sandbox: 'allow-scripts allow-same-origin'
    },
    {
      name: 'Read-Only Mode',
      getUrl: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      sandbox: 'allow-same-origin'
    }
  ];

  const currentUrl = strategies[currentStrategy]?.getUrl(url) || url;
  const currentSandbox = strategies[currentStrategy]?.sandbox || 'allow-scripts allow-same-origin';

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    console.log(`Strategy ${currentStrategy + 1} failed: ${strategies[currentStrategy]?.name}`);

    // Check if this is an X-Frame-Options block
    if (currentStrategy === 0) {
      // First strategy failed - likely X-Frame-Options
      setIsBlocked(true);
    }

    if (currentStrategy < strategies.length - 1) {
      setCurrentStrategy(prev => prev + 1);
      setIsLoading(true);
      setHasError(false);
    } else {
      setIsLoading(false);
      setHasError(true);
      onError?.();
    }
  };

  const handleRetry = () => {
    setCurrentStrategy(0);
    setIsLoading(true);
    setHasError(false);
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleFullScreen = () => {
    // Open in a popup window sized for optimal viewing
    const width = Math.min(1400, window.screen.width * 0.9);
    const height = Math.min(900, window.screen.height * 0.9);
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    window.open(
      url,
      'hamview_fullscreen',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no`
    );
  };

  // Reset when URL changes
  useEffect(() => {
    setCurrentStrategy(0);
    setIsLoading(true);
    setHasError(false);
    setIsBlocked(false);

    // If this is a known blocked site, skip iframe attempts
    if (isKnownBlocked()) {
      setIsLoading(false);
      setHasError(true);
      setIsBlocked(true);
    }
  }, [url]);

  // Update iframe when strategy changes
  useEffect(() => {
    if (iframeRef.current && !hasError) {
      const newUrl = strategies[currentStrategy]?.getUrl(url) || url;
      console.log(`🔄 Ham View: Trying strategy ${currentStrategy + 1}: ${strategies[currentStrategy]?.name} - ${newUrl}`);
      iframeRef.current.src = newUrl;
    }
  }, [currentStrategy, url, hasError]);

  if (hasError) {
    return (
      <div className="webview-error">
        <div className="error-content">
          <div className="error-icon">{isBlocked ? '🚫' : '🌐'}</div>
          <h3>{title}</h3>
          {isBlocked ? (
            <div>
              <p><strong>Iframe Blocked</strong></p>
              <p>This site blocks embedding for security reasons</p>
              <small>Use Full Screen or New Tab for complete functionality</small>
            </div>
          ) : (
            <p>This site requires full browser features</p>
          )}
          <div className="error-actions">
            {!isBlocked && (
              <button className="retry-btn" onClick={handleRetry}>
                Try Again
              </button>
            )}
            <button className="external-btn" onClick={handleFullScreen}>
              Full Screen
            </button>
            <button className="external-btn" onClick={handleOpenExternal}>
              New Tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="webview-container">
      {isLoading && (
        <div className="webview-loading">
          <div className="loading-spinner"></div>
          <p>Loading {title}...</p>
          <small>Strategy {currentStrategy + 1}/{strategies.length}: {strategies[currentStrategy]?.name}</small>
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        className="webview-iframe"
        onLoad={handleLoad}
        onError={handleError}
        sandbox={currentSandbox}
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          display: isLoading ? 'none' : 'block',
          width: '100%',
          height: '100%',
          border: 'none'
        }}
      />
    </div>
  );
};
