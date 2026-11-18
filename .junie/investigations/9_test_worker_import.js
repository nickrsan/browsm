// Investigation of worker URL resolution
import maplibreGl from 'maplibre-gl';
console.log('MapLibre GL keys:', Object.keys(maplibreGl));
console.log('setWorkerUrl type:', typeof maplibreGl.setWorkerUrl);
console.log('getWorkerUrl():', maplibreGl.getWorkerUrl());
