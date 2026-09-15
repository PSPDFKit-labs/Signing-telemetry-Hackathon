// This file contains global type declarations for the application

declare interface Window {
  NutrientViewer?: {
    // Core SDK methods
    load: (options: {
      container: HTMLElement;
      document: string;
      toolbarItems?: any[];
      licenseKey?: string;
      styleSheets?: string[];
      customRenderers?: any;
      enableHistory?: boolean;
      electronicSignatures?: any;
      [key: string]: any;
    }) => Promise<any>; // Returns a Promise that resolves to the instance

    unload: (container: HTMLElement | null) => void;
    defaultToolbarItems?: any[];

    // Classes and utilities
    Geometry: {
      Rect: new (options: { left: number; top: number; width: number; height: number }) => any;
    };

    Color: new (options: { r: number; g: number; b: number }) => any;

    Annotations: {
      WidgetAnnotation: new (options: {
        boundingBox: any;
        formFieldName: string;
        id: string;
        pageIndex: number;
        name: string;
      }) => any;
      TextAnnotation: new (options: {
        pageIndex: number;
        boundingBox: any;
        text: { format: string; value: string };
        font?: string;
        fontSize?: number;
        fontColor?: any;
        horizontalAlign?: string;
        isFitting?: boolean;
        callout?: null;
      }) => any;
      toSerializableObject: (annotation: any) => any;
      fromSerializableObject: (serialized: any) => any;
    };

    FormFields: {
      SignatureFormField: new (options: { annotationIds: any; name: string; type?: string }) => any;
      TextFormField: new (options: { annotationIds: any; name: string; defaultValue?: string }) => any;
    };

    // Utilities and constants
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

    // Add any other properties you use from the SDK
  };
}
