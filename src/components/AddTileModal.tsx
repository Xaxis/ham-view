import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { TileConfig } from '../types';

export const AddTileModal: React.FC = () => {
  const { addTile, dispatch } = useApp();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    dispatch({ type: 'TOGGLE_ADD_TILE_MODAL', isOpen: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) return;

    setIsSubmitting(true);

    try {
      // Validate and normalize URL
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }

      // Validate URL format
      new URL(normalizedUrl);

      const tileConfig: TileConfig = {
        url: normalizedUrl,
        title: title.trim() || new URL(normalizedUrl).hostname,
      };

      addTile(tileConfig);
      handleClose();
    } catch (error) {
      alert('Please enter a valid URL');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    
    // Auto-generate title from hostname if title is empty
    if (!title && newUrl) {
      try {
        let normalizedUrl = newUrl.trim();
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          normalizedUrl = 'https://' + normalizedUrl;
        }
        const hostname = new URL(normalizedUrl).hostname;
        setTitle(hostname);
      } catch {
        // Invalid URL, don't auto-generate title
      }
    }
  };

  // Comprehensive list of ham radio and space weather sites
  const siteCategories = {
    'DX & Propagation': [
      { url: 'https://dxview.org', title: 'DX View' },
      { url: 'https://pskreporter.info/pskmap.html', title: 'PSK Reporter' },
      { url: 'https://voacap.com/hf', title: 'VOACAP' },
      { url: 'https://www.dxsummit.fi', title: 'DX Summit' },
      { url: 'https://dxwatch.com', title: 'DX Watch' },
      { url: 'https://www.hamqsl.com/solar.html', title: 'Solar Conditions' },
      { url: 'https://prop.kc2g.com', title: 'KC2G Propagation' },
      { url: 'https://www.dxlc.com', title: 'DX Live Cluster' },
    ],
    'Space Weather': [
      { url: 'https://www.spaceweather.gov', title: 'NOAA Space Weather' },
      { url: 'https://spaceweather.com', title: 'SpaceWeather.com' },
      { url: 'https://www.solarham.net', title: 'SolarHam' },
      { url: 'https://www.n3kl.org/sun/noaa.html', title: 'N3KL Solar Data' },
      { url: 'https://www.swpc.noaa.gov/products/solar-cycle-progression', title: 'Solar Cycle' },
      { url: 'https://services.swpc.noaa.gov/images/animations/suvi/primary/map/', title: 'Solar Images' },
    ],
    'QSL & Logging': [
      { url: 'https://qrz.com', title: 'QRZ.com' },
      { url: 'https://eqsl.cc', title: 'eQSL' },
      { url: 'https://hamqsl.com', title: 'HamQSL' },
      { url: 'https://lotw.arrl.org', title: 'LoTW' },
      { url: 'https://clublog.org', title: 'Club Log' },
      { url: 'https://qsl.net', title: 'QSL.net' },
      { url: 'https://www.qslinfo.de', title: 'QSL Info' },
    ],
    'Contest & Awards': [
      { url: 'https://www.contestcalendar.com', title: 'Contest Calendar' },
      { url: 'https://www.cqww.com', title: 'CQ WW' },
      { url: 'https://www.arrl.org/contests', title: 'ARRL Contests' },
      { url: 'https://www.cqwpx.com', title: 'CQ WPX' },
      { url: 'https://www.dxcc.org', title: 'DXCC' },
      { url: 'https://www.waz-award.net', title: 'WAZ Award' },
    ],
    'Digital Modes': [
      { url: 'https://pskreporter.info/pskmap.html', title: 'PSK Reporter' },
      { url: 'https://www.ft8activity.eu', title: 'FT8 Activity' },
      { url: 'https://www.aprs.fi', title: 'APRS.fi' },
      { url: 'https://aprs.org', title: 'APRS.org' },
      { url: 'https://www.winlink.org', title: 'Winlink' },
      { url: 'https://js8call.com', title: 'JS8Call' },
    ],
    'Repeaters & Nets': [
      { url: 'https://www.radiorepeater.com', title: 'Radio Repeater' },
      { url: 'https://www.repeaterbook.com', title: 'RepeaterBook' },
      { url: 'https://www.radio-electronics.com/info/antennas/repeater/repeater-directory.php', title: 'Repeater Directory' },
      { url: 'https://netlogger.org', title: 'Net Logger' },
    ],
    'Satellites': [
      { url: 'https://www.amsat.org', title: 'AMSAT' },
      { url: 'https://www.n2yo.com', title: 'N2YO Satellite Tracker' },
      { url: 'https://www.heavens-above.com', title: 'Heavens Above' },
      { url: 'https://www.satflare.com', title: 'SatFlare' },
      { url: 'https://amsat-uk.org', title: 'AMSAT-UK' },
    ],
    'News & Information': [
      { url: 'https://www.arrl.org', title: 'ARRL' },
      { url: 'https://www.southgatearc.org', title: 'Southgate ARC' },
      { url: 'https://www.eham.net', title: 'eHam.net' },
      { url: 'https://www.qrznow.com', title: 'QRZ Now' },
      { url: 'https://www.cq-amateur-radio.com', title: 'CQ Magazine' },
      { url: 'https://www.qst.com', title: 'QST Magazine' },
    ],
    'Tools & Calculators': [
      { url: 'https://www.qsl.net/w5www/antcalc.html', title: 'Antenna Calculator' },
      { url: 'https://www.changpuak.ch/electronics/calc_11.php', title: 'Coil Calculator' },
      { url: 'https://www.1728.org/freqwave.htm', title: 'Frequency/Wavelength' },
      { url: 'https://www.rf-tools.com', title: 'RF Tools' },
      { url: 'https://www.pasternack.com/t-calculator-index.aspx', title: 'RF Calculators' },
    ]
  };

  const handleQuickAdd = (site: { url: string; title: string }) => {
    setUrl(site.url);
    setTitle(site.title);
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <img src="/ham-view/logo.png" alt="Ham View" className="modal-logo" />
            <h2>Add New View</h2>
          </div>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <div className="modal-content">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="url">URL:</label>
              <input
                type="text"
                id="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://example.com"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="title">Title (optional):</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Custom title for this view"
              />
            </div>

            <div className="iframe-info">
              <div className="info-icon">ℹ️</div>
              <div className="info-content">
                <p><strong>Note:</strong> Some websites may not display properly in tiles due to security restrictions. Links within sites may open in new tabs instead of staying within the tile view.</p>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!url.trim() || isSubmitting}
              >
                {isSubmitting ? 'Adding...' : 'Add View'}
              </button>
            </div>
          </form>

          <div className="quick-add-section">
            <h3>Ham Radio & Space Weather Sites</h3>
            <div className="site-categories">
              {Object.entries(siteCategories).map(([category, sites]) => (
                <div key={category} className="category-section">
                  <h4 className="category-title">{category}</h4>
                  <div className="quick-add-grid">
                    {sites.map((site) => (
                      <button
                        key={site.url}
                        type="button"
                        className="quick-add-btn"
                        onClick={() => handleQuickAdd(site)}
                        title={site.url}
                      >
                        {site.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
