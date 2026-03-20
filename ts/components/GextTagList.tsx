// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { GextTag } from '../types/GextTag';
import { GextTagBadge } from './GextTagBadge';

type Props = {
  tags: ReadonlyArray<GextTag>;
};

export function GextTagList({ tags }: Props): JSX.Element | null {
  if (!tags.length) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        marginInlineStart: 4,
      }}
    >
      {tags.map(tag => (
        <GextTagBadge key={tag.tagId} tag={tag} />
      ))}
    </div>
  );
}
