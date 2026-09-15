'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getNutrientViewerRuntime } from '@/lib/nutrient-viewer';
import { shouldAutoAdvanceAfterCompletion, sortFieldsInReadingOrder } from '@/lib/signing-field-navigation';
import { getSigningFieldType, hasRequiredFieldValue } from '@/lib/signing-fields';

interface SignHereWidgetProps {
  instance: any;
  recipientId: string;
  isViewerLoaded: boolean;
  containerEl: HTMLDivElement | null;
  allFieldsFilled: boolean;
}

interface FieldTarget {
  pageIndex: number;
  boundingBox: any;
  formFieldName: string;
  formField: any;
  fieldType: string;
}

export default function SignHereWidget({
  instance,
  recipientId,
  isViewerLoaded,
  containerEl,
  allFieldsFilled,
}: SignHereWidgetProps) {
  const [fields, setFields] = useState<FieldTarget[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [widgetTop, setWidgetTop] = useState<number | null>(null);
  const widgetRef = useRef<HTMLButtonElement>(null);
  const isScrollingRef = useRef(false);
  const hasStartedRef = useRef(false);
  const currentIndexRef = useRef(0);
  const completedCountRef = useRef(0);
  const changeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigateToTargetRef = useRef<(target: FieldTarget) => void>(() => undefined);

  // Collect and sort signer's fields
  const collectFields = useCallback(async () => {
    if (!instance || !recipientId) return;

    const PSPDFKit = getNutrientViewerRuntime();
    if (!PSPDFKit) return;

    const formFields = await instance.getFormFields();
    const totalPages = await instance.totalPageCount;

    // Gather all annotations across pages
    let allAnnotations: any[] = [];
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const pageAnnotations = await instance.getAnnotations(pageIndex);
      allAnnotations = allAnnotations.concat(pageAnnotations.toArray());
    }

    // Filter to current signer's fields
    const targets: FieldTarget[] = [];
    for (const field of formFields.toArray()) {
      const widget = allAnnotations.find((ann: any) => ann.formFieldName === field.name);
      if (!widget?.customData?.signerID) continue;
      if (widget.customData.signerID !== recipientId) continue;

      targets.push({
        pageIndex: widget.pageIndex,
        boundingBox: widget.boundingBox,
        formFieldName: field.name,
        formField: field,
        fieldType: getSigningFieldType(widget.customData.type, field.name),
      });
    }

    // Nutrient page-space coordinates start at the top-left, so ascending
    // page/top/left follows the order a signer reads the document.
    setFields(sortFieldsInReadingOrder(targets));
  }, [instance, recipientId]);

  // Collect fields once viewer is loaded
  useEffect(() => {
    if (!isViewerLoaded || !instance) return;
    // Delay slightly to ensure field permissions are applied
    const timer = setTimeout(collectFields, 300);
    return () => clearTimeout(timer);
  }, [isViewerLoaded, instance, collectFields]);

  // Read completion state and find the first unfilled field.
  const readFieldProgress = useCallback(async (): Promise<{ firstUnfilled: number; completed: number }> => {
    if (!instance || fields.length === 0) {
      return { firstUnfilled: -1, completed: 0 };
    }

    const PSPDFKit = getNutrientViewerRuntime();
    if (!PSPDFKit) return { firstUnfilled: -1, completed: 0 };

    const formFieldValues = await instance.getFormFieldValues();

    let firstUnfilled = -1;
    let nextCompletedCount = 0;

    for (let i = 0; i < fields.length; i++) {
      const { formField, formFieldName } = fields[i];
      const isSignatureField = formField instanceof PSPDFKit.FormFields.SignatureFormField;
      let isFilled = false;

      if (isSignatureField) {
        const overlapping = await instance.getOverlappingAnnotations(formField);
        isFilled = overlapping.size > 0;
      } else {
        isFilled = hasRequiredFieldValue(formFieldValues[formFieldName]);
      }

      if (isFilled) nextCompletedCount += 1;
      else if (firstUnfilled < 0) firstUnfilled = i;
    }

    return { firstUnfilled, completed: nextCompletedCount };
  }, [instance, fields]);

  // Update current index when fields change or annotations change. Once the
  // signer has started, signatures/initials/checkboxes advance automatically;
  // text inputs still wait for an explicit Next click so typing is not cut off.
  const updateCurrentField = useCallback(
    async (autoAdvance: boolean) => {
      const previousIndex = currentIndexRef.current;
      const previousCompleted = completedCountRef.current;
      const { firstUnfilled, completed } = await readFieldProgress();

      completedCountRef.current = completed;
      setCompletedCount(completed);

      if (firstUnfilled < 0) return;

      currentIndexRef.current = firstUnfilled;
      setCurrentIndex(firstUnfilled);

      const completedTarget = fields[previousIndex];
      const shouldAdvance =
        autoAdvance &&
        hasStartedRef.current &&
        completed > previousCompleted &&
        firstUnfilled !== previousIndex &&
        completedTarget &&
        shouldAutoAdvanceAfterCompletion(completedTarget.fieldType);

      if (shouldAdvance) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        const advanceWhenReady = () => {
          if (isScrollingRef.current) {
            autoAdvanceTimeoutRef.current = setTimeout(advanceWhenReady, 200);
            return;
          }
          navigateToTargetRef.current(fields[firstUnfilled]);
        };
        autoAdvanceTimeoutRef.current = setTimeout(advanceWhenReady, 350);
      }
    },
    [fields, readFieldProgress],
  );

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      clearTimeout(autoAdvanceTimeoutRef.current);
    };
  }, []);

  // Listen for annotation/form field changes to update current target
  useEffect(() => {
    if (!instance || !isViewerLoaded || fields.length === 0) return;

    updateCurrentField(false);

    const handleChange = () => {
      clearTimeout(changeTimeoutRef.current);
      changeTimeoutRef.current = setTimeout(() => updateCurrentField(true), 100);
    };

    instance.addEventListener('formFields.update', handleChange);
    instance.addEventListener('annotations.create', handleChange);
    instance.addEventListener('annotations.update', handleChange);
    instance.addEventListener('annotations.delete', handleChange);

    return () => {
      clearTimeout(changeTimeoutRef.current);
      instance.removeEventListener('formFields.update', handleChange);
      instance.removeEventListener('annotations.create', handleChange);
      instance.removeEventListener('annotations.update', handleChange);
      instance.removeEventListener('annotations.delete', handleChange);
    };
  }, [instance, isViewerLoaded, fields, updateCurrentField]);

  // Calculate widget vertical position based on current field.
  // DocuSign-style: widget defaults to vertical center of the container.
  // The viewer scrolls to bring the field to that center position.
  // Only adjusts away from center when the field can't be centered
  // (e.g., near the top or bottom edge of the document).
  const updatePosition = useCallback(() => {
    if (!instance || !containerEl || fields.length === 0 || allFieldsFilled) return;
    if (isScrollingRef.current) return;

    const containerRect = containerEl.getBoundingClientRect();
    const widgetHeight = 44;

    // Before user clicks Start, park the widget at the top
    if (!hasStartedRef.current) {
      setWidgetTop(55);
      return;
    }

    const target = fields[currentIndex];
    if (!target) return;

    // Find the actual DOM element for the annotation widget.
    // getBoundingClientRect accounts for CSS transforms, giving accurate
    // viewport coordinates (unlike transformPageToClientSpace).
    try {
      const doc = instance.contentDocument;
      const selector = `.PSPDFKit-Annotation-Widget[aria-label^="${target.formFieldName}"]`;
      const widgetEl = doc?.querySelector(selector) as HTMLElement | null;

      if (widgetEl) {
        const widgetRect = widgetEl.getBoundingClientRect();
        const fieldCenterY = widgetRect.top + widgetRect.height / 2 - containerRect.top;

        const minTop = 8;
        const maxTop = containerRect.height - widgetHeight - 8;

        // If field is visible, position widget at the field.
        // jumpToRect usually centers the field, so this will be near center.
        // For edge cases (field near top/bottom of document), the widget
        // follows the field instead of staying at an unreachable center.
        const isVisible = fieldCenterY > -50 && fieldCenterY < containerRect.height + 50;

        if (isVisible) {
          const fieldAlignedTop = Math.max(minTop, Math.min(maxTop, fieldCenterY - widgetHeight / 2));
          setWidgetTop(fieldAlignedTop);
          return;
        }
      }
    } catch {
      // DOM query failed — use center fallback
    }

    // Field not found or not visible — keep widget where it is.
    // handleClick will reposition after scrolling to the next field.
  }, [instance, containerEl, fields, currentIndex, allFieldsFilled]);

  // Set initial widget position and track window resize.
  // Scroll/viewState tracking is intentionally omitted — the widget position is
  // set by handleClick (centering after jumpToRect). Passive scroll tracking caused
  // the widget to jump to the bottom when PSPDFKit adjusts scroll (e.g., signature modal).
  useEffect(() => {
    if (!instance || !isViewerLoaded || !containerEl || fields.length === 0) return;

    updatePosition();

    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [instance, isViewerLoaded, containerEl, fields, updatePosition]);

  // Navigate to a field, center it in the viewport, and position the widget at
  // the vertical center (DocuSign-style). Kept separate from the click handler
  // so one-click fields can continue the guided flow automatically.
  const navigateToTarget = useCallback(
    (target: FieldTarget) => {
      if (!instance || allFieldsFilled || isScrollingRef.current) return;

      isScrollingRef.current = true;

      // Pulse the widget to give visual feedback on click
      widgetRef.current?.classList.add('animate-pulse-once');
      setTimeout(() => widgetRef.current?.classList.remove('animate-pulse-once'), 600);

      // Eased scroll: animates scrollTop over a controlled duration
      // using ease-in-out for a natural feel.
      const SCROLL_DURATION = 800; // ms

      const animateScroll = (el: HTMLElement, to: number, duration: number) => {
        const from = el.scrollTop;
        const delta = to - from;
        if (Math.abs(delta) < 1) return;
        const start = performance.now();

        const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

        const step = (now: number) => {
          const elapsed = Math.min((now - start) / duration, 1);
          el.scrollTop = from + delta * easeInOut(elapsed);
          if (elapsed < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };

      // Smooth-scroll helper: centers the field in the scroll container,
      // highlights it, then repositions the widget.
      const smoothScrollToField = () => {
        try {
          const doc = instance.contentDocument;
          const scrollContainer = doc?.querySelector('.PSPDFKit-Scroll') as HTMLElement | null;
          const selector = `.PSPDFKit-Annotation-Widget[aria-label^="${target.formFieldName}"]`;
          const fieldEl = doc?.querySelector(selector) as HTMLElement | null;

          if (scrollContainer && fieldEl) {
            const fieldRect = fieldEl.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const fieldCenterInScroll =
              scrollContainer.scrollTop + (fieldRect.top + fieldRect.height / 2 - containerRect.top);
            const targetScrollTop = fieldCenterInScroll - scrollContainer.clientHeight / 2;

            const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
            const clampedScrollTop = Math.max(0, Math.min(maxScroll, targetScrollTop));

            animateScroll(scrollContainer, clampedScrollTop, SCROLL_DURATION);

            // Highlight the field after scroll is mostly complete
            setTimeout(() => {
              fieldEl.style.transition = 'box-shadow 0.5s ease';
              fieldEl.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.7), 0 0 20px rgba(37, 99, 235, 0.4)';
              setTimeout(() => {
                fieldEl.style.boxShadow = '';
              }, 2500);
              setTimeout(() => {
                fieldEl.style.transition = '';
              }, 3000);
            }, SCROLL_DURATION * 0.6);
          }
        } catch {
          // DOM elements may not be available
        }

        // After scroll animation completes, reposition the widget
        setTimeout(() => {
          isScrollingRef.current = false;
          updatePosition();
        }, SCROLL_DURATION + 100);
      };

      // Check if the target is on a different page than what's currently visible.
      const currentPage = instance.viewState.currentPageIndex;
      const needsPageChange = target.pageIndex !== currentPage;

      if (needsPageChange) {
        // Capture scroll position before jumpToRect
        const doc = instance.contentDocument;
        const scrollContainer = doc?.querySelector('.PSPDFKit-Scroll') as HTMLElement | null;
        const scrollBefore = scrollContainer?.scrollTop ?? 0;

        // jumpToRect ensures the target page is loaded/rendered (instant jump)
        instance.jumpToRect(target.pageIndex, target.boundingBox);

        // After page renders: reset scroll to pre-jump position, then animate
        setTimeout(() => {
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollBefore;
          }
          smoothScrollToField();
        }, 100);
      } else {
        smoothScrollToField();
      }
    },
    [instance, allFieldsFilled, updatePosition],
  );

  useEffect(() => {
    navigateToTargetRef.current = navigateToTarget;
  }, [navigateToTarget]);

  const handleClick = useCallback(() => {
    if (!instance || fields.length === 0 || allFieldsFilled || isScrollingRef.current) return;

    const target = fields[currentIndex];
    if (!target) return;

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      setHasStarted(true);
    }

    navigateToTarget(target);
  }, [instance, fields, currentIndex, allFieldsFilled, navigateToTarget]);

  // Hide if no fields, not loaded, or all filled
  if (!isViewerLoaded || fields.length === 0 || allFieldsFilled || widgetTop === null) {
    return null;
  }

  const remainingCount = Math.max(0, fields.length - completedCount);
  const label = hasStarted ? `Next · ${remainingCount} left` : `Start · ${remainingCount} fields`;

  return (
    <button
      ref={widgetRef}
      onClick={handleClick}
      className="absolute left-0 z-50 flex items-center justify-center rounded-r-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-lg transition-all duration-500 ease-in-out hover:bg-blue-700 active:bg-blue-800 cursor-pointer"
      style={{ top: `${widgetTop}px` }}
      type="button"
      aria-label={`${label} — click to scroll to the next field to sign`}
    >
      {label}
    </button>
  );
}
