// 34_test_osm_api_routes.js
// Tests OSM API endpoints for creating changesets, creating nodes, updating nodes, diff upload, etc.

async function testEndpoints() {
  const devBase = 'https://master.apis.dev.openstreetmap.org/api/0.6';
  const prodBase = 'https://api.openstreetmap.org/api/0.6';

  console.log('Testing OSM API routes...');

  // Check OPTIONS or unauthenticated requests to various routes to check HTTP status codes (e.g. 401 Unauthorized vs 404 Not Found vs 405 Method Not Allowed)

  const testUrls = [
    // Changeset create
    { method: 'PUT', url: `${devBase}/changeset/create` },
    { method: 'POST', url: `${devBase}/changeset/create` },
    // Node create
    { method: 'PUT', url: `${devBase}/node/create` },
    { method: 'POST', url: `${devBase}/node/create` },
    { method: 'POST', url: `${devBase}/nodes` },
    { method: 'PUT', url: `${devBase}/node/123456` },
    // Way create
    { method: 'PUT', url: `${devBase}/way/create` },
    { method: 'POST', url: `${devBase}/way/create` },
    { method: 'POST', url: `${devBase}/ways` },
    // Diff upload
    { method: 'POST', url: `${devBase}/changeset/1/upload` },
  ];

  for (const item of testUrls) {
    try {
      const resp = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'text/xml',
        },
        body: '<osm><node lat="0" lon="0"/></osm>',
      });
      console.log(`${item.method.padEnd(5)} ${item.url} -> Status: ${resp.status} ${resp.statusText}`);
    } catch (err) {
      console.log(`${item.method.padEnd(5)} ${item.url} -> Error: ${err.message}`);
    }
  }

  // Also test prodBase
  console.log('\nTesting on prodBase:');
  const prodUrls = [
    { method: 'PUT', url: `${prodBase}/changeset/create` },
    { method: 'POST', url: `${prodBase}/changeset/create` },
    { method: 'PUT', url: `${prodBase}/node/create` },
    { method: 'POST', url: `${prodBase}/node/create` },
    { method: 'POST', url: `${prodBase}/nodes` },
    { method: 'PUT', url: `${prodBase}/node/123456` },
  ];

  for (const item of prodUrls) {
    try {
      const resp = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'text/xml',
        },
        body: '<osm><node lat="0" lon="0"/></osm>',
      });
      console.log(`${item.method.padEnd(5)} ${item.url} -> Status: ${resp.status} ${resp.statusText}`);
    } catch (err) {
      console.log(`${item.method.padEnd(5)} ${item.url} -> Error: ${err.message}`);
    }
  }
}

testEndpoints();
