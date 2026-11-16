import { defineExtensionMessaging } from '@webext-core/messaging';
import type {
  UpdateEditorPayload,
  AdjustMapPayload,
  UpdateIconPayload,
  ShowMapPayload,
  SchemaDetectedPayload,
  SearchPoiPayload,
} from '../types/messaging';

export const messaging = defineExtensionMessaging<{
  updateEditor(payload: UpdateEditorPayload): void;
  adjustMap(payload: AdjustMapPayload): void;
  updateIcon(payload: UpdateIconPayload): void;
  showMap(payload: ShowMapPayload): void;
  schemaDetected(payload: SchemaDetectedPayload): void;
  searchPoi(payload: SearchPoiPayload): void;
}>();
