import { defineExtensionMessaging } from '@webext-core/messaging';

interface UpdateEditorPayload {
  state: 'searching' | 'instructions' | 'response';
}

interface AdjustMapPayload {
  lat: number;
  lon: number;
  display_name: string;
  osm_id: string;
  full_response: any;
}

interface UpdateIconPayload {
  state: 'active' | 'inactive' | 'no-address';
}

interface ShowMapPayload {
  display_name: string;
  lat: number;
  lon: number;
}

export const messaging = defineExtensionMessaging<{
  updateEditor(payload: UpdateEditorPayload): void;
  adjustMap(payload: AdjustMapPayload): void;
  updateIcon(payload: UpdateIconPayload): void;
  showMap(payload: ShowMapPayload): void;
}>();
