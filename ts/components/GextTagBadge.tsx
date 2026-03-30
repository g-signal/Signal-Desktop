// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { GextTag } from '../types/GextTag';

type Props = {
  tag: GextTag;
};

export function GextTagBadge({ tag }: Props): JSX.Element {
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
          height: 14,
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
        height: 14,
        fontSize: 10,
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
