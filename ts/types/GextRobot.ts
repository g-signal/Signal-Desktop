// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type GextRobotMsgButtonVisible = {
  text: boolean;
  sticker: boolean;
  camera: boolean;
  microphone: boolean;
  photos: boolean;
  gif: boolean;
  file: boolean;
  contact: boolean;
  location: boolean;
  payment: boolean;
  poll: boolean;
};

export type GextRobot = {
  robot: boolean;
  msgButtonVisible: GextRobotMsgButtonVisible;
};
