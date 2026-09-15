/**
 * Utility functions and types for working with Nutrient Viewer SDK
 */
import type * as NutrientViewerSDK from '@nutrient-sdk/viewer';
import { normalizeViewerJson } from './normalize-viewer-json';

/**
 * Extended interface that includes the runtime properties not covered in the official type definitions
 */
// PSPDFKit runtime types not fully available in TypeScript definitions — `any` is intentional
export interface NutrientViewerRuntime {
  load: (options: any) => Promise<any>;
  unload: (container: HTMLElement | null) => void;
  Geometry: {
    Rect: new (options: { left: number; top: number; width: number; height: number }) => any;
  };
  Annotations: {
    WidgetAnnotation: new (options: {
      boundingBox: any;
      formFieldName: string;
      id: string;
      pageIndex: number;
      name: string;
    }) => any;
  };
  FormFields: {
    SignatureFormField: new (options: { annotationIds: any; name: string; type?: string }) => any;
    TextFormField: new (options: { annotationIds: any; name: string; defaultValue?: string }) => any;
  };
  Immutable: {
    List: new (items: any[]) => any;
  };
  InteractionMode: {
    FORM_CREATOR: string;
  };
  ElectronicSignatureCreationMode: {
    DRAW: string;
    IMAGE: string;
    TYPE: string;
  };
  generateInstantId: () => string;
}

type ToolbarItem = Record<string, unknown>;
type ViewerInstance = {
  setToolbarItems: (updater: (items: ToolbarItem[]) => ToolbarItem[]) => void;
  [key: string]: unknown;
};

/**
 * Safely gets the Nutrient Viewer SDK with proper TypeScript typing
 * @returns The Nutrient Viewer SDK instance with proper typing or null if not available
 */
export function getNutrientViewer(): typeof NutrientViewerSDK | null {
  if (typeof window === 'undefined' || !window.NutrientViewer) {
    return null;
  }

  return window.NutrientViewer as unknown as typeof NutrientViewerSDK;
}

/**
 * Safely gets the Nutrient Viewer SDK with complete runtime properties
 * @returns The Nutrient Viewer SDK instance with runtime properties or null if not available
 */
export function getNutrientViewerRuntime(): NutrientViewerRuntime | null {
  if (typeof window === 'undefined' || !window.NutrientViewer) {
    return null;
  }

  return window.NutrientViewer as unknown as NutrientViewerRuntime;
}

/**
 * Safely unloads the Nutrient Viewer
 * @param container The container element to unload the viewer from
 */
export function safeUnloadViewer(container: HTMLElement | null): void {
  if (typeof window === 'undefined' || !window.NutrientViewer || !container) {
    return;
  }

  try {
    if (typeof window.NutrientViewer.unload === 'function') {
      window.NutrientViewer.unload(container);
    }
  } catch (error) {
    // Suppress Nutrient Viewer internal errors during unload
    // These are often harmless and related to cleanup timing
    console.warn('Nutrient Viewer unload warning (safe to ignore):', error);
  }

  // Ensure container is completely empty after unload
  // This prevents "container is not empty" errors on reload
  try {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  } catch (error) {
    console.warn('Container cleanup warning:', error);
  }
}

/**
 * Safely loads the Nutrient Viewer
 * @param options Configuration options for loading the viewer
 * @returns Promise resolving to the viewer instance
 */
