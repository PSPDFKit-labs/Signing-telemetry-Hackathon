'use client';

import type React from 'react';
import { useContext, useEffect, useRef } from 'react';
import { FormPlacementContext } from '../../../context/FormPlacementContext';
import type { FieldOptionProps } from './types';

export const FieldOption = ({ icon, label, type, compact = false }: FieldOptionProps) => {
  const { formPlacementMode, currentRecipient, recipientColors, onCreateField } = useContext(FormPlacementContext);

  // Function to create icon background colors with good contrast in both modes
  const getIconBackgroundColor = (color: string | undefined): string => {
    // If no color is provided, use a default high-contrast color
    if (!color) return 'cornflowerblue';

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

    // Handle named colors or hex values - use as is but with fallback
    // Remove any transparency if present
    return color.split(',').length > 3 ? `${color.split(')')[0].replace(/rgba/i, 'rgb')})` : color || 'cornflowerblue';
  };
  // Track whether a drag operation started (to suppress onClick after drag)
  const didDragRef = useRef(false);
  // Reference to track touch position
  const touchStartRef = useRef({ x: 0, y: 0 });
  // Ref to store the element for adding non-passive event listeners
  const elementRef = useRef<HTMLButtonElement>(null);

  // Set up non-passive touch events
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Manual event listeners with { passive: false } to properly handle preventDefault
    const handleTouchMove = (e: TouchEvent) => {
      if (!formPlacementMode) return;
      e.preventDefault(); // This will work now with passive: false
      e.stopPropagation();
    };

    // Add event listener with { passive: false }
    element.addEventListener('touchmove', handleTouchMove, { passive: false });

    // Clean up
    return () => {
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [formPlacementMode]);

  // Handle drag start to set the field type data
  const handleDragStart = (e: React.DragEvent) => {
    // Prevent dragging if not in edit mode
    if (!formPlacementMode) {
      e.preventDefault();
      return;
    }

    didDragRef.current = true;
    e.dataTransfer.setData('fieldType', type);

    // Store the position where the user grabbed the element
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Calculate the percentage offset within the draggable element
    // This is more reliable across different sized elements
    const offsetXPercent = offsetX / rect.width;
    const offsetYPercent = offsetY / rect.height;

    // Store both the raw offsets and the percentage offsets
    e.dataTransfer.setData('offsetX', offsetX.toString());
    e.dataTransfer.setData('offsetY', offsetY.toString());
    e.dataTransfer.setData('offsetXPercent', offsetXPercent.toString());
    e.dataTransfer.setData('offsetYPercent', offsetYPercent.toString());
    e.dataTransfer.setData('elementWidth', rect.width.toString());
    e.dataTransfer.setData('elementHeight', rect.height.toString());
  };

  // React handlers for touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!formPlacementMode) return;

    // Record the starting touch position
    if (e.touches?.[0]) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  // This is kept but won't call preventDefault() since we handle that in the useEffect
  const handleTouchMove = (_e: React.TouchEvent) => {
    // Don't call preventDefault here as it will trigger the warning
    // It's handled by the non-passive event listener in useEffect
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!formPlacementMode) return;
    if (e.changedTouches?.[0]) {
      onCreateField?.(type);
    }
  };

  // Universal click handler — works for mouse, pointer (trackpad), and
  // synthesized clicks from touch taps. Covers iPadOS where drag/touch
  // events are unreliable.
  const handleClick = () => {
    if (!formPlacementMode) return;
    // Don't fire if this was a completed drag operation (desktop)
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onCreateField?.(type);
  };

  if (compact) {
    return (
      <button
        ref={elementRef}
        type="button"
        className="field-tile"
        draggable
        onClick={handleClick}
        onDragStart={handleDragStart}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: 'move', flexDirection: 'column', textAlign: 'center', padding: '10px 8px' }}
      >
        <span
          className="field-ico"
          style={{
            background: getIconBackgroundColor(
              recipientColors && currentRecipient ? recipientColors[currentRecipient.email] : undefined,
            ),
            color: '#0e1525',
            marginBottom: 4,
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>{label}</span>
      </button>
    );
  }

  return (
    <button
      ref={elementRef}
      type="button"
      className="field-tile"
      draggable
      onClick={handleClick}
      onDragStart={handleDragStart}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: 'move', width: '100%' }}
    >
      <span
        className="field-ico"
        style={{
          background: getIconBackgroundColor(
            recipientColors && currentRecipient ? recipientColors[currentRecipient.email] : undefined,
          ),
          color: '#0e1525',
        }}
      >
        {icon}
      </span>
      {label}
    </button>
  );
};
