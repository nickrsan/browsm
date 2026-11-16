/**
 * External OpenStreetMap Editor Launcher Service
 * Provides utilities to launch external OSM editors (iD, Rapid, JOSM)
 * with precise map coordinates and selected entity IDs.
 */

import type { OsmElement } from '@/types/osm';
import type { PreferredEditor } from '@/types/settings';
import { calculateBboxAroundCoords } from './spatial-matcher';

export interface EditorLaunchOptions {
  lat: number;
  lon: number;
  zoom?: number;
  element?: OsmElement;
  webUrl?: string;
}

export interface EditorLaunchResult {
  success: boolean;
  url: string;
  error?: string;
}

/**
 * Builds the URL for opening a location and/or element in an external editor.
 */
export function getEditorUrl(editor: PreferredEditor, options: EditorLaunchOptions): string {
  const zoom = options.zoom ?? 18;
  const lat = options.lat;
  const lon = options.lon;
  const el = options.element;

  switch (editor) {
    case 'id': {
      const base = (options.webUrl || 'https://www.openstreetmap.org').replace(/\/+$/, '');
      if (el) {
        if (el.type === 'node') {
          return `${base}/edit?editor=id&node=${el.id}#map=${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}`;
        }
        if (el.type === 'way') {
          return `${base}/edit?editor=id&way=${el.id}#map=${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}`;
        }
        if (el.type === 'relation') {
          return `${base}/edit?editor=id&relation=${el.id}#map=${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}`;
        }
      }
      return `${base}/edit?editor=id#map=${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}`;
    }

    case 'rapid': {
      const base = 'https://rapideditor.org/edit';
      let url = `${base}#map=${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}`;
      if (el) {
        const prefix = el.type === 'node' ? 'n' : el.type === 'way' ? 'w' : 'r';
        url += `&id=${prefix}${el.id}`;
      }
      return url;
    }

    case 'josm': {
      const bbox = calculateBboxAroundCoords(lat, lon, 100);
      let url = `http://127.0.0.1:8111/load_and_zoom?left=${bbox.minLon.toFixed(6)}&right=${bbox.maxLon.toFixed(6)}&top=${bbox.maxLat.toFixed(6)}&bottom=${bbox.minLat.toFixed(6)}`;
      if (el) {
        url += `&select=${el.type}${el.id}`;
      }
      return url;
    }

    default: {
      const fallbackBase = options.webUrl || 'https://www.openstreetmap.org';
      return `${fallbackBase}/edit#map=${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}`;
    }
  }
}

/**
 * Launches the selected external editor.
 * For web-based editors (iD, Rapid), opens a new browser tab.
 * For desktop JOSM, triggers Remote Control HTTP request.
 */
export async function launchEditor(
  editor: PreferredEditor,
  options: EditorLaunchOptions,
  customFetch: typeof fetch = fetch
): Promise<EditorLaunchResult> {
  const url = getEditorUrl(editor, options);

  if (editor === 'josm') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await customFetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          url,
          error: `JOSM Remote Control responded with status ${response.status}`,
        };
      }

      return { success: true, url };
    } catch (err) {
      const isAbort = (err as Error)?.name === 'AbortError';
      const msg = isAbort
        ? 'Connection to JOSM Remote Control timed out. Ensure JOSM is running.'
        : 'Could not connect to JOSM Remote Control at http://127.0.0.1:8111. Make sure JOSM is running with Remote Control enabled.';
      return {
        success: false,
        url,
        error: msg,
      };
    }
  }

  // Web-based editors (iD, Rapid)
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return { success: true, url };
}
