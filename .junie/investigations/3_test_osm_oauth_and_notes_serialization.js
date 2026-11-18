// Investigation 3: Test XML serialization for OSM Changeset, Node, Way, and Notes APIs
import { JSDOM } from 'jsdom';

function testXmlGeneration() {
  console.log('Testing OSM Changeset XML generation:');
  const comment = 'Add phone and website for Newport Coffee';
  const source = 'https://newportcoffee.example.com';
  const createdBy = 'Browsm 0.1.0';

  const changesetXml = `<osm>
  <changeset>
    <tag k="created_by" v="${escapeXml(createdBy)}"/>
    <tag k="comment" v="${escapeXml(comment)}"/>
    <tag k="source" v="${escapeXml(source)}"/>
  </changeset>
</osm>`;

  console.log('Changeset XML:\n', changesetXml);

  console.log('Testing OSM Node XML generation:');
  const tags = {
    amenity: 'cafe',
    name: 'Newport Coffee & Bakery',
    'addr:street': 'Thames St',
    'addr:housenumber': '150',
    phone: '+1 401-555-1234',
    website: 'https://newportcoffee.example.com',
  };

  const tagXml = Object.entries(tags)
    .map(([k, v]) => `    <tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`)
    .join('\n');

  const nodeXml = `<osm>
  <node changeset="12345" lat="41.4901" lon="-71.3128">
${tagXml}
  </node>
</osm>`;

  console.log('Node XML:\n', nodeXml);

  console.log('Testing OSM User Details XML Parsing:');
  const sampleUserXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="OpenStreetMap server">
  <user id="987654" display_name="mapper_pro" account_created="2020-05-12T14:30:00Z">
    <description>Local mapper in Rhode Island</description>
    <changesets count="425"/>
    <img href="https://www.openstreetmap.org/assets/avatar.png"/>
    <roles>
      <role>moderator</role>
    </roles>
  </user>
</osm>`;

  const dom = new JSDOM(sampleUserXml, { contentType: 'text/xml' });
  const doc = dom.window.document;
  const userEl = doc.querySelector('user');
  if (userEl) {
    const id = parseInt(userEl.getAttribute('id') || '0', 10);
    const username = userEl.getAttribute('display_name') || '';
    const accountCreated = userEl.getAttribute('account_created') || '';
    const description = userEl.querySelector('description')?.textContent || undefined;
    const changesetCount = parseInt(userEl.querySelector('changesets')?.getAttribute('count') || '0', 10);
    const img = userEl.querySelector('img')?.getAttribute('href') || undefined;

    console.log('Parsed User Details:', {
      id,
      username,
      accountCreated,
      description,
      changesetCount,
      img,
    });
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

testXmlGeneration();
