import { getFieldSpec } from './field-specs';
import type { FieldPlacement, NutrientViewerInstance } from './types';
import { buildFormField, buildWidgetConfig, createFieldName, setFormCreatorMode } from './utils';

// Helper function to create a field on a page
export const createFieldOnPage = (
  fieldType: string,
  clientX: number,
  clientY: number,
  _pageElement: HTMLElement,
  pageIndex: number,
  instance: NutrientViewerInstance,
  nutrientRuntime: any,
  currentRecipient?: any,
  setFieldPlacements?: any,
) => {
  try {
    if (!nutrientRuntime) {
      // NutrientRuntime not available
      return;
    }

    // Define field dimensions
    const fieldSpec = getFieldSpec(fieldType);
    if (!fieldSpec) return null;
    const fieldWidth = fieldSpec.width;
    const fieldHeight = fieldSpec.height;

    // Center the field at touch coordinates
    const clientRect = new nutrientRuntime.Geometry.Rect({
      left: clientX - fieldWidth / 2,
      top: clientY - fieldHeight / 2,
      width: fieldWidth,
      height: fieldHeight,
    });

    // Convert to page coordinates
    const transformedPageRect = instance.transformContentClientToPageSpace(clientRect, pageIndex);

    // Create unique field name using helper function
    const fieldName = createFieldName(fieldType, currentRecipient);

    // Create widget annotation with customData for recipient info
    const widgetConfig = buildWidgetConfig(nutrientRuntime, {
      boundingBox: transformedPageRect,
      fieldName,
      pageIndex,
      fieldType,
      recipient: currentRecipient,
    });
    const widget = new nutrientRuntime.Annotations.WidgetAnnotation(widgetConfig);
    const formField = buildFormField(nutrientRuntime, fieldType, widget.id, fieldName, currentRecipient);
    setFormCreatorMode(instance, nutrientRuntime);

    // Create annotations
    if (formField) {
      return instance
        .create([widget, formField])
        .then(() => {
          // Add to field placements with recipient info
          setFieldPlacements((prev: FieldPlacement[]) => [
            ...prev,
            {
              type: fieldType,
              position: `Page ${pageIndex + 1} at y=${transformedPageRect.top}`,
              name: fieldName,
              recipient: currentRecipient?.email,
              pageIndex: pageIndex,
              coordinates: {
                x: Math.round(transformedPageRect.left),
                y: Math.round(transformedPageRect.top),
              },
              id: widget.id,
              width: Math.round(transformedPageRect.width),
              height: Math.round(transformedPageRect.height),
            } as FieldPlacement,
          ]);

          return fieldName;
        })
        .catch((error: any) => {
          console.error('Error creating field:', error);
          return null;
        });
    }

    return null;
  } catch (error) {
    console.error('Exception in createFieldOnPage:', error);
    return null;
  }
};

// Helper function to create a field with fixed and reliable positioning
// Uses hardware-independent positioning to work on all mobile devices
export const createMobileField = (
  fieldType: string,
  instance: NutrientViewerInstance,
  runtime: any,
  currentRecipient?: any,
) => {
  try {
    // Place the field on the currently visible page
    const pageIndex = instance.viewState.currentPageIndex ?? 0;

    // Create a unique field name using helper function
    const fieldName = createFieldName(fieldType, currentRecipient);

    // Directly use PDF coordinates for reliable placement
    // These values are in PDF coordinate space which is more reliable than screen coordinates
    const fieldSpec = getFieldSpec(fieldType);
    if (!fieldSpec) return null;
    const pdfWidth = fieldSpec.width;
    const pdfHeight = fieldSpec.height;

    // Place at fixed position 100 units from left and top
    // This ensures consistent placement regardless of screen size or zoom level
    const pdfRect = new runtime.Geometry.Rect({
      left: 100,
      top: 100,
      width: pdfWidth,
      height: pdfHeight,
    });

    // Create widget annotation with customData for recipient info
    const widgetConfig = buildWidgetConfig(runtime, {
      boundingBox: pdfRect,
      fieldName,
      pageIndex,
      fieldType,
      recipient: currentRecipient,
    });
    const widget = new runtime.Annotations.WidgetAnnotation(widgetConfig);
    const formField = buildFormField(runtime, fieldType, widget.id, fieldName, currentRecipient);
    setFormCreatorMode(instance, runtime);

    // Create the annotations
    if (formField) {
      return instance
        .create([widget, formField])
        .then(() => {
          // Visual feedback
          const toast = document.createElement('div');
          toast.className =
            'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-md z-50';
          toast.textContent = `${fieldType} field added`;
          document.body.appendChild(toast);

          // Remove toast after 2 seconds
          setTimeout(() => {
            document.body.removeChild(toast);
          }, 2000);

          // Vibrate if supported
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }

          return fieldName;
        })
        .catch((err) => {
          console.error('[Mobile] Error creating field:', err);
          return null;
        });
    }

    return null;
  } catch (error) {
    console.error('[Mobile] Error in createMobileField:', error);
    return null;
  }
};