export function safeLoadViewer(options: {
  container: HTMLElement;
  document: string;
  toolbarItems?: Record<string, unknown>[];
  licenseKey?: string;
  [key: string]: unknown;
}): Promise<any> {
  // PSPDFKit viewer instance type not available
  if (typeof window === 'undefined' || !window.NutrientViewer) {
    return Promise.reject(new Error('Nutrient Viewer not available'));
  }

  const container = options.container;
  if (options.instantJSON && typeof options.instantJSON === 'object' && !Array.isArray(options.instantJSON)) {
    options = { ...options, instantJSON: normalizeViewerJson(options.instantJSON as Record<string, unknown>) };
  }

  // Enable next-generation page rendering for all viewer instances
  if (!options.pageRendering) {
    options.pageRendering = 'next';
  }

  // First, try to unload any existing instance on this container
  try {
    if (typeof window.NutrientViewer.unload === 'function') {
      window.NutrientViewer.unload(container);
    }
  } catch {
    // Ignore unload errors - might not have been loaded
  }

  // Ensure container is completely empty before loading
  // This prevents "container is not empty" errors
  try {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  } catch (error) {
    console.warn('Container cleanup warning:', error);
  }

  if (typeof window.NutrientViewer.load === 'function') {
    // Inject dark mode toggle into toolbar items before loading
    const darkModeState: { isDark: boolean; instance?: ViewerInstance } = { isDark: false };
    const darkModeItem = createDarkModeToolbarItem(darkModeState, container);

    if (options.toolbarItems && options.toolbarItems.length > 0) {
      // Insert before the last item (usually spacer) so it appears in the main toolbar area
      const spacerIndex = options.toolbarItems.findIndex((item: Record<string, unknown>) => item.type === 'spacer');
      if (spacerIndex >= 0) {
        options.toolbarItems.splice(spacerIndex, 0, darkModeItem);
      } else {
        options.toolbarItems.push(darkModeItem);
      }
    } else {
      // No custom toolbar items — will be added via setToolbarItems after load
      options._darkModeItem = darkModeItem;
    }

    return Promise.resolve()
      .then(() => window.NutrientViewer?.load(options))
      .then((instance: any) => {
        // PSPDFKit viewer instance type not available
        // If no custom toolbarItems were passed, add via setToolbarItems
        const deferredDarkModeItem = options._darkModeItem as ToolbarItem | undefined;
        if (deferredDarkModeItem) {
          instance.setToolbarItems((items: Record<string, unknown>[]) => {
            const idx = items.findIndex((item: Record<string, unknown>) => item.type === 'spacer');
            if (idx >= 0) {
              items.splice(idx, 0, deferredDarkModeItem);
              return [...items];
            }
            return [...items, deferredDarkModeItem];
          });
        }
        // Store reference so onPress can update the icon
        darkModeState.instance = instance;
        return instance;
      });
  }

  return Promise.reject(new Error('Nutrient Viewer load method not available'));
}

const MOON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

const SUN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

/**
 * Creates a dark mode toolbar item. The returned object can be
 * included in the `toolbarItems` array passed to `NutrientViewer.load()`.
 * The `state` object is shared so the onPress handler can reference
 * the viewer instance (set after load resolves).
 */
const DARK_MODE_STYLE_ID = 'pspdfkit-dark-mode-style';
const DARK_MODE_CSS = `
  .PSPDFKit-Spread { filter: invert(1) hue-rotate(-180deg); }
  .PSPDFKit-Viewport { background-color: #1a1a1a; }
`;

function createDarkModeToolbarItem(state: { isDark: boolean; instance?: ViewerInstance }, container: HTMLElement) {
  return {
    type: 'custom',
    id: 'dark-mode-toggle',
    title: 'Dark Mode',
    icon: MOON_ICON,
    onPress: () => {
      state.isDark = !state.isDark;

      // Inject or remove a <style> tag inside the viewer's shadow/iframe scope
      const root = container.querySelector('.PSPDFKit-Container')?.shadowRoot ?? container;
      const existing = root.querySelector(`#${DARK_MODE_STYLE_ID}`) as HTMLStyleElement | null;

      if (state.isDark && !existing) {
        const style = document.createElement('style');
        style.id = DARK_MODE_STYLE_ID;
        style.textContent = DARK_MODE_CSS;
        root.appendChild(style);
      } else if (!state.isDark && existing) {
        existing.remove();
      }

      // Update icon to reflect current state
      state.instance?.setToolbarItems((items: Record<string, unknown>[]) =>
        items.map((item: Record<string, unknown>) =>
          item.id === 'dark-mode-toggle' ? { ...item, icon: state.isDark ? SUN_ICON : MOON_ICON } : item,
        ),
      );
    },
  };
}

/**
 * Helper function to find the closest element with a specific class
 * Used for finding PSPDFKit-Page elements in the viewer
 */
export function closestByClass(el: Element | null, className: string): Element | null {
  if (!el) return null;
  return el.classList?.contains(className) ? el : closestByClass(el.parentElement, className);
}
