'use client';

import type React from 'react';
import { IconDate, IconInitials, IconSignature, IconTrashSmall } from '@/components/sign-design/icons';
import { getNutrientViewerRuntime } from '@/lib/nutrient-viewer';
import { useViewerInstance } from '../../../context/ViewerInstanceContext';
import { getFieldSpec } from './field-specs';
import type { FieldPlacement } from './types';
import { getInitials } from './utils';

interface FieldListProps {
  fieldPlacements: FieldPlacement[];
  setFieldPlacements: React.Dispatch<React.SetStateAction<FieldPlacement[]>>;
  signerRecipients: any[];
  recipientColors: Record<string, string>;
  updateFieldCount: (email: string, fieldType: string, increment: boolean) => void;
}

export function FieldList({
  fieldPlacements,
  setFieldPlacements,
  signerRecipients,
  recipientColors,
  updateFieldCount,
}: FieldListProps) {
  const { viewerInstanceRef } = useViewerInstance();

  if (fieldPlacements.length === 0) return null;

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Field Placements
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 250, overflowY: 'auto', padding: 2 }}>
        {fieldPlacements.map((field, i) => {
          const fieldRecipient = signerRecipients.find((r) => r.email === field.recipient);
          const fieldColor =
            field.recipient && recipientColors[field.recipient] ? recipientColors[field.recipient] : '#4A90E2';

          const focusField = () => {
            if (viewerInstanceRef.current) {
              try {
                const annotationElement = viewerInstanceRef.current.contentDocument.querySelector(
                  `.PSPDFKit-Annotation-Widget[name='${field.name}']`,
                );
                if (annotationElement) {
                  (annotationElement as HTMLElement).focus();
                  annotationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              } catch (error) {
                console.error('Error focusing annotation:', error);
              }
            }
          };

          return (
            <div
              id={`field-placement-${i}`}
              key={field.name || `field-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 8px',
                borderRadius: 'var(--r-1)',
                border: '1px solid var(--line)',
                borderLeft: `3px solid ${fieldColor}`,
                background: 'var(--surface)',
                fontSize: 'var(--text-sm)',
                transition: 'background .15s var(--ease)',
              }}
            >
              {/* Focus field button — flex 1 */}
              <button
                type="button"
                onClick={focusField}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
                  padding: 4,
                  background: 'transparent',
                  border: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 20,
                    height: 20,
                    color: fieldColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {field.type === 'signature' && <IconSignature aria-hidden="true" />}
                  {field.type === 'initials' && <IconInitials text={getInitials(fieldRecipient?.name)} />}
                  {field.type === 'date' && <IconDate aria-hidden="true" />}
                  {!['signature', 'initials', 'date'].includes(field.type) && (
                    <span style={{ fontSize: 10, fontWeight: 700 }}>
                      {field.type === 'checkbox'
                        ? '✓'
                        : field.type === 'email'
                          ? '@'
                          : field.type === 'name'
                            ? 'Aa'
                            : 'T'}
                    </span>
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, color: 'var(--ink)' }}>
                    <span style={{ fontWeight: 500 }}>{getFieldSpec(field.type)?.label ?? field.type}</span>
                    {fieldRecipient && (
                      <span style={{ color: 'var(--ink-3)', fontSize: 'var(--text-xs)' }}>
                        {fieldRecipient.name.split(' ')[0]}
                      </span>
                    )}
                  </span>
                  <div style={{ color: 'var(--ink-4)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                    Page {(field.pageIndex ?? 0) + 1} · {field.coordinates?.x}, {field.coordinates?.y}
                  </div>
                </span>
              </button>

              {/* Delete button */}
              <button
                type="button"
                aria-label="Remove field"
                onClick={() => {
                  if (viewerInstanceRef.current && field.name) {
                    const runtime = getNutrientViewerRuntime();
                    const instance = viewerInstanceRef.current;

                    if (runtime && instance) {
                      instance.getFormFields().then((formFields: any) => {
                        const formField = formFields.find((f: any) => f.name === field.name);

                        if (formField) {
                          const annotationIds = formField.annotationIds?.toArray() || [];

                          instance.delete(annotationIds).then(() => {
                            setFieldPlacements((prev) => prev.filter((f) => f.name !== field.name));

                            if (field.recipient) {
                              updateFieldCount(field.recipient, field.type, false);
                            }
                          });
                        } else {
                          console.error(`Form field not found: ${field.name}`);
                        }
                      });
                    }
                  }
                }}
                style={{
                  padding: '4px 6px',
                  background: 'transparent',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-1)',
                  color: 'var(--ink-3)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <IconTrashSmall aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
