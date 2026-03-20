// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type GextTag = {
  tagId: string;
  tagType: 0 | 1; // 0=text, 1=image
  text: string | null;
  imgBase64: string | null;
  cssBackgroundColor: string;
  cssColor: string;
  cssOpacity: number;
  cssBorderWidth: number;
  cssBorderRadius: number;
  cssBorderColor: string;
  cssBorderStyle: string;
};
