const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// PSK Reporter proxy endpoint
app.get('/api/pskreporter', async (req, res) => {
  try {
    console.log('🌐 Proxying PSK Reporter request:', req.query);
    
    // Build the PSK Reporter URL with query parameters
    const baseUrl = 'https://retrieve.pskreporter.info/query';
    const params = new URLSearchParams(req.query);
    const url = `${baseUrl}?${params}`;
    
    console.log('📡 Fetching from PSK Reporter:', url);
    
    // Fetch from PSK Reporter
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PropView/1.0 (Ham Radio Propagation Viewer)',
        'Accept': 'application/xml, text/xml, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`PSK Reporter API error: ${response.status} ${response.statusText}`);
    }
    
    const xmlData = await response.text();
    console.log(`✅ PSK Reporter returned ${xmlData.length} characters of XML data`);
    
    // Set proper headers and return the XML
    res.set({
      'Content-Type': 'application/xml',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    res.send(xmlData);
    
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message 
    });
  }
});

// NOAA Space Weather proxy endpoint
app.get('/api/noaa/:endpoint', async (req, res) => {
  try {
    const endpoint = req.params.endpoint;
    const url = `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`;
    
    console.log('🌐 Proxying NOAA request:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json(data);
    
  } catch (error) {
    console.error('❌ NOAA proxy error:', error);
    res.status(500).json({ 
      error: 'NOAA proxy error', 
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'PropView Proxy Server Running' });
});

app.listen(PORT, () => {
  console.log(`🚀 PropView Proxy Server running on http://localhost:${PORT}`);
  console.log(`📡 PSK Reporter proxy: http://localhost:${PORT}/api/pskreporter`);
  console.log(`🌤️  NOAA proxy: http://localhost:${PORT}/api/noaa/k-index`);
});
