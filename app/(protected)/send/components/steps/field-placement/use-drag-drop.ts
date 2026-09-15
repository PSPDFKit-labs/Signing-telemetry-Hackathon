import { closestByClass, getNutrientViewerRuntime } from '@/lib/nutrient-viewer';
import { getFieldSpec } from './field-specs';
import type { FieldPlacement, NutrientViewerInstance } from './types';
import { buildFormField, buildWidgetConfig, createFieldName, setFormCreatorMode } from './utils';

/**
 * Attach desktop drag-and-drop listeners to the viewer's contentDocument.
 * Call after the viewer instance is loaded.
 */
export function attachDragDropListeners(
  instance: NutrientViewerInstance,
  opts: {
    signerRecipientsRef: React.MutableRefObject<any[]>;
    currentRecipientIndexRef: React.MutableRefObject<number>;
    setFieldPlacements: React.Dispatch<React.SetStateAction<FieldPlacement[]>>;
    updateFieldCount: (email: string, fieldType: string, increment: boolean) => void;
  },
): void {
  const { signerRecipientsRef, currentRecipientIndexRef, setFieldPlacements, updateFieldCount } = opts;

  // Drag and drop event listeners debugging:
  instance.contentDocument.addEventListener('dragover', (event: any) => {
    // Prevent default to allow drop
    event.preventDefault();

    // Set the dropEffect to show it's a copy operation
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    // Find the page element under the cursor
    const pageElement = closestByClass(event.target, 'PSPDFKit-Page');
    if (pageElement) {
    }
  });

  instance.contentDocument.addEventListener('dragenter', (event: any) => {
    // Prevent default to allow the drag
    event.preventDefault();
  });

  instance.contentDocument.addEventListener('drop', async (event: any) => {
    // These are critical to make drop work
    event.preventDefault();
    event.stopPropagation();

    // Get the field type from the dataTransfer
    const fieldType = event.dataTransfer.getData('fieldType');

    if (!fieldType) {
      return;
    }

    // Get the drag offset data (where user grabbed the draggable)
    const offsetXPercent = parseFloat(event.dataTransfer.getData('offsetXPercent') || '0.5');
    const offsetYPercent = parseFloat(event.dataTransfer.getData('offsetYPercent') || '0.5');

    // Get runtime
    const nutrientRuntime = getNutrientViewerRuntime();
    if (!nutrientRuntime) {
      console.error('NutrientRuntime not available');
      return;
    }

    // Find the page element under the drop
    let pageElement = closestByClass(event.target, 'PSPDFKit-Page');
    if (!pageElement) {
      pageElement = closestByClass(event.target, 'pspdfkit-page');
    }

    if (!pageElement) {
      console.warn('No page element found at drop position');
      return;
    }

    const pageIndex = parseInt((pageElement as HTMLElement).dataset.pageIndex || '0', 10);

    try {
      // Get dimensions for the field based on type
      const fieldSpec = getFieldSpec(fieldType);
      if (!fieldSpec) return;
      const fieldWidth = fieldSpec.width;
      const fieldHeight = fieldSpec.height;

      // Get page info and calculate manual transformation
      const pageInfo = await instance.pageInfoForIndex(pageIndex);
      if (!pageInfo) {
        console.error('Could not get page info');
        return;
      }

      const pageRect = pageElement.getBoundingClientRect();

      // Calculate page-relative position
      const pageRelativeX = event.clientX - pageRect.left;
      const pageRelativeY = event.clientY - pageRect.top;

      // Calculate scale factors
      const scaleX = pageInfo.width / pageRect.width;
      const scaleY = pageInfo.height / pageRect.height;

      // Account for grab offset
      const grabOffsetX = fieldWidth * offsetXPercent;
      const grabOffsetY = fieldHeight * offsetYPercent;

      // Convert to PDF coordinates with grab offset
      const pdfX = (pageRelativeX - grabOffsetX) * scaleX;
      const pdfY = (pageRelativeY - grabOffsetY) * scaleY;

      // Create bounding box in PDF coordinates
      const transformedPageRect = new nutrientRuntime.Geometry.Rect({
        left: pdfX,
        top: pdfY,
        width: fieldWidth * scaleX,
        height: fieldHeight * scaleY,
      });

      // Validate the transformed coordinates
      if (!transformedPageRect || transformedPageRect.width <= 0 || transformedPageRect.height <= 0) {
        console.error('Invalid transformed rect:', transformedPageRect);
        return;
      }

      // Get the CURRENT recipient from ref (not closure-captured value)
      const activeRecipient = signerRecipientsRef.current[currentRecipientIndexRef.current];

      // Create a unique field name that includes the recipient identifier
      const fieldName = createFieldName(fieldType, activeRecipient);

      // Create widget annotation with customData for recipient info
      const widgetConfig = buildWidgetConfig(nutrientRuntime, {
        boundingBox: transformedPageRect,
        fieldName,
        pageIndex,
        fieldType,
        recipient: activeRecipient,
      });
      const widget = new nutrientRuntime.Annotations.WidgetAnnotation(widgetConfig);
      const formField = buildFormField(nutrientRuntime, fieldType, widget.id, fieldName, activeRecipient);
      setFormCreatorMode(instance, nutrientRuntime);

      // Create the annotations
      if (formField) {
        instance
          .create([widget, formField])
          .then(() => {
            // Add to our debug state for tracking
            setFieldPlacements((prev) => [
              ...prev,
              {
                type: fieldType,
                position: `(${Math.round(transformedPageRect.left)}, ${Math.round(transformedPageRect.top)})`,
                name: fieldName,
                recipient: activeRecipient?.email,
                pageIndex: pageIndex,
                coordinates: {
                  x: Math.round(transformedPageRect.left),
                  y: Math.round(transformedPageRect.top),
                },
                id: widget.id,
                width: Math.round(transformedPageRect.width),
                height: Math.round(transformedPageRect.height),
              },
            ]);

            // Update the recipient field count in context
            if (activeRecipient?.email) {
              updateFieldCount(activeRecipient.email, fieldType, true);
            }
          })
          .catch((error: any) => {
            console.error('Error creating form field:', error);
          });
      }
    } catch (error) {
      console.error('Error in form field creation:', error);
    }
  });
}
