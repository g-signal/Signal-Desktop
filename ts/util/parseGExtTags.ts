// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { GExtTag } from '../types/GExtTag';
import { isRecord } from './isRecord';

export function parseGExtTagsFromServer(raw: unknown): Array<GExtTag> {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: Array<GExtTag> = [];

  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }

    const { tagId, tagType } = item;
    if (typeof tagId !== 'string' || typeof tagType !== 'number') {
      continue;
    }
    if (tagType !== 0 && tagType !== 1 && tagType !== 2) {
      continue;
    }

    result.push({
      tagId,
      tagType,
      ...(typeof item.text === 'string' ? { text: item.text } : {}),
      ...(typeof item.imgBase64 === 'string'
        ? { imgBase64: item.imgBase64 }
        : {}),
      ...(typeof item.cssBackgroundColor === 'string'
        ? { cssBackgroundColor: item.cssBackgroundColor }
        : {}),
      ...(typeof item.cssColor === 'string'
        ? { cssColor: item.cssColor }
        : {}),
      ...(typeof item.cssOpacity === 'number'
        ? { cssOpacity: item.cssOpacity }
        : {}),
      ...(typeof item.cssBorderWidth === 'number'
        ? { cssBorderWidth: item.cssBorderWidth }
        : {}),
      ...(typeof item.cssBorderRadius === 'number'
        ? { cssBorderRadius: item.cssBorderRadius }
        : {}),
      ...(typeof item.cssBorderColor === 'string'
        ? { cssBorderColor: item.cssBorderColor }
        : {}),
      ...(typeof item.cssBorderStyle === 'string'
        ? { cssBorderStyle: item.cssBorderStyle }
        : {}),
    });
  }

  return result;
}
