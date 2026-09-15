'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { IconCheck, IconClock, IconDoc, IconSearch } from '@/components/sign-design/icons';
import { TemplatePreviewDialog } from '@/components/template-preview-dialog';
import { PacketUpload, type PacketUploadResult } from '@/components/ui/packet-upload';
import { ReactDatePickerCustom } from '@/components/ui/react-datepicker';
import { toast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { extractFileExtension } from '@/lib/file-utils';
import type { PacketManifest } from '@/lib/document-packets';
import { useDocumentFlow } from '../../context/DocumentFlowContext';

interface Template {
  id: string;
  name: string;
  createdAt: string;
  templateFilePath: string;
  description?: string;
  size?: number;
  isSystem?: boolean;
  packetManifest?: PacketManifest | null;
}

export default function DocumentSelection() {
  const { state, dispatch } = useDocumentFlow();
  const searchParams = useSearchParams();
  const preselectedTemplateId = searchParams.get('templateId');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sampleTemplatesOpen, setSampleTemplatesOpen] = useState(true);
  const isMobile = useIsMobile();

  // Tab state — controlled so we can default based on preselectedTemplateId
  const [activeTab, setActiveTab] = useState<'upload' | 'template'>(preselectedTemplateId ? 'template' : 'upload');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const templatesPerPage = isMobile ? 4 : 6;

  // Fetch available templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/templates');
        if (!response.ok) throw new Error('Failed to fetch templates');

        const data = await response.json();
        // Make sure we capture the size information from the API response
        const templatesWithSize = (data.templates || []).map((template: any) => ({
          ...template,
          size: template.size || template.file_size || undefined,
        }));

        setTemplates(templatesWithSize);
        setFilteredTemplates(templatesWithSize);
      } catch (error) {
        console.error('Error fetching templates:', error);
        toast({
          title: 'Error',
          description: 'Failed to load document templates',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Filter templates when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTemplates(templates);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = templates.filter(
        (template) =>
          template.name.toLowerCase().includes(query) || template.description?.toLowerCase().includes(query),
      );
      setFilteredTemplates(filtered);
    }

    // Reset pagination to first page when search changes
    setCurrentPage(1);
  }, [searchQuery, templates]);

  // Validate step when document is selected or uploaded
  useEffect(() => {
    const isValid = Boolean(state.document.url || state.document.templateId);
    dispatch({
      type: 'VALIDATE_STEP',
      payload: { step: 'step1Valid', isValid },
    });
  }, [state.document.url, state.document.templateId, dispatch]);

  // Handle template selection
  const handleSelectTemplate = useCallback(
    (templateId: string, templateUrl: string) => {
      // If the template is already selected, unselect it
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);

        // Clear the template from the document state
        dispatch({
          type: 'SET_DOCUMENT',
          payload: {
            templateId: undefined,
            url: undefined,
            title: '',
            packetManifest: undefined,
          },
        });
      } else {
        // Otherwise, select the new template
        setSelectedTemplateId(templateId);

        dispatch({
          type: 'SET_DOCUMENT',
          payload: {
            templateId,
            url: templateUrl,
            title: templates.find((t) => t.id === templateId)?.name || '',
            packetManifest: templates.find((t) => t.id === templateId)?.packetManifest ?? undefined,
          },
        });
      }
    },
    [selectedTemplateId, templates, dispatch],
  );

  // Auto-select template from query param
  useEffect(() => {
    if (preselectedTemplateId && templates.length > 0 && !selectedTemplateId) {
      const template = templates.find((t) => t.id === preselectedTemplateId);
      if (template) {
        handleSelectTemplate(template.id, template.templateFilePath);
      }
    }
  }, [preselectedTemplateId, templates, selectedTemplateId, handleSelectTemplate]);

  // Split templates into system and user groups
  const systemTemplates = filteredTemplates.filter((t) => t.isSystem);
  const userTemplates = filteredTemplates.filter((t) => !t.isSystem);

  // Pagination applies only to user templates (system templates are always shown)
  const indexOfLastTemplate = currentPage * templatesPerPage;
  const indexOfFirstTemplate = indexOfLastTemplate - templatesPerPage;
  const currentUserTemplates = userTemplates.slice(indexOfFirstTemplate, indexOfLastTemplate);

  // Calculate total pages based on user templates only
  const totalPages = Math.ceil(userTemplates.length / templatesPerPage);

  // Generate page numbers for pagination
  const pageNumbers: (number | 'ellipsis')[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    if (isMobile) {
      // Simpler pagination for mobile
      pageNumbers.push(1);
      if (currentPage !== 1 && currentPage !== totalPages) {
        pageNumbers.push(currentPage);
      }
      if (totalPages > 1) {
        pageNumbers.push(totalPages);
      }
    } else {
      pageNumbers.push(1);
      if (currentPage <= 3) {
        pageNumbers.push(2, 3, 'ellipsis', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push('ellipsis', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pageNumbers.push('ellipsis', currentPage, 'ellipsis', totalPages);
      }
    }
  }

  // Handle document upload completion
  const handleUploadComplete = (fileData: PacketUploadResult) => {
    dispatch({
      type: 'SET_DOCUMENT',
      payload: {
        url: fileData.url,
        title: fileData.name,
        fileSize: fileData.size || 0, // Store file size in the document state
        packetManifest: fileData.packetManifest,
      },
    });

    toast({
      title: 'Document Uploaded',
      description: 'Your document has been uploaded successfully.',
    });
  };

  // Handle document expiration date change
  const handleExpirationDateChange = (date: Date | undefined) => {
    dispatch({
      type: 'SET_DOCUMENT',
      payload: { expiresAt: date },
    });
  };

  // Handle document title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: 'SET_DOCUMENT',
      payload: { title: e.target.value },
    });
  };

  // Handle save as template checkbox change
  const handleSaveAsTemplateChange = (checked: boolean) => {
    dispatch({
      type: 'SET_DOCUMENT',
      payload: { saveAsTemplate: checked },
    });
  };

  // Handle template name change
  const _handleTemplateNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: 'SET_DOCUMENT',
      payload: { templateName: e.target.value },
    });
  };

  // Format file size helper
  const formatSize = (size?: number) => {
    if (!size) return 'N/A';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render a template row (used for both system and user templates)
  const renderTemplateRow = (template: Template, index: number) => {
    const isSelected = selectedTemplateId === template.id;
    const fileExt = (extractFileExtension(template.templateFilePath) || 'doc').toUpperCase();

    return (
      <button
        key={template.id}
        type="button"
        onClick={() => handleSelectTemplate(template.id, template.templateFilePath)}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '28px 1fr 60px 80px 32px',
          gap: 'var(--space-3)',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-4)',
          borderTop: index > 0 ? '1px solid var(--line)' : 'none',
          borderRight: 'none',
          borderBottom: 'none',
          borderLeft: 'none',
          background: isSelected ? 'var(--brand-accent-tint)' : 'transparent',
          color: 'inherit',
          textAlign: 'left',
          borderRadius: 0,
          cursor: 'pointer',
          transition: 'background .12s',
        }}
      >
        {/* Check icon */}
        <span
          style={{ color: isSelected ? 'var(--brand-accent)' : 'transparent', display: 'flex', alignItems: 'center' }}
        >
          <IconCheck width={16} height={16} />
        </span>

        {/* Name + kind tag */}
        <span style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
          <span
            className="doc-name"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'var(--text-sm)',
              fontWeight: isSelected ? 600 : 500,
            }}
          >
            {template.name}
          </span>
          {template.isSystem && <span className="tag">Sample</span>}
        </span>

        {/* File type tag */}
        <span className="tag">{fileExt}</span>

        {/* File size */}
        <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 'var(--text-xs)' }}>
          {formatSize(template.size)}
        </span>

        {/* Preview icon — TemplatePreviewDialog already calls e.stopPropagation() internally */}
        <TemplatePreviewDialog
          templateId={template.id}
          templateFilePath={template.templateFilePath}
          templateName={template.name}
        />
      </button>
    );
  };

  // Expiration date field — shared by both tabs
  const expirationField = (id: string) => (
    <div className="field" style={{ marginTop: 'var(--space-5)' }}>
      <label htmlFor={id}>
        Document expiration date{' '}
        <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-4)' }}>(optional)</span>
      </label>
      <ReactDatePickerCustom
        id={id}
        date={state.document.expiresAt}
        setDate={handleExpirationDateChange}
        placeholder="Set document expiration date"
        minDate={new Date()}
      />
      <span className="hint">
        <IconClock />
        If set, the document cannot be signed after this date.
      </span>
    </div>
  );

  return (
    <div>
      {/* Heading */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-h2)', fontWeight: 600 }}>Document Selection</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--ink-3)', fontSize: 'var(--text-sm)' }}>
          Choose an existing template or upload a new document to send for signing.
        </p>
      </div>

      {/* Segmented tab toggle */}
      <div className="tab-segmented">
        <button type="button" aria-pressed={activeTab === 'upload'} onClick={() => setActiveTab('upload')}>
          Upload New Document
        </button>
        <button type="button" aria-pressed={activeTab === 'template'} onClick={() => setActiveTab('template')}>
          Use Template
        </button>
      </div>

      {/* ── Upload tab ────────────────────────────────────────────────── */}
      {activeTab === 'upload' && (
        <div>
          {!state.document.url ? (
            /* Stage A/B — FileUpload renders dashed dropzone or ready-to-upload card */
            <PacketUpload
              onUploadComplete={handleUploadComplete}
              onError={(message) => {
                toast({
                  title: 'Upload Error',
                  description: message,
                  variant: 'destructive',
                });
              }}
            />
          ) : (
            /* Stage C — Uploaded card */
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-2)',
                padding: 'var(--space-4) var(--space-5)',
                background: 'var(--bg-elev)',
              }}
            >
              {/* Top row: file icon tile · filename + meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                {/* File icon tile */}
                <div
                  style={{
                    width: 44,
                    height: 56,
                    borderRadius: 4,
                    background: 'var(--brand-accent-tint)',
                    color: 'var(--brand-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '.04em',
                    position: 'relative',
                  }}
                >
                  <svg
                    aria-hidden="true"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ position: 'absolute', top: 8 }}
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <span style={{ position: 'absolute', bottom: 6 }}>
                    {(extractFileExtension(state.document.url) || 'DOC').toUpperCase()}
                  </span>
                </div>

                {/* Filename + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: 'var(--ink)',
                      fontWeight: 500,
                      fontSize: 'var(--text-sm)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {state.document.title}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 6,
                      fontSize: 'var(--text-xs)',
                      color: 'var(--ink-3)',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '.04em',
                    }}
                  >
                    <span>{state.document.fileSize ? formatSize(state.document.fileSize) : '—'}</span>
                    {state.document.packetManifest && (
                      <>
                        <span style={{ opacity: 0.4 }}>&middot;</span>
                        <span>
                          {state.document.packetManifest.documentCount} document
                          {state.document.packetManifest.documentCount === 1 ? '' : 's'} ·{' '}
                          {state.document.packetManifest.pageCount} pages
                        </span>
                      </>
                    )}
                    <span style={{ opacity: 0.4 }}>&middot;</span>
                    <span
                      style={{
                        color: 'rgb(40, 130, 80)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                      Uploaded
                    </span>
                  </div>
                </div>
              </div>

              {/* Divider + bottom row: Remove (left) · Save-as-template checkbox (right) */}
              <div
                style={{
                  marginTop: 'var(--space-4)',
                  paddingTop: 'var(--space-4)',
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--space-3)',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  className="btn ghost"
                  style={{
                    color: 'rgb(180, 60, 60)',
                    borderColor: 'color-mix(in srgb, rgb(180, 60, 60) 40%, var(--line))',
                  }}
                  onClick={() =>
                    dispatch({
                      type: 'SET_DOCUMENT',
                      payload: {
                        url: undefined,
                        title: '',
                        fileSize: 0,
                        templateId: undefined,
                        expiresAt: undefined,
                        saveAsTemplate: false,
                        packetManifest: undefined,
                      },
                    })
                  }
                >
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                  Remove
                </button>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--ink-2)',
                    marginLeft: 'auto',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={state.document.saveAsTemplate ?? false}
                    onChange={(e) => handleSaveAsTemplateChange(e.target.checked)}
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      width: 16,
                      height: 16,
                      border: `1.5px solid ${state.document.saveAsTemplate ? 'var(--brand-accent)' : 'var(--line-strong)'}`,
                      borderRadius: 3,
                      background: state.document.saveAsTemplate ? 'var(--brand-accent)' : 'var(--bg-elev)',
                      position: 'relative',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                  <span>Save as template for future use</span>
                </label>
              </div>
            </div>
          )}

          {/* Document title — only after upload */}
          {state.document.url && (
            <div className="field" style={{ marginTop: 'var(--space-5)' }}>
              <label htmlFor="document-title">Document title</label>
              <input
                type="text"
                id="document-title"
                value={state.document.title}
                onChange={handleTitleChange}
                placeholder="Enter document title"
              />
            </div>
          )}

          {expirationField('document-expiration')}
        </div>
      )}

      {/* ── Template tab ──────────────────────────────────────────────── */}
      {activeTab === 'template' && (
        <div>
          {/* Search field */}
          <div className="field" style={{ marginBottom: 'var(--space-4)', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-4)',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'none',
                }}
              >
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search templates…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 32, width: '100%' }}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="empty">
              <div className="icon">
                <IconDoc />
              </div>
              <h3>Loading templates&hellip;</h3>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="empty">
              <div className="icon">
                <IconDoc />
              </div>
              <h3>
                {searchQuery.trim() !== ''
                  ? 'No templates match your search.'
                  : 'No templates found. Upload a document and save it as a template first.'}
              </h3>
            </div>
          ) : (
            <>
              {/* System / Sample Templates */}
              {systemTemplates.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      marginBottom: 8,
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                    onClick={() => setSampleTemplatesOpen((o) => !o)}
                    aria-expanded={sampleTemplatesOpen}
                  >
                    <span className="eyebrow">Sample Templates</span>
                    <span
                      style={{
                        color: 'var(--ink-3)',
                        fontSize: 'var(--text-xs)',
                        transform: sampleTemplatesOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        display: 'inline-block',
                        transition: 'transform .15s',
                      }}
                    >
                      ▾
                    </span>
                  </button>

                  {sampleTemplatesOpen && (
                    <div
                      style={{
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--r-2)',
                        overflow: 'hidden',
                      }}
                    >
                      {systemTemplates.map((template, i) => renderTemplateRow(template, i))}
                    </div>
                  )}
                </div>
              )}

              {/* User Templates */}
              <div>
                <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>
                  Your Templates
                </span>

                {userTemplates.length === 0 ? (
                  <div className="empty">
                    <div className="icon">
                      <IconDoc />
                    </div>
                    <h3>No templates yet</h3>
                    <p>Templates you save will appear here.</p>
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-2)',
                      overflow: 'hidden',
                    }}
                  >
                    {currentUserTemplates.map((template, i) => renderTemplateRow(template, i))}
                  </div>
                )}
              </div>

              {/* Pagination for user templates */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--space-2)',
                    marginTop: 'var(--space-4)',
                  }}
                >
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    style={{ opacity: currentPage === 1 ? 0.4 : 1 }}
                  >
                    ← Prev
                  </button>

                  {pageNumbers.map((page, _index) =>
                    page === 'ellipsis' ? (
                      <span
                        key={`ellipsis-after-${pageNumbers[_index - 1]}`}
                        style={{ color: 'var(--ink-3)', fontSize: 'var(--text-xs)', padding: '0 4px' }}
                      >
                        &hellip;
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        className="btn ghost sm"
                        onClick={() => setCurrentPage(page)}
                        style={{
                          background: currentPage === page ? 'var(--brand-accent)' : undefined,
                          color: currentPage === page ? 'var(--brand-accent-fg)' : undefined,
                          borderColor: currentPage === page ? 'var(--brand-accent)' : undefined,
                          minWidth: 36,
                        }}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    style={{ opacity: currentPage === totalPages ? 0.4 : 1 }}
                  >
                    Next →
                  </button>
                </div>
              )}

              {/* Expiration date — only show when a template is selected */}
              {selectedTemplateId && expirationField('template-document-expiration')}
            </>
          )}
        </div>
      )}
    </div>
  );
}
