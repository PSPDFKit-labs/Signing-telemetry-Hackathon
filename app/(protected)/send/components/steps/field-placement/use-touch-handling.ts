import { closestByClass, getNutrientViewerRuntime } from '@/lib/nutrient-viewer';
import { createFieldOnPage } from './field-creation-helpers';
import { getFieldSpec } from './field-specs';
import type { FieldPlacement, NutrientViewerInstance } from './types';
import { buildFormField, buildWidgetConfig, createFieldName, setFormCreatorMode } from './utils';

/**
 * Attach mobile touch event listeners and the nutrient:fieldDragStart
 * window listener to the viewer instance.
 * Returns a cleanup function for the window listener.
 */
export function attachTouchListeners(
  instance: NutrientViewerInstance,
  opts: {
    currentRecipient: any;
    setFieldPlacements: React.Dispatch<React.SetStateAction<FieldPlacement[]>>;
    updateFieldCount?: (email: string, fieldType: string, increment: boolean) => void;
  },
): () => void {
  const { currentRecipient, setFieldPlacements, updateFieldCount } = opts;

  // Track if we're in the process of a mobile field dragging operation
  let mobileFieldDragActive = false;
  let activeTouchFieldType = '';

  // Add touch handling to the document
  instance.contentDocument.addEventListener('touchstart', (_event: Event) => {}, { passive: true });

  // Handle touch move in the document — needs passive: false for preventDefault()
  instance.contentDocument.addEventListener(
    'touchmove',
    (event: Event) => {
      if (mobileFieldDragActive && (event as TouchEvent).touches?.[0]) {
        event.preventDefault(); // Prevent scrolling during field placement
      }
    },
    { passive: false },
  );

  // Handle touch end in the document
  instance.contentDocument.addEventListener('touchend', (event: Event) => {
    if (mobileFieldDragActive) {
      // Get touch end position
      const touchEvent = event as TouchEvent;
      const touchEndX = touchEvent.changedTouches[0].clientX;
      const touchEndY = touchEvent.changedTouches[0].clientY;

      // Get element under the touch point
      const elementAtPoint = document.elementFromPoint(touchEndX, touchEndY);
      if (!elementAtPoint) return;

      // Find the page element
      const pageElement = closestByClass(elementAtPoint, 'PSPDFKit-Page');
      if (!pageElement) {
        mobileFieldDragActive = false;
        return;
      }

      try {
        const pageIndex = parseInt((pageElement as HTMLElement).dataset?.pageIndex || '0', 10);
        const nutrientRuntime = getNutrientViewerRuntime();

        if (!nutrientRuntime) {
          console.error('[Mobile] NutrientViewer runtime not available');
          mobileFieldDragActive = false;
          return;
        }

        // Define field dimensions
        const fieldSpec = getFieldSpec(activeTouchFieldType);
        if (!fieldSpec) return;
        const fieldWidth = fieldSpec.width;
        const fieldHeight = fieldSpec.height;

        // Create the rect in client space relative to where the user touched
        const clientRect = new nutrientRuntime.Geometry.Rect({
          left: touchEndX - fieldWidth / 2, // Center horizontally at touch point
          top: touchEndY - fieldHeight / 2, // Center vertically at touch point
          width: fieldWidth,
          height: fieldHeight,
        });

        // Transform to page coordinates
        const transformedPageRect = instance.transformContentClientToPageSpace(clientRect, pageIndex);

        // Create a unique field name with recipient info
        const fieldName = createFieldName(activeTouchFieldType, currentRecipient);

        // Create widget annotation with customData for recipient info
        const widgetConfig = buildWidgetConfig(nutrientRuntime, {
          boundingBox: transformedPageRect,
          fieldName,
          pageIndex,
          fieldType: activeTouchFieldType,
          recipient: currentRecipient,
        });
        const widget = new nutrientRuntime.Annotations.WidgetAnnotation(widgetConfig);
        const formField = buildFormField(nutrientRuntime, activeTouchFieldType, widget.id, fieldName, currentRecipient);
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
                  type: activeTouchFieldType,
                  position: `(${Math.round(transformedPageRect.left)}, ${Math.round(transformedPageRect.top)})`,
                  name: fieldName,
                  recipient: currentRecipient?.email,
                  pageIndex,
                },
              ]);

              // Update recipient field count for validation
              if (updateFieldCount && currentRecipient?.email) {
                updateFieldCount(currentRecipient.email, activeTouchFieldType, true);
              }
            })
            .catch((error: any) => {
              console.error('[Mobile] Error creating form field:', error);
            });
        }
      } catch (error) {
        console.error('[Mobile] Error in touch-based form field creation:', error);
      }

      // Reset mobile drag state
      mobileFieldDragActive = false;
      activeTouchFieldType = '';
    }
  });

  // Add a global listener to track field type for mobile drag operations
  const fieldDragStartHandler = ((event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail?.fieldType) {
      mobileFieldDragActive = true;
      activeTouchFieldType = customEvent.detail.fieldType;
      // IMMEDIATE TEST: Try to create field right away based on event coordinates
      try {
        // Make sure the runtime is available before proceeding
        const mobileRuntime = getNutrientViewerRuntime();
        if (!mobileRuntime) {
          // NutrientRuntime not available for immediate field creation
          return;
        }

        // Instead of trying to place at the touch point, find the document container and place in the visible area
        const docContainer = instance.contentDocument.querySelector('.PSPDFKit-Page');

        if (docContainer) {
          // Get the page index from the container
          const pageIndex = parseInt((docContainer as HTMLElement).dataset.pageIndex || '0', 10);

          // Get the container's position
          const rect = docContainer.getBoundingClientRect();

          // Document space coordinates may be inverted compared to screen coordinates
          // Place the field in a more consistently visible location
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2; // Center of page for better visibility

          // Create the field with a completely different approach for mobile:
          // Using PDF coordinates directly instead of screen coordinates
          try {
            // Create a unique field name with recipient identifier
            const fieldName = createFieldName(customEvent.detail.fieldType, currentRecipient);

            // For reliable placement, create a temporary widget to get proper transform values
            const tempRect = new mobileRuntime.Geometry.Rect({
              left: centerX,
              top: centerY,
              width: 5, // Tiny test point
              height: 5,
            });

            // Find where this point maps to in PDF space
            const tempTransformed = instance.transformContentClientToPageSpace(tempRect, pageIndex);

            // Now create a properly sized field at those PDF coordinates
            const fieldSpec = getFieldSpec(customEvent.detail.fieldType);
            if (!fieldSpec) return;
            const pdfWidth = fieldSpec.width;
            const pdfHeight = fieldSpec.height;

            const pdfRect = new mobileRuntime.Geometry.Rect({
              // Center the field at the test point's position
              left: tempTransformed.left - pdfWidth / 2,
              top: tempTransformed.top - pdfHeight / 2,
              width: pdfWidth,
              height: pdfHeight,
            });

            // Create widget annotation with customData for recipient info
            const widgetConfig = buildWidgetConfig(mobileRuntime, {
              boundingBox: pdfRect,
              fieldName,
              pageIndex,
              fieldType: customEvent.detail.fieldType,
              recipient: currentRecipient,
            });
            const widget = new mobileRuntime.Annotations.WidgetAnnotation(widgetConfig);
            const formField = buildFormField(
              mobileRuntime,
              customEvent.detail.fieldType,
              widget.id,
              fieldName,
              currentRecipient,
            );
            setFormCreatorMode(instance, mobileRuntime);

            // Create annotations
            if (formField) {
              instance
                .create([widget, formField])
                .then(() => {
                  // Add haptic feedback if supported
                  if (navigator.vibrate) {
                    navigator.vibrate(50); // Short vibration to indicate success
                  }

                  // Add visual feedback by briefly flashing a success message
                  const successMessage = document.createElement('div');
                  successMessage.className =
                    'fixed top-1/4 left-1/2 transform -translate-x-1/2 py-2 px-4 bg-green-500 text-white rounded-md z-50 shadow-lg';
                  successMessage.textContent = `${customEvent.detail.fieldType} field added`;
                  document.body.appendChild(successMessage);

                  // Remove the message after a short delay
                  setTimeout(() => {
                    document.body.removeChild(successMessage);
                  }, 1500);

                  // Update field placement list
                  setFieldPlacements((prev) => [
                    ...prev,
                    {
                      type: customEvent.detail.fieldType,
                      position: `Center of page ${pageIndex + 1}`,
                      name: fieldName,
                      recipient: currentRecipient?.email,
                      pageIndex: pageIndex,
                    },
                  ]);

                  // Update recipient field count for validation
                  if (updateFieldCount && currentRecipient?.email) {
                    updateFieldCount(currentRecipient.email, customEvent.detail.fieldType, true);
                  }
                })
                .catch((err) => {
                  console.error('Error in createFieldOnPage execution:', err);
                });
            }
          } catch (error) {
            console.error('Error in immediate field creation:', error);
          }
        } else {
          // No document pages found — try fallback viewport element

          // Fallback: try to find any viewport element
          const viewport = instance.contentDocument.querySelector('.PSPDFKit-Viewport');
          if (viewport) {
            // Look for pages within the viewport
            const pages = viewport.querySelectorAll('.PSPDFKit-Page');
            if (pages && pages.length > 0) {
              const firstPage = pages[0] as HTMLElement;

              const pageIndex = parseInt((firstPage as HTMLElement).dataset.pageIndex || '0', 10);
              const rect = firstPage.getBoundingClientRect();

              // Center position
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 3;

              setTimeout(() => {
                createFieldOnPage(
                  customEvent.detail.fieldType,
                  centerX,
                  centerY,
                  firstPage,
                  pageIndex,
                  instance,
                  mobileRuntime,
                  currentRecipient,
                  setFieldPlacements,
                );
              }, 100);
            } else {
              console.error('No pages found in viewport');
            }
          } else {
            console.error('No viewport found');
          }
        }
      } catch (error) {
        console.error('Error in immediate field creation:', error);
      }
    }
  }) as EventListener;
  window.addEventListener('nutrient:fieldDragStart', fieldDragStartHandler);

  // Return cleanup function
  return () => {
    window.removeEventListener('nutrient:fieldDragStart', fieldDragStartHandler);
  };
}
