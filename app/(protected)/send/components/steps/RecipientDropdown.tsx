import { useContext, useState } from 'react';
import { IconCheck } from '@/components/sign-design/icons';
import { RecipientAvatar } from '@/components/sign-design/recipient-avatar';
import { FormPlacementContext } from '../../context/FormPlacementContext';

const RecipientDropdown = () => {
  const { currentRecipientIndex, setCurrentRecipientIndex, signerRecipients, recipientColors } =
    useContext(FormPlacementContext);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // If no signers at all, don't show anything
  if (signerRecipients.length === 0) {
    return null;
  }

  const currentRecipient = signerRecipients[currentRecipientIndex];

  // If there's only one signer, show a non-interactive display instead of dropdown
  const isSingleSigner = signerRecipients.length === 1;

  // Function to create a solid background color from the recipient's color
  const _getRecipientBackgroundColor = (color: string | undefined): string => {
    if (!color) return 'rgb(210, 225, 245)';

    // Extract RGB components if it's an rgba or rgb color
    if (color.startsWith('rgb')) {
      const matches = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (matches) {
        // Get the RGB values
        const r = parseInt(matches[1], 10);
        const g = parseInt(matches[2], 10);
        const b = parseInt(matches[3], 10);

        // For better visibility, return a solid color without transparency
        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    // Fallback for other color formats
    return color.split(',').length > 3 ? `${color.split(')')[0].replace(/rgba/i, 'rgb')})` : color;
  };

  // Function to create icon background colors with good contrast in both modes
  const getIconBackgroundColor = (color: string | undefined): string => {
    // If no color is provided, use a default high-contrast color
    if (!color) return 'rgb(118, 239, 182)';

    // For existing colors, we need to ensure they have enough saturation and brightness
    // Extract RGB components if it's an rgba or rgb color
    if (color.startsWith('rgb')) {
      // For rgb/rgba colors, transform to solid versions
      const matches = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (matches) {
        // Get the RGB values
        const r = parseInt(matches[1], 10);
        const g = parseInt(matches[2], 10);
        const b = parseInt(matches[3], 10);

        // Identify specific color types to handle them appropriately
        const isLightGreen = g > Math.max(r, b) && g > 180;
        const isLightPink = r > Math.max(g, b) && r > 180 && b > 100;
        const isPastel = (r > 160 && g > 160 && b > 160) || Math.max(r, g, b) - Math.min(r, g, b) < 60;

        // For the icon background, we want a slightly darker version of the color for better contrast
        // Apply moderate saturation boost and brightness adjustment for better visibility
        const saturationBoost = isPastel ? 1.2 : 1.0;
        const brightnessAdjust = isPastel ? 0.85 : 1.0;

        let rNew = r;
        let gNew = g;
        let bNew = b;

        // Apply saturation boost if needed (for pastel colors)
        if (isPastel) {
          const avg = (r + g + b) / 3;
          rNew = Math.min(255, Math.max(0, r > avg ? r + (r - avg) * saturationBoost : r));
          gNew = Math.min(255, Math.max(0, g > avg ? g + (g - avg) * saturationBoost : g));
          bNew = Math.min(255, Math.max(0, b > avg ? b + (b - avg) * saturationBoost : b));
        }

        // Apply brightness adjustment for pastel colors
        if (isPastel) {
          rNew *= brightnessAdjust;
          gNew *= brightnessAdjust;
          bNew *= brightnessAdjust;
        }

        // Special handling for problematic colors
        if (isLightGreen) {
          // Make light greens more visible
          gNew = Math.min(255, g);
          rNew = Math.max(0, r * 0.8);
          bNew = Math.max(0, b * 0.8);
        }

        if (isLightPink) {
          // Make light pinks more visible
          rNew = Math.min(255, r);
          gNew = Math.max(0, g * 0.8);
        }

        return `rgb(${Math.round(rNew)}, ${Math.round(gNew)}, ${Math.round(bNew)})`;
      }
    }

    // Handle named colors or hex values - remove any transparency if present
    return color.split(',').length > 3 ? `${color.split(')')[0].replace(/rgba/i, 'rgb')})` : color;
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Dropdown trigger */}
      <button
        type="button"
        disabled={isSingleSigner}
        onClick={() => !isSingleSigner && setIsDropdownOpen(!isDropdownOpen)}
        aria-label={isSingleSigner ? 'Only signer' : 'Select recipient'}
        aria-expanded={isSingleSigner ? undefined : isDropdownOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-2)',
          background: 'var(--bg-elev)',
          cursor: isSingleSigner ? 'default' : 'pointer',
          textAlign: 'left',
        }}
      >
        <RecipientAvatar
          name={currentRecipient.name}
          color={getIconBackgroundColor(recipientColors[currentRecipient.email])}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentRecipient.name}
          </div>
          {isSingleSigner && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)' }}>Only signer</div>}
        </div>
        {!isSingleSigner && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: 'var(--ink-3)', flexShrink: 0 }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>

      {/* Dropdown panel — only show if multiple signers */}
      {!isSingleSigner && isDropdownOpen && (
        <div
          style={{
            position: 'absolute',
            zIndex: 50,
            width: '100%',
            top: 'calc(100% + 4px)',
            left: 0,
            border: `2px solid ${recipientColors[currentRecipient.email]}`,
            borderRadius: 'var(--r-2)',
            background: 'var(--bg-elev)',
            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
            maxHeight: 256,
            overflowY: 'auto',
          }}
        >
          {signerRecipients.map((recipient, index) => {
            const isSelected = index === currentRecipientIndex;

            return (
              <button
                key={recipient.email}
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setCurrentRecipientIndex(index);
                }}
                aria-label={`Select ${recipient.name}`}
                aria-current={isSelected}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: isSelected ? 'var(--surface)' : 'transparent',
                  border: 0,
                  borderLeft: `3px solid ${isSelected ? recipientColors[recipient.email] : 'transparent'}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background .12s var(--ease)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RecipientAvatar
                    name={recipient.name}
                    color={getIconBackgroundColor(recipientColors[recipient.email])}
                  />
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {recipient.name}
                  </span>
                </div>
                {isSelected && (
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 'var(--r-1)',
                      background: getIconBackgroundColor(recipientColors[recipient.email]),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconCheck aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecipientDropdown;
