'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconDashboard,
  IconDoc,
  IconInbox,
  IconPlus,
  IconSend,
  IconSignature,
  IconTemplates,
  IconUpload,
  IconUser,
} from '@/components/sign-design/icons';

type WorkspaceView = 'overview' | 'campaigns' | 'templates' | 'integration' | 'new-agreement';
type ExecutionPath = 'electronic' | 'sealed' | 'wet';

const campaignRows = [
  {
    name: '2026 Annual Lease Update',
    property: 'Portfolio-wide',
    recipients: 124,
    complete: 93,
    status: 'In progress',
    tone: 'progress',
  },
  {
    name: 'Parking Policy Acknowledgement',
    property: 'Cedar Grove',
    recipients: 214,
    complete: 198,
    status: 'In progress',
    tone: 'progress',
  },
  {
    name: 'Pet Addendum — Spring',
    property: 'Northpoint',
    recipients: 38,
    complete: 38,
    status: 'Complete',
    tone: 'complete',
  },
];

const templateRows = [
  ['Annual lease update', '3 documents', 'Updated Aug 28'],
  ['Pet addendum', '1 document', 'Updated Aug 12'],
  ['Parking policy acknowledgement', '2 documents', 'Updated Jul 31'],
  ['Move-in disclosure packet', '4 documents', 'Updated Jul 18'],
];

const steps = ['Packet', 'Recipients', 'Execution', 'Review'];

