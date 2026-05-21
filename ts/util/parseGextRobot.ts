// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  GextRobot,
  GextRobotMsgButtonVisible,
} from '../types/GextRobot';
import { isRecord } from './isRecord';

const MSG_BUTTON_KEYS: ReadonlyArray<keyof GextRobotMsgButtonVisible> = [
  'text',
  'sticker',
  'camera',
  'microphone',
  'photos',
  'gif',
  'file',
  'contact',
  'location',
  'payment',
  'poll',
];

function parseMsgButtonVisible(raw: unknown): GextRobotMsgButtonVisible {
  // null / undefined / non-record → fall through to all-false defaults so
  // local data gets overwritten rather than preserved.
  const source = isRecord(raw) ? raw : {};
  const result = {} as GextRobotMsgButtonVisible;
  for (const key of MSG_BUTTON_KEYS) {
    result[key] = source[key] === true;
  }
  return result;
}

export function parseGextRobotFromServer(raw: unknown): GextRobot | null {
  // null / undefined / non-record → caller should clear local gextRobot.
  if (!isRecord(raw)) {
    return null;
  }

  const hasRobotField = 'robot' in raw;
  const hasMsgButtonField = 'msgButtonVisible' in raw;
  // Empty object or one with no recognized fields → also treat as cleared.
  if (!hasRobotField && !hasMsgButtonField) {
    return null;
  }

  const robot = raw.robot === true;
  const msgButtonVisible = parseMsgButtonVisible(raw.msgButtonVisible);

  return { robot, msgButtonVisible };
}
