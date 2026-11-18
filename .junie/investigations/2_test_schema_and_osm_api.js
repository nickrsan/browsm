// Investigation 2: Test OSM API 0.6 bbox query and sample JSON-LD parsing
async function testOsmBbox() {
  // Test a small bounding box query against openstreetmap.org API 0.6
  // Coordinates around a known POI: Newport, RI (-71.3128, 41.4901)
  const minLon = -71.3138;
  const minLat = 41.4895;
  const maxLon = -71.3118;
  const maxLat = 41.4907;

  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${minLon},${minLat},${maxLon},${maxLat}`;
  console.log('Testing OSM API 0.6 bbox:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Browsm/0.1.0 (Testing investigation script)',
      },
    });
    console.log('OSM API response status:', res.status, res.headers.get('content-type'));
    if (res.ok) {
      const xml = await res.text();
      console.log('XML snippet (first 500 chars):\n', xml.substring(0, 500));
      const nodeCount = (xml.match(/<node /g) || []).length;
      const wayCount = (xml.match(/<way /g) || []).length;
      const tagCount = (xml.match(/<tag /g) || []).length;
      console.log(`Parsed count: ${nodeCount} nodes, ${wayCount} ways, ${tagCount} tags`);
    }
  } catch (err) {
    console.error('OSM API fetch failed:', err.message);
  }
}

testOsmBbox();
