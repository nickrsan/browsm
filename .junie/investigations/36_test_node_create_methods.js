// 36_test_node_create_methods.js
// Tests POST /nodes vs PUT /node/create and diff upload

async function testNodeCreateMethods() {
  const base = 'https://master.apis.dev.openstreetmap.org/api/0.6';

  const testPayload = `<osm>
  <node changeset="1" lat="51.5" lon="-0.1">
    <tag k="name" v="Test"/>
  </node>
</osm>`;

  console.log('Testing PUT /node/create:');
  const putCreate = await fetch(`${base}/node/create`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/xml' },
    body: testPayload,
  });
  console.log(`PUT /node/create: ${putCreate.status} ${putCreate.statusText}`);

  console.log('Testing POST /node/create:');
  const postCreate = await fetch(`${base}/node/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: testPayload,
  });
  console.log(`POST /node/create: ${postCreate.status} ${postCreate.statusText}`);

  console.log('Testing POST /nodes:');
  const postNodes = await fetch(`${base}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: testPayload,
  });
  console.log(`POST /nodes: ${postNodes.status} ${postNodes.statusText}`);

  console.log('Testing POST /ways:');
  const postWays = await fetch(`${base}/ways`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: '<osm><way changeset="1"><nd ref="1"/></way></osm>',
  });
  console.log(`POST /ways: ${postWays.status} ${postWays.statusText}`);
}

testNodeCreateMethods();
