// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import {
  LeftPaneDialog,
  LeftPaneDialogIcon,
  LeftPaneDialogIconBackground,
} from './LeftPaneDialog.dom.js';
import { WidthBreakpoint } from './_util.std.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser.dom.js';

export type Props = {
  containerWidthBreakpoint: WidthBreakpoint;
  i18n: LocalizerType;
};

const SUPPORT_PAGE =
  'https://ba-chat.com/';

export function WarningIdlePrimaryDeviceDialog({
  containerWidthBreakpoint,
  i18n,
  handleClose,
}: Props & { handleClose?: VoidFunction }): React.JSX.Element {
  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      type="info"
      icon={
        <LeftPaneDialogIconBackground type="warning">
          <LeftPaneDialogIcon type="error" />
        </LeftPaneDialogIconBackground>
      }
      {...(containerWidthBreakpoint === WidthBreakpoint.Narrow
        ? {
            onClick: () => openLinkInWebBrowser(SUPPORT_PAGE),
            clickLabel: i18n('icu:IdlePrimaryDevice__learnMore'),
            hasAction: false,
          }
        : { hasAction: false })}
      {...(handleClose == null
        ? { hasXButton: false }
        : {
            hasXButton: true,
            onClose: handleClose,
            closeLabel: i18n('icu:close'),
          })}
    >
      {i18n('icu:IdlePrimaryDevice__body')}
    </LeftPaneDialog>
  );
}
