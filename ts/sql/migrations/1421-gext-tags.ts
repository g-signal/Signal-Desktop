// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import type { WritableDB } from '../Interface';

export const version = 1421;

export function updateToSchemaVersion1421(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1421) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      CREATE TABLE gextRecipient (
        serviceId   TEXT    NOT NULL PRIMARY KEY,
        tags        TEXT    NOT NULL,
        lastUpdated INTEGER NOT NULL
      ) STRICT;
    `);

    db.pragma('user_version = 1421');
  })();

  logger.info('updateToSchemaVersion1421: success!');
}
