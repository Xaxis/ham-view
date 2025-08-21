# HamView 📡

**Advanced Propagation Tracking Dashboard for Ham Radio Operators**

🌐 **Live Site**: [hamview.com](https://hamview.com)

## Overview

HamView is a modern, real-time propagation tracking and analysis dashboard designed specifically for amateur radio operators. It provides comprehensive insights into HF/VHF/UHF propagation conditions using live data from multiple sources.

## Features

### 🗺️ **Interactive Propagation Map**
- Real-time propagation spots from PSK Reporter
- Great circle path visualization
- Aurora oval overlay with NOAA data
- Maidenhead grid overlay
- Day/night terminator
- Multiple map layers and styles

### 📊 **Solar & Geomagnetic Data**
- Live solar flux index (10.7cm)
- Real-time K-index and A-index
- Solar wind speed and magnetic field data
- X-ray flux monitoring
- Geomagnetic storm alerts

### 🎛️ **Advanced Filtering**
- Band-specific analysis (HF/VHF/UHF)
- Mode filtering (FT8, FT4, PSK31, CW, RTTY, etc.)
- Time range selection
- Callsign-based tracking
- Signal quality thresholds
- Geographic filtering

### 📈 **Analysis Panels**
- Band conditions assessment
- Recent spots with detailed information
- Propagation quality indicators
- Real-time activity monitoring

## Technology Stack

- **Frontend**: Astro + React + TypeScript
- **Mapping**: Leaflet with custom overlays
- **Data Sources**: PSK Reporter, NOAA Space Weather
- **Styling**: Modern CSS with dark/light themes
- **Deployment**: GitHub Pages

## Data Sources

- **PSK Reporter**: Real-time propagation spots
- **NOAA Space Weather**: Solar and geomagnetic data
- **NOAA OVATION Prime**: Aurora oval forecasts

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/username/hamview.git
cd hamview

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building for Production

```bash
# Build the site
npm run build

# Preview the build
npm run preview
```

## Configuration

1. **Station Setup**: Enter your callsign and grid square in Settings
2. **Data Sources**: Configure PSK Reporter and other data sources
3. **Display**: Customize panels, themes, and map layers
4. **Filters**: Set default bands, modes, and time ranges

## Contributing

We welcome contributions! Please see our contributing guidelines for details.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- PSK Reporter for providing real-time propagation data
- NOAA Space Weather Prediction Center for solar/geomagnetic data
- The amateur radio community for feedback and testing

---

**73!** 📻

*HamView - Making propagation data accessible to all hams*