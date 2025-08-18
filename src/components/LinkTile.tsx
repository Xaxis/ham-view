import React from 'react';

interface LinkTileProps {
  url: string;
  title: string;
  description?: string;
  favicon?: string;
}

export const LinkTile: React.FC<LinkTileProps> = ({ url, title, description, favicon }) => {
  const handleClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getDomainInfo = () => {
    try {
      const urlObj = new URL(url);
      return {
        hostname: urlObj.hostname,
        favicon: favicon || `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
      };
    } catch {
      return { hostname: 'Unknown', favicon: '' };
    }
  };

  const { hostname, favicon: defaultFavicon } = getDomainInfo();

  return (
    <div className="link-tile" onClick={handleClick}>
      <div className="link-tile-content">
        <div className="link-tile-icon">
          <img 
            src={favicon || defaultFavicon} 
            alt={`${title} icon`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/favicon.png';
            }}
          />
        </div>
        
        <div className="link-tile-info">
          <h3 className="link-tile-title">{title}</h3>
          <p className="link-tile-hostname">{hostname}</p>
          {description && (
            <p className="link-tile-description">{description}</p>
          )}
        </div>
        
        <div className="link-tile-action">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15,3 21,3 21,9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>
      </div>
      
      <div className="link-tile-overlay">
        <span>Click to open in new tab</span>
      </div>
    </div>
  );
};
