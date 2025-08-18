import React, { useState, useRef, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import type { TileState, Position, Size } from '../types';
import { WebViewTile } from './WebViewTile';

interface TileProps {
  tile: TileState;
  onUpdate: (id: string, updates: Partial<TileState>) => void;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  isActive: boolean;
}

export const Tile: React.FC<TileProps> = ({
  tile,
  onUpdate,
  onClose,
  onFocus,
  isActive
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleDragStop = useCallback((e: any, data: any) => {
    const newPosition: Position = { x: data.x, y: data.y };
    onUpdate(tile.id, { position: newPosition });
  }, [tile.id, onUpdate]);

  const handleResizeStop = useCallback((
    e: any,
    direction: any,
    ref: any,
    delta: any,
    position: any
  ) => {
    const newSize: Size = {
      width: parseInt(ref.style.width),
      height: parseInt(ref.style.height)
    };
    const newPosition: Position = { x: position.x, y: position.y };
    
    onUpdate(tile.id, { 
      size: newSize, 
      position: newPosition 
    });
  }, [tile.id, onUpdate]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onUpdate(tile.id, { isLoading: false, hasError: false });

    // Try to inject script to handle navigation within iframe
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        // Add event listener for navigation attempts
        iframe.contentWindow.addEventListener('beforeunload', (e) => {
          // This will be triggered when the iframe tries to navigate
          console.log('Navigation attempt detected in iframe');
        });

        // Try to override window.open in the iframe context
        const script = iframe.contentDocument?.createElement('script');
        if (script) {
          script.textContent = `
            (function() {
              const originalOpen = window.open;
              window.open = function(url, target, features) {
                // Force links to open in the same iframe instead of new tabs
                if (target === '_blank' || target === '_new') {
                  window.location.href = url;
                  return null;
                }
                return originalOpen.call(this, url, target, features);
              };

              // Override target="_blank" links
              document.addEventListener('click', function(e) {
                const link = e.target.closest('a');
                if (link && link.target === '_blank') {
                  e.preventDefault();
                  window.location.href = link.href;
                }
              });
            })();
          `;
          iframe.contentDocument?.head?.appendChild(script);
        }
      }
    } catch (error) {
      // Cross-origin restrictions prevent this, which is expected
      console.log('Cannot inject navigation handler due to CORS restrictions');
    }
  }, [tile.id, onUpdate]);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onUpdate(tile.id, { 
      isLoading: false, 
      hasError: true, 
      errorMessage: 'Failed to load content' 
    });
  }, [tile.id, onUpdate]);

  const handleMinimize = useCallback(() => {
    onUpdate(tile.id, { isMinimized: !tile.isMinimized });
  }, [tile.id, tile.isMinimized, onUpdate]);

  const handleMaximize = useCallback(() => {
    onUpdate(tile.id, { isMaximized: !tile.isMaximized });
  }, [tile.id, tile.isMaximized, onUpdate]);

  const handleMouseDown = useCallback(() => {
    onFocus(tile.id);
  }, [tile.id, onFocus]);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      iframeRef.current.src = tile.url;
    }
  }, [tile.url]);

  const handleOpenInNewTab = useCallback(() => {
    // Use original URL if available, otherwise use the current URL
    const urlToOpen = tile.originalUrl || tile.url;
    window.open(urlToOpen, '_blank', 'noopener,noreferrer');
  }, [tile.url, tile.originalUrl]);

  const handleTryProxy = useCallback(() => {
    const originalUrl = tile.originalUrl || tile.url;
    const hostname = new URL(originalUrl).hostname.toLowerCase();

    let proxyUrl: string;

    // Try different proxy strategies
    if (hostname.includes('dxview.org')) {
      // For DX View, try the mobile version first
      proxyUrl = originalUrl.replace('hf.dxview.org', 'm.dxview.org');
    } else if (hostname.includes('pskreporter.info')) {
      proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(originalUrl)}`;
    } else {
      // Try a different proxy service
      proxyUrl = `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`;
    }

    setIsLoading(true);
    setHasError(false);

    if (iframeRef.current) {
      iframeRef.current.src = proxyUrl;
    }
  }, [tile.url, tile.originalUrl]);

  // Calculate actual size and position based on state
  const actualSize = tile.isMaximized 
    ? { width: '100vw', height: '100vh' }
    : tile.size;
  
  const actualPosition = tile.isMaximized 
    ? { x: 0, y: 0 }
    : tile.position;

  return (
    <Rnd
      size={actualSize}
      position={actualPosition}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onMouseDown={handleMouseDown}
      minWidth={200}
      minHeight={150}
      bounds="parent"
      dragHandleClassName="tile-header"
      className={`tile ${isActive ? 'tile-active' : ''} ${tile.isMinimized ? 'tile-minimized' : ''}`}
      style={{ zIndex: tile.zIndex }}
      disableDragging={tile.isMaximized}
      enableResizing={!tile.isMaximized && !tile.isMinimized}
    >
      <div className="tile-container">
        {/* Tile Header */}
        <div className="tile-header">
          <div className="tile-title" title={tile.originalUrl || tile.url}>
            {tile.title || new URL(tile.originalUrl || tile.url).hostname}
            {tile.isProxied && <span className="proxy-badge">PROXY</span>}
          </div>
          <div className="tile-controls">
            <button
              className="tile-control-btn fullscreen"
              onClick={() => {
                const url = tile.originalUrl || tile.url;
                const width = Math.min(1400, window.screen.width * 0.9);
                const height = Math.min(900, window.screen.height * 0.9);
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;
                window.open(
                  url,
                  'hamview_fullscreen',
                  `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no`
                );
              }}
              title="Open in full screen popup"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            </button>
            <button
              className="tile-control-btn open-external"
              onClick={handleOpenInNewTab}
              title="Open in new tab"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
            <button
              className="tile-control-btn refresh"
              onClick={handleRefresh}
              title="Refresh"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            </button>
            <button
              className="tile-control-btn minimize"
              onClick={handleMinimize}
              title={tile.isMinimized ? 'Restore' : 'Minimize'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button
              className="tile-control-btn maximize"
              onClick={handleMaximize}
              title={tile.isMaximized ? 'Restore' : 'Maximize'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {tile.isMaximized ? (
                  <>
                    <polyline points="4 14 10 14 10 20"/>
                    <polyline points="20 10 14 10 14 4"/>
                  </>
                ) : (
                  <rect x="3" y="3" width="18" height="18"/>
                )}
              </svg>
            </button>
            <button
              className="tile-control-btn close"
              onClick={() => onClose(tile.id)}
              title="Close"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tile Content */}
        {!tile.isMinimized && (
          <div className="tile-content">
            <WebViewTile
              url={tile.originalUrl || tile.url}
              title={tile.title}
              onLoad={() => {
                setIsLoading(false);
                setHasError(false);
              }}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          </div>
        )}
      </div>
    </Rnd>
  );
};
