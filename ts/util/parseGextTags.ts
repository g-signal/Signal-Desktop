// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { GextTag } from '../types/GextTag';
import { isRecord } from './isRecord';

export function parseGextTagsFromServer(raw: unknown): Array<GextTag> {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: Array<GextTag> = [];

  for (const item of raw) {
    if (!isRecord(item)) {
      continue;
    }

    const { tagId, tagType } = item;
    if (typeof tagId !== 'string' || typeof tagType !== 'number') {
      continue;
    }
    if (tagType !== 0 && tagType !== 1) {
      continue;
    }

    result.push({
      tagId,
      tagType,
      text: typeof item.text === 'string' ? item.text : null,
      imgBase64: typeof item.imgBase64 === 'string' ? item.imgBase64 : null,
      cssBackgroundColor:
        typeof item.cssBackgroundColor === 'string'
          ? item.cssBackgroundColor
          : 'transparent',
      cssColor: typeof item.cssColor === 'string' ? item.cssColor : '',
      cssOpacity: typeof item.cssOpacity === 'number' ? item.cssOpacity : 1,
      cssBorderWidth:
        typeof item.cssBorderWidth === 'number' ? item.cssBorderWidth : 0,
      cssBorderRadius:
        typeof item.cssBorderRadius === 'number' ? item.cssBorderRadius : 0,
      cssBorderColor:
        typeof item.cssBorderColor === 'string' ? item.cssBorderColor : '',
      cssBorderStyle:
        typeof item.cssBorderStyle === 'string' ? item.cssBorderStyle : 'solid',
    });
  }

  return result;
}
