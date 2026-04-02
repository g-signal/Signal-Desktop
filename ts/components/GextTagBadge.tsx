// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { GextTag } from '../types/GextTag';

type Props = {
  tag: GextTag;
  height?: number;
};

export function GextTagBadge({ tag, height = 14 }: Props): JSX.Element {
  if (tag.tagType === 1) {
    const src = tag.imgBase64?.startsWith('data:')
      ? tag.imgBase64
      : `data:image/png;base64,${tag.imgBase64}`;

    return (
      <img
        src={src}
        alt=""
        style={{
          width: 'auto',
          height,
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height,
        fontSize: Math.round(height * (10 / 14)),
        lineHeight: 1,
        flexShrink: 0,
        padding: '2px 4px',
        backgroundColor: tag.cssBackgroundColor,
        color: tag.cssColor,
        opacity: tag.cssOpacity,
        borderRadius: tag.cssBorderRadius,
        borderWidth: tag.cssBorderWidth,
        borderColor: tag.cssBorderColor,
        borderStyle: tag.cssBorderStyle || 'solid',
        whiteSpace: 'nowrap',
      }}
    >
      {tag.text}
    </span>
  );
}
