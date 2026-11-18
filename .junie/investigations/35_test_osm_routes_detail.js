// 35_test_osm_routes_detail.js
async function testMoreRoutes() {
  const base = 'https://master.apis.dev.openstreetmap.org/api/0.6';

  const endpoints = [
    { method: 'PUT', path: '/changeset/create' },
    { method: 'POST', path: '/changesets' },
    { method: 'POST', path: '/changeset/create' },
    { method: 'PUT', path: '/changeset/1/close' },
    { method: 'POST', path: '/changeset/1/close' },
    { method: 'POST', path: '/changeset/1/upload' },
    { method: 'PUT', path: '/node/create' },
    { method: 'POST', path: '/nodes' },
    { method: 'PUT', path: '/nodes' },
    { method: 'PUT', path: '/node/1' },
    { method: 'POST', path: '/node/1' },
    { method: 'PUT', path: '/way/create' },
    { method: 'POST', path: '/ways' },
    { method: 'PUT', path: '/way/1' },
    { method: 'PUT', path: '/relation/create' },
    { method: 'POST', path: '/relations' },
    { method: 'PUT', path: '/relation/1' },
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${base}${ep.path}`, {
      method: ep.method,
      headers: { 'Content-Type': 'text/xml' },
      body: '<osm><node lat="0" lon="0"/></osm>',
    });
    console.log(`${ep.method.padEnd(5)} ${ep.path.padEnd(25)} -> ${res.status} ${res.statusText}`);
  }
}

testMoreRoutes();
