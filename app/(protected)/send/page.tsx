'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import DocumentFlow from './components/DocumentFlow';
import DocumentSelection from './components/steps/DocumentSelection';
import EmailCustomization from './components/steps/EmailCustomization';
import FieldPlacement from './components/steps/FieldPlacement';
import RecipientConfig from './components/steps/RecipientConfig';
import ReviewAndSend from './components/steps/ReviewAndSend';
import { ViewerInstanceProvider } from './context/ViewerInstanceContext';

// Send for Signature workflow page
export default function SendPage() {
  return (
    <Suspense fallback={null}>
      <SendPageContent />
    </Suspense>
  );
}

function SendPageContent() {
  const searchParams = useSearchParams();
  const duplicateFrom = searchParams.get('duplicateFrom');

  return (
    <>
      <div className="app-page-head">
        <div>
          <h1 className="app-h1">Create resident agreement packet</h1>
          <p>Assemble documents, add recipients, and choose the electronic or wet-sign execution path.</p>
        </div>
      </div>
      <ViewerInstanceProvider>
        <DocumentFlow duplicateFrom={duplicateFrom}>
          {(state) => {
            switch (state.currentStep) {
              case 1:
                return <DocumentSelection />;
              case 2:
                return <RecipientConfig />;
              case 3:
                return <FieldPlacement />;
              case 4:
                return <EmailCustomization />;
              case 5:
                return <ReviewAndSend />;
              default:
                return <DocumentSelection />;
            }
          }}
        </DocumentFlow>
      </ViewerInstanceProvider>
    </>
  );
}
