// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tag type:
 *   0 = text only
 *   1 = image only
 *   2 = text + image
 */
export type GExtTagType = 0 | 1 | 2;

export type GExtTag = {
  tagId: string;
  tagType: GExtTagType;
  text?: string;
  imgBase64?: string;
  cssBackgroundColor?: string;
  cssColor?: string;
  cssOpacity?: number;
  cssBorderWidth?: number;
  cssBorderRadius?: number;
  cssBorderColor?: string;
  cssBorderStyle?: string;
};
