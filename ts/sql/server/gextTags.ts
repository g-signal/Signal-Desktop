// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { GExtTag } from '../../types/GExtTag';
import type { ReadableDB, WritableDB } from '../Interface';

export function getGExtTagsByServiceId(
  db: ReadableDB,
  serviceId: string
): Array<GExtTag> | undefined {
  const row = db
    .prepare(
      'SELECT tags FROM gextRecipient WHERE serviceId = $serviceId'
    )
    .get({ serviceId }) as { tags: string } | undefined;

  if (!row) {
    return undefined;
  }

  return JSON.parse(row.tags) as Array<GExtTag>;
}

export function setGExtTags(
  db: WritableDB,
  serviceId: string,
  tags: Array<GExtTag>
): void {
  db.prepare(
    `
    INSERT INTO gextRecipient (serviceId, tags, lastUpdated)
    VALUES ($serviceId, $tags, $lastUpdated)
    ON CONFLICT (serviceId) DO UPDATE SET
      tags        = excluded.tags,
      lastUpdated = excluded.lastUpdated
    `
  ).run({
    serviceId,
    tags: JSON.stringify(tags),
    lastUpdated: Date.now(),
  });
}

export function deleteGExtTags(db: WritableDB, serviceId: string): void {
  db.prepare(
    'DELETE FROM gextRecipient WHERE serviceId = $serviceId'
  ).run({ serviceId });
}