export function ResidentInterfacePoc({ liveWorkspaceReady }: { liveWorkspaceReady: boolean }) {
  const [view, setView] = useState<WorkspaceView>('overview');
  const [builderStep, setBuilderStep] = useState(0);
  const [executionPath, setExecutionPath] = useState<ExecutionPath>('electronic');
  const [created, setCreated] = useState(false);

  const startAgreement = () => {
    setBuilderStep(0);
    setExecutionPath('electronic');
    setCreated(false);
    setView('new-agreement');
  };

  return (
    <div className="ri-workspace">
      <aside className="ri-workspace-sidebar">
        <button
          type="button"
          className="ri-product-brand"
          aria-label="Resident Interface Agreements"
          onClick={() => setView('overview')}
        >
          <span className="ri-product-logo" aria-hidden="true">
            <svg viewBox="0 0 36 34" fill="none">
              <title>Resident Interface</title>
              <path d="M3 16.5 18 3l15 13.5V31H22V21h-8v10H3V16.5Z" />
              <path d="M8 14.5V8h6M28 14.5V8h-6M18 3v7" />
            </svg>
            <span>
              <strong>RESIDENT</strong>
              <b>INTERFACE</b>
            </span>
          </span>
        </button>

        <nav className="ri-workspace-nav" aria-label="Agreement workspace">
          <WorkspaceNavItem
            active={view === 'overview'}
            icon={<IconDashboard />}
            label="Overview"
            onClick={() => setView('overview')}
          />
          <WorkspaceNavItem
            active={view === 'campaigns'}
            icon={<IconSend />}
            label="Campaigns"
            count="3"
            onClick={() => setView('campaigns')}
          />
          <WorkspaceNavItem
            active={view === 'templates'}
            icon={<IconTemplates />}
            label="Templates"
            onClick={() => setView('templates')}
          />
          <WorkspaceNavItem
            active={view === 'integration'}
            icon={<IconInbox />}
            label="Integration"
            onClick={() => setView('integration')}
          />
        </nav>

        <div className="ri-sidebar-section">
          <span>Execution paths</span>
          <div>
            <IconSignature /> Electronic signing
          </div>
          <div>
            <IconCheck /> Optional digital seal
          </div>
          <div>
            <IconUpload /> Wet-sign return
          </div>
        </div>

        <div className="ri-sidebar-footer">
          <div className="ri-avatar">PS</div>
          <div>
            <strong>Demo workspace</strong>
            <span>Sample data</span>
          </div>
        </div>
      </aside>

      <main className="ri-workspace-main">
        <header className="ri-workspace-topbar">
          <div className="ri-breadcrumbs">
            <span>Resident Interface</span>
            <b>/</b>
            <strong>{view === 'new-agreement' ? 'New agreement' : viewLabel(view)}</strong>
          </div>
          <div className="ri-demo-controls">
            <span className="ri-demo-badge">
              <i /> Demo environment · no messages sent
            </span>
            {liveWorkspaceReady && (
              <Link href="/send" className="btn sm">
                Open live workspace <IconArrowRight />
              </Link>
            )}
          </div>
        </header>

        <div className="ri-workspace-content">
          {view === 'overview' && <Overview onCreate={startAgreement} onViewCampaigns={() => setView('campaigns')} />}
          {view === 'campaigns' && <Campaigns onCreate={startAgreement} />}
          {view === 'templates' && <Templates onCreate={startAgreement} />}
          {view === 'integration' && <Integration />}
          {view === 'new-agreement' && (
            <AgreementBuilder
              step={builderStep}
              executionPath={executionPath}
              created={created}
              onStepChange={setBuilderStep}
              onExecutionPathChange={setExecutionPath}
              onCreated={() => setCreated(true)}
              onClose={() => setView('overview')}
              onViewCampaigns={() => setView('campaigns')}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function WorkspaceNavItem({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {count && <small>{count}</small>}
    </button>
  );
}

function Overview({ onCreate, onViewCampaigns }: { onCreate: () => void; onViewCampaigns: () => void }) {
  return (
    <>
      <PageHeading
        eyebrow="Agreement operations"
        title="Resident agreements"
        description="Prepare document packets, execute resident campaigns, and reconcile completed agreements."
        action={
          <button type="button" className="btn" onClick={onCreate}>
            <IconPlus /> New agreement
          </button>
        }
      />

      <section className="ri-stat-grid" aria-label="Agreement summary">
        <Metric label="Open campaigns" value="3" detail="2 require attention" accent />
        <Metric label="Residents in flight" value="338" detail="Across 3 properties" />
        <Metric label="Completed" value="329" detail="97.3% completion rate" />
        <Metric label="Offline returns" value="7" detail="2 awaiting upload" />
      </section>

      <div className="ri-overview-grid">
        <section className="ri-workspace-card">
          <div className="ri-card-header">
            <div>
              <h2>Active campaigns</h2>
              <p>Resident agreement batches currently in progress.</p>
            </div>
            <button type="button" className="ri-text-button" onClick={onViewCampaigns}>
              View all <IconArrowRight />
            </button>
          </div>
          <CampaignTable compact />
        </section>

        <section className="ri-workspace-card ri-attention-card">
          <div className="ri-card-header">
            <div>
              <h2>Needs attention</h2>
              <p>Exceptions requiring a coordinator.</p>
            </div>
            <span className="ri-count-badge">2</span>
          </div>
          <div className="ri-attention-list">
            <div>
              <span className="ri-attention-icon warning">
                <IconUpload />
              </span>
              <div>
                <strong>Wet-signed copy ready</strong>
                <p>Avery Chen · Unit 412</p>
              </div>
              <span>Upload</span>
            </div>
            <div>
              <span className="ri-attention-icon neutral">
                <IconUser />
              </span>
              <div>
                <strong>Recipient data needs review</strong>
                <p>Annual Lease Update · 2 rows</p>
              </div>
              <span>Review</span>
            </div>
          </div>
        </section>
      </div>

      <section className="ri-capability-strip">
        <div className="ri-capability-heading">
          <span>Workflow coverage</span>
          <strong>One lifecycle for every execution path</strong>
        </div>
        {[
          [<IconDoc key="icon" />, 'Packets', 'Ordered multi-document envelopes'],
          [<IconUser key="icon" />, 'Bulk send', 'CSV-driven resident repapering'],
          [<IconSignature key="icon" />, 'Embedded', 'Resident stays in context'],
          [<IconUpload key="icon" />, 'Wet sign', 'Export and returned-PDF control'],
        ].map(([icon, label, detail]) => (
          <div className="ri-capability-item" key={String(label)}>
            <span>{icon}</span>
            <div>
              <strong>{label}</strong>
              <small>{detail}</small>
            </div>
            <IconCheck />
          </div>
        ))}
      </section>
    </>
  );
}

function Campaigns({ onCreate }: { onCreate: () => void }) {
  return (
    <>
      <PageHeading
        eyebrow="Repapering"
        title="Agreement campaigns"
        description="Track every resident envelope from preparation through completion."
        action={
          <button type="button" className="btn" onClick={onCreate}>
            <IconPlus /> New campaign
          </button>
        }
      />
      <section className="ri-workspace-card">
        <div className="ri-filter-bar">
          <div className="ri-filter active">
            All campaigns <span>3</span>
          </div>
          <div className="ri-filter">
            In progress <span>2</span>
          </div>
          <div className="ri-filter">
            Complete <span>1</span>
          </div>
        </div>
        <CampaignTable />
      </section>
    </>
  );
}

function CampaignTable({ compact = false }: { compact?: boolean }) {
  const rows = compact ? campaignRows.slice(0, 3) : campaignRows;
  return (
    <div className="ri-campaign-table">
      <div className="ri-campaign-head">
        <span>Campaign</span>
        <span>Residents</span>
        <span>Completion</span>
        <span>Status</span>
      </div>
      {rows.map((campaign) => {
        const percent = Math.round((campaign.complete / campaign.recipients) * 100);
        return (
          <div className="ri-campaign-row" key={campaign.name}>
            <div className="ri-campaign-name">
              <span className="ri-file-icon">
                <IconDoc />
              </span>
              <div>
                <strong>{campaign.name}</strong>
                <small>{campaign.property}</small>
              </div>
            </div>
            <span>{campaign.recipients}</span>
            <div className="ri-progress-cell">
              <div>
                <i style={{ width: `${percent}%` }} />
              </div>
              <span>
                {campaign.complete} / {campaign.recipients}
              </span>
            </div>
            <span className={`ri-state ${campaign.tone}`}>{campaign.status}</span>
          </div>
        );
      })}
    </div>
  );
}

function Templates({ onCreate }: { onCreate: () => void }) {
  return (
    <>
      <PageHeading
        eyebrow="Reusable documents"
        title="Agreement templates"
        description="Maintain approved packet structures and place resident fields once."
        action={
          <button type="button" className="btn" onClick={onCreate}>
            <IconPlus /> Create from template
          </button>
        }
      />
      <div className="ri-template-grid">
        {templateRows.map(([name, documents, updated], index) => (
          <article className="ri-template-card" key={name}>
            <div className="ri-template-preview">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <IconDoc />
              <i />
              <i />
              <i />
            </div>
            <div>
              <strong>{name}</strong>
              <span>{documents}</span>
            </div>
            <small>{updated}</small>
          </article>
        ))}
      </div>
    </>
  );
}

function Integration() {
  return (
    <>
      <PageHeading
        eyebrow="Embedded signing"
        title="Resident Interface integration"
        description="Keep the agreement experience in context while Nutrient handles document interaction and completion."
      />
      <div className="ri-integration-grid">
        <section className="ri-workspace-card ri-integration-flow-card">
          <div className="ri-card-header">
            <div>
              <h2>Signing session</h2>
              <p>Recipient-scoped, origin-restricted, and auditable.</p>
            </div>
            <span className="ri-state complete">Ready</span>
          </div>
          <div className="ri-integration-flow">
            <div>
              <span>01</span>
              <IconUser />
              <strong>Resident record</strong>
              <small>Agreement selected in Resident Interface</small>
            </div>
            <IconArrowRight />
            <div>
              <span>02</span>
              <IconSignature />
              <strong>Embedded signing</strong>
              <small>Verified recipient fields and PDF viewer</small>
            </div>
            <IconArrowRight />
            <div>
              <span>03</span>
              <IconCheck />
              <strong>Completed record</strong>
              <small>Final PDF and audit lifecycle reconciled</small>
            </div>
          </div>
        </section>
        <section className="ri-workspace-card ri-event-card">
          <div className="ri-card-header">
            <div>
              <h2>Lifecycle events</h2>
              <p>Versioned browser contract.</p>
            </div>
          </div>
          <div className="ri-event-list">
            {['ready', 'viewer-ready', 'submitting', 'completed', 'declined', 'error'].map((event, index) => (
              <div key={event}>
                <code>{event}</code>
                <span>{index < 4 ? 'Operational' : 'Exception'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="ri-workspace-card ri-security-card">
        <div>
          <span className="ri-security-icon">
            <IconCheck />
          </span>
          <div>
            <strong>Parent-origin enforcement</strong>
            <p>Only configured Resident Interface origins can frame the signing route.</p>
          </div>
        </div>
        <div>
          <span className="ri-security-icon">
            <IconCheck />
          </span>
          <div>
            <strong>Recipient isolation</strong>
            <p>Each signing session can update only fields assigned to its verified recipient.</p>
          </div>
        </div>
        <div>
          <span className="ri-security-icon">
            <IconCheck />
          </span>
          <div>
            <strong>Authoritative reconciliation</strong>
            <p>Browser events update the interface; backend state remains the source of truth.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function AgreementBuilder({
  step,
  executionPath,
  created,
  onStepChange,
  onExecutionPathChange,
  onCreated,
  onClose,
  onViewCampaigns,
}: {
  step: number;
  executionPath: ExecutionPath;
  created: boolean;
  onStepChange: (step: number) => void;
  onExecutionPathChange: (path: ExecutionPath) => void;
  onCreated: () => void;
  onClose: () => void;
  onViewCampaigns: () => void;
}) {
  if (created) {
    return (
      <div className="ri-created-state">
        <span>
          <IconCheck />
        </span>
        <small>CAMPAIGN CREATED</small>
        <h1>124 resident envelopes are ready.</h1>
        <p>
          The annual lease packet was prepared for every valid recipient. Two CSV rows remain in review and were not
          included.
        </p>
        <div className="ri-created-summary">
          <div>
            <span>Campaign</span>
            <strong>2026 Annual Lease Update</strong>
          </div>
          <div>
            <span>Envelope policy</span>
            <strong>{executionLabel(executionPath)}</strong>
          </div>
          <div>
            <span>Recipients</span>
            <strong>124 ready · 2 review</strong>
          </div>
        </div>
        <div className="ri-created-actions">
          <button type="button" className="btn" onClick={onViewCampaigns}>
            View campaign <IconArrowRight />
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Return to overview
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="New agreement campaign"
        title="2026 Annual Lease Update"
        description="Prepare the packet once, then create an isolated envelope for each resident."
        action={
          <button type="button" className="ri-close-button" onClick={onClose}>
            Close
          </button>
        }
      />

      <div className="ri-builder-shell">
        <nav className="ri-builder-steps" aria-label="Agreement preparation steps">
          {steps.map((label, index) => (
            <button
              type="button"
              key={label}
              className={index === step ? 'active' : index < step ? 'complete' : ''}
              onClick={() => onStepChange(index)}
            >
              <span>{index < step ? <IconCheck /> : index + 1}</span>
              <div>
                <strong>{label}</strong>
                <small>{stepDescription(index)}</small>
              </div>
            </button>
          ))}
        </nav>

        <section className="ri-builder-card">
          {step === 0 && <PacketStep />}
          {step === 1 && <RecipientStep />}
          {step === 2 && <ExecutionStep value={executionPath} onChange={onExecutionPathChange} />}
          {step === 3 && <ReviewStep executionPath={executionPath} />}

          <footer className="ri-builder-footer">
            <button
              type="button"
              className="btn ghost"
              disabled={step === 0}
              onClick={() => onStepChange(Math.max(0, step - 1))}
            >
              <IconArrowLeft /> Back
            </button>
            {step < 3 ? (
              <button type="button" className="btn" onClick={() => onStepChange(step + 1)}>
                Continue <IconArrowRight />
              </button>
            ) : (
              <button type="button" className="btn" onClick={onCreated}>
                Create 124 envelopes <IconArrowRight />
              </button>
            )}
          </footer>
        </section>
      </div>
    </>
  );
}

function PacketStep() {
  return (
    <div className="ri-builder-body">
      <BuilderIntro
        title="Assemble the agreement packet"
        description="Documents are signed as one ordered envelope. Drag to change the sequence."
      />
      <div className="ri-builder-document-list">
        {[
          ['01', 'Lease amendment.pdf', '8 pages'],
          ['02', 'Fee disclosure.pdf', '4 pages'],
          ['03', 'Resident consent.pdf', '6 pages'],
        ].map(([order, name, pages]) => (
          <div key={name}>
            <span className="ri-drag-handle">⠿</span>
            <span className="ri-document-order">{order}</span>
            <span className="ri-file-icon">
              <IconDoc />
            </span>
            <div>
              <strong>{name}</strong>
              <small>PDF document</small>
            </div>
            <span>{pages}</span>
          </div>
        ))}
      </div>
      <button type="button" className="ri-add-document">
        <IconPlus /> Add another document
      </button>
      <div className="ri-inline-confirmation">
        <IconCheck /> 3 documents · 18 pages · source boundaries retained
      </div>
    </div>
  );
}

function RecipientStep() {
  return (
    <div className="ri-builder-body">
      <BuilderIntro
        title="Import the resident batch"
        description="One envelope and signing link will be created for every valid CSV row."
      />
      <div className="ri-import-summary">
        <div>
          <span>Imported</span>
          <strong>126</strong>
        </div>
        <div>
          <span>Ready</span>
          <strong>124</strong>
        </div>
        <div>
          <span>Review</span>
          <strong>2</strong>
        </div>
        <button type="button">
          <IconUpload /> Replace CSV
        </button>
      </div>
      <div className="ri-recipient-table">
        <div>
          <span>Resident</span>
          <span>Email</span>
          <span>Unit</span>
          <span>Status</span>
        </div>
        {[
          ['Avery Chen', 'avery@example.com', '412'],
          ['Morgan Patel', 'morgan@example.com', '318'],
          ['Jordan Brooks', 'jordan@example.com', '207'],
        ].map(([name, email, unit]) => (
          <div key={email}>
            <strong>{name}</strong>
            <span>{email}</span>
            <span>{unit}</span>
            <small>READY</small>
          </div>
        ))}
      </div>
      <div className="ri-inline-confirmation">
        <IconCheck /> Fields will be placed once and assigned to each resident copy
      </div>
    </div>
  );
}

function ExecutionStep({ value, onChange }: { value: ExecutionPath; onChange: (path: ExecutionPath) => void }) {
  const options: Array<{ value: ExecutionPath; icon: React.ReactNode; title: string; body: string; tag: string }> = [
    {
      value: 'electronic',
      icon: <IconSignature />,
      title: 'Embedded electronic signing',
      body: 'Residents review and sign inside Resident Interface. Finalize as a trusted flattened PDF.',
      tag: 'RECOMMENDED',
    },
    {
      value: 'sealed',
      icon: <IconCheck />,
      title: 'Electronic + digital seal',
      body: 'Use the embedded flow and add a DWS cryptographic seal after all required signatures.',
      tag: 'OPTIONAL SEAL',
    },
    {
      value: 'wet',
      icon: <IconUpload />,
      title: 'Wet-sign exception',
      body: 'Export a printable packet, track the offline state, and return the signed PDF to the record.',
      tag: 'OFFLINE PATH',
    },
  ];

  return (
    <div className="ri-builder-body">
      <BuilderIntro
        title="Choose the execution path"
        description="The policy is stored and audited on every envelope in this campaign."
      />
      <div className="ri-execution-options">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? 'selected' : ''}
            onClick={() => onChange(option.value)}
          >
            <span className="ri-option-radio" />
            <span className="ri-option-icon">{option.icon}</span>
            <small>{option.tag}</small>
            <strong>{option.title}</strong>
            <p>{option.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewStep({ executionPath }: { executionPath: ExecutionPath }) {
  return (
    <div className="ri-builder-body">
      <BuilderIntro
        title="Review the campaign"
        description="Only valid recipients will receive an isolated copy of the prepared packet."
      />
      <div className="ri-review-grid">
        <div>
          <span>Campaign</span>
          <strong>2026 Annual Lease Update</strong>
          <small>Portfolio-wide</small>
        </div>
        <div>
          <span>Packet</span>
          <strong>3 documents</strong>
          <small>18 total pages</small>
        </div>
        <div>
          <span>Recipients</span>
          <strong>124 ready</strong>
          <small>2 held for review</small>
        </div>
        <div>
          <span>Execution</span>
          <strong>{executionLabel(executionPath)}</strong>
          <small>Per-envelope audit trail</small>
        </div>
      </div>
      <div className="ri-review-callout">
        <IconCheck />
        <div>
          <strong>Ready to create</strong>
          <p>This demo will simulate campaign creation. No email or external data will be sent.</p>
        </div>
      </div>
    </div>
  );
}

function BuilderIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="ri-builder-intro">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ri-page-heading">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article className={accent ? 'accent' : ''}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function viewLabel(view: WorkspaceView) {
  if (view === 'campaigns') return 'Campaigns';
  if (view === 'templates') return 'Templates';
  if (view === 'integration') return 'Integration';
  return 'Overview';
}

function stepDescription(index: number) {
  return ['3 documents', '124 ready', 'Embedded signing', 'Create envelopes'][index];
}

function executionLabel(path: ExecutionPath) {
  if (path === 'sealed') return 'Electronic + DWS seal';
  if (path === 'wet') return 'Wet-sign return';
  return 'Embedded electronic';
}
