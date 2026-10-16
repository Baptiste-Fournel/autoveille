import type { TemplatePreview } from '../../../domain/messaging/templatePreview.js';
import { TEMPLATE_WARNING_TEXTS } from '../../../domain/presentation/templateWarnings.js';
import type { TemplatePreviewResponse } from '../../../shared/api.js';

export const templatePreviewDto = (preview: TemplatePreview): TemplatePreviewResponse => ({
  text: preview.text,
  warnings: preview.warnings.map((warning) => TEMPLATE_WARNING_TEXTS[warning]),
});
