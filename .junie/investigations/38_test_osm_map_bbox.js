// 38_test_osm_map_bbox.js
// Tests the /map?bbox= endpoint on both Dev and Prod OSM API servers.

async function testMapBbox() {
  const devBase = 'https://master.apis.dev.openstreetmap.org/api/0.6';
  const prodBase = 'https://api.openstreetmap.org/api/0.6';

  // London coordinates bbox (approx 50m around 51.5074, -0.1278)
  const minLon = -0.1285;
  const minLat = 51.5070;
  const maxLon = -0.1270;
  const maxLat = 51.5078;

  console.log('Testing GET /map?bbox on Dev API:');
  const devUrl = `${devBase}/map?bbox=${minLon},${minLat},${maxLon},${maxLat}`;
  try {
    const res = await fetch(devUrl, {
      headers: { 'Accept': 'application/xml', 'User-Agent': 'Browsm/0.1.0' }
    });
    console.log(`Dev API /map status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Dev API /map response length: ${text.length} characters`);
    console.log('Dev API sample response:', text.slice(0, 300));
  } catch (err) {
    console.log('Dev API error:', err.message);
  }

  console.log('\nTesting GET /map?bbox on Prod API:');
  const prodUrl = `${prodBase}/map?bbox=${minLon},${minLat},${maxLon},${maxLat}`;
  try {
    const res = await fetch(prodUrl, {
      headers: { 'Accept': 'application/xml', 'User-Agent': 'Browsm/0.1.0' }
    });
    console.log(`Prod API /map status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Prod API /map response length: ${text.length} characters`);
    console.log('Prod API sample response:', text.slice(0, 300));
  } catch (err) {
    console.log('Prod API error:', err.message);
  }
}

testMapBbox();
