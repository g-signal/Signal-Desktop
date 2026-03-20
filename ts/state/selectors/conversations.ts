// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { isNumber, pick } from 'lodash';
import { createSelector } from 'reselect';

import type { StateType } from '../reducer';

import type {
  ConversationLookupType,
  ConversationMessageType,
  ConversationsStateType,
  ConversationType,
  ConversationVerificationData,
  MessageLookupType,
  MessagesByConversationType,
  MessageTimestamps,
  PreJoinConversationType,
} from '../ducks/conversations';
import type { GextTag } from '../../types/GextTag';
import type { StoriesStateType, StoryDataType } from '../ducks/stories';
import {
  ComposerStep,
  OneTimeModalState,
  ConversationVerificationState,
} from '../ducks/conversationsEnums';
import { getOwn } from '../../util/getOwn';
import type { UUIDFetchStateType } from '../../util/uuidFetchState';
import { deconstructLookup } from '../../util/deconstructLookup';
import type { PropsDataType as TimelinePropsType } from '../../components/conversation/Timeline';
import { assertDev } from '../../util/assert';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import { filterAndSortConversations } from '../../util/filterAndSortConversations';
import type { ContactNameColorType } from '../../types/Colors';
import { ContactNameColors } from '../../types/Colors';
import type { AvatarDataType } from '../../types/Avatar';
import type { AciString, ServiceIdString } from '../../types/ServiceId';
import { normalizeServiceId } from '../../types/ServiceId';
import { isInSystemContacts } from '../../util/isInSystemContacts';
import { isSignalConnection } from '../../util/getSignalConnections';
import { sortByTitle } from '../../util/sortByTitle';
import { DurationInSeconds } from '../../util/durations';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
} from '../../util/whatTypeOfConversation';
import { isGroupInStoryMode } from '../../util/isGroupInStoryMode';

import {
  getIntl,
  getRegionCode,
  getUserConversationId,
  getUserNumber,
} from './user';
import { getPinnedConversationIds } from './items';
import { createLogger } from '../../logging/log';
import { TimelineMessageLoadingState } from '../../util/timelineUtil';
import { isSignalConversation } from '../../util/isSignalConversation';
import { reduce } from '../../util/iterables';
import { getConversationTitleForPanelType } from '../../util/getConversationTitleForPanelType';
import type { PanelRenderType } from '../../types/Panels';
import type { HasStories } from '../../types/Stories';
import { getHasStoriesSelector } from './stories2';
import { canEditMessage } from '../../util/canEditMessage';
import { isOutgoing } from '../../messages/helpers';
import {
  countAllConversationsUnreadStats,
  type UnreadStats,
} from '../../util/countUnreadStats';

const log = createLogger('conversations');

export type ConversationWithStoriesType = ConversationType & {
  hasStories?: HasStories;
};

let placeholderContact: ConversationType;
export const PLACEHOLDER_CONTACT_ID = 'placeholder-contact';
export const getPlaceholderContact = (): ConversationType => {
  if (placeholderContact) {
    return placeholderContact;
  }

  placeholderContact = {
    acceptedMessageRequest: false,
    badges: [],
    id: PLACEHOLDER_CONTACT_ID,
    type: 'direct',
    title: window.i18n('icu:unknownContact'),
    isMe: false,
    sharedGroupNames: [],
  };
  return placeholderContact;
};

export const getConversations = (state: StateType): ConversationsStateType =>
  state.conversations;

export const getPreJoinConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): PreJoinConversationType | undefined => {
    return state.preJoinConversation;
  }
);
export const getConversationLookup = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationLookup;
  }
);

export const getConversationsByServiceId = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByServiceId;
  }
);

export const getConversationsByE164 = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByE164;
  }
);

export const getConversationsByGroupId = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByGroupId;
  }
);
export const getHasPanelOpen = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    return state.targetedConversationPanels.watermark > 0;
  }
);
export const getConversationsByUsername = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByUsername;
  }
);

export const getAllConversations = createSelector(
  getConversationLookup,
  (lookup): Array<ConversationType> => Object.values(lookup)
);

export const getAllSignalConnections = createSelector(
  getAllConversations,
  (conversations): Array<ConversationType> =>
    conversations.filter(isSignalConnection)
);

export const getSafeConversationWithSameTitle = createSelector(
  getAllConversations,
  (
    _state: StateType,
    {
      possiblyUnsafeConversation,
    }: {
      possiblyUnsafeConversation: ConversationType;
    }
  ) => possiblyUnsafeConversation,
  (conversations, possiblyUnsafeConversation): ConversationType | undefined => {
    const conversationsWithSameTitle = conversations.filter(conversation => {
      return conversation.title === possiblyUnsafeConversation.title;
    });
    assertDev(
      conversationsWithSameTitle.length,
      'Expected at least 1 conversation with the same title (this one)'
    );

    const safeConversation = conversationsWithSameTitle.find(
      otherConversation =>
        otherConversation.acceptedMessageRequest &&
        otherConversation.type === 'direct' &&
        otherConversation.id !== possiblyUnsafeConversation.id
    );

    return safeConversation;
  }
);

export const getSelectedConversationId = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.selectedConversationId;
  }
);

type TargetedMessageType = {
  id: string;
  counter: number;
};
export const getTargetedMessage = createSelector(
  getConversations,
  (state: ConversationsStateType): TargetedMessageType | undefined => {
    if (!state.targetedMessage) {
      return undefined;
    }

    return {
      id: state.targetedMessage,
      counter: state.targetedMessageCounter,
    };
  }
);
export const getTargetedMessageSource = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.targetedMessageSource;
  }
);
export const getSelectedMessageIds = createSelector(
  getConversations,
  (state: ConversationsStateType): ReadonlyArray<string> | undefined => {
    return state.selectedMessageIds;
  }
);
export const getLastSelectedMessage = createSelector(
  getConversations,
  (state: ConversationsStateType): MessageTimestamps | undefined => {
    return state.lastSelectedMessage;
  }
);

export const getShowArchived = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    return Boolean(state.showArchived);
  }
);

const getComposerState = createSelector(
  getConversations,
  (state: ConversationsStateType) => state.composer
);

export const getComposerStep = createSelector(
  getComposerState,
  (composerState): undefined | ComposerStep => composerState?.step
);

export const hasGroupCreationError = createSelector(
  getComposerState,
  (composerState): boolean => {
    if (composerState?.step === ComposerStep.SetGroupMetadata) {
      return composerState.hasError;
    }
    return false;
  }
);

export const isCreatingGroup = createSelector(
  getComposerState,
  (composerState): boolean =>
    composerState?.step === ComposerStep.SetGroupMetadata &&
    composerState.isCreating
);

export const isEditingAvatar = createSelector(
  getComposerState,
  (composerState): boolean =>
    composerState?.step === ComposerStep.SetGroupMetadata &&
    composerState.isEditingAvatar
);

export const getComposeAvatarData = createSelector(
  getComposerState,
  (composerState): ReadonlyArray<AvatarDataType> =>
    composerState?.step === ComposerStep.SetGroupMetadata
      ? composerState.userAvatarData
      : []
);

export const getMessages = createSelector(
  getConversations,
  (state: ConversationsStateType): MessageLookupType => {
    return state.messagesLookup;
  }
);
export const getMessagesByConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): MessagesByConversationType => {
    return state.messagesByConversation;
  }
);

export const getConversationMessages = createSelector(
  getSelectedConversationId,
  getMessagesByConversation,
  (
    conversationId,
    messagesByConversation
  ): ConversationMessageType | undefined => {
    return conversationId ? messagesByConversation[conversationId] : undefined;
  }
);

const collator = new Intl.Collator();

// Note: we will probably want to put i18n and regionCode back when we are formatting
//   phone numbers and contacts from scratch here again.
export const _getConversationComparator = () => {
  return (left: ConversationType, right: ConversationType): number => {
    // These two fields can be sorted with each other; they are timestamps
    const leftTimestamp = left.lastMessageReceivedAtMs || left.timestamp;
    const rightTimestamp = right.lastMessageReceivedAtMs || right.timestamp;
    if (leftTimestamp && !rightTimestamp) {
      return -1;
    }
    if (rightTimestamp && !leftTimestamp) {
      return 1;
    }
    if (leftTimestamp && rightTimestamp && leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    // This field looks like a timestamp, but is actually a counter
    const leftCounter = left.lastMessageReceivedAt;
    const rightCounter = right.lastMessageReceivedAt;
    if (leftCounter && !rightCounter) {
      return -1;
    }
    if (rightCounter && !leftCounter) {
      return 1;
    }
    if (leftCounter && rightCounter && leftCounter !== rightCounter) {
      return rightCounter - leftCounter;
    }

    if (
      typeof left.inboxPosition === 'number' &&
      typeof right.inboxPosition === 'number'
    ) {
      return right.inboxPosition > left.inboxPosition ? -1 : 1;
    }

    if (typeof left.inboxPosition === 'number' && right.inboxPosition == null) {
      return -1;
    }

    if (typeof right.inboxPosition === 'number' && left.inboxPosition == null) {
      return 1;
    }

    return collator.compare(left.title, right.title);
  };
};
export const getConversationComparator = createSelector(
  getIntl,
  getRegionCode,
  _getConversationComparator
);

type LeftPaneLists = Readonly<{
  conversations: ReadonlyArray<ConversationType>;
  archivedConversations: ReadonlyArray<ConversationType>;
  pinnedConversations: ReadonlyArray<ConversationType>;
}>;

// TODO(BA): Remove fake tags once server sends real gextTags
const FAKE_GEXT_TAGS: ReadonlyArray<GextTag> = [
  {
    tagId: '1481965355772549930',
    tagType: 1,
    text: null,
    imgBase64: "data:image/png;base64,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",
    cssBackgroundColor: '#409eff',
    cssColor: '#ffffff',
    cssOpacity: 1.0,
    cssBorderWidth: 0,
    cssBorderRadius: 4,
    cssBorderColor: '#409eff',
    cssBorderStyle: 'solid',
  },
  {
    tagId: '1481961823916923690',
    tagType: 1,
    text: null,
    imgBase64: "data:image/png;base64,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",
    cssBackgroundColor: '#409eff',
    cssColor: '#ffffff',
    cssOpacity: 1.0,
    cssBorderWidth: 0,
    cssBorderRadius: 4,
    cssBorderColor: '#409eff',
    cssBorderStyle: 'solid',
  },
  {
    tagId: '1481956788533336874',
    tagType: 0,
    text: 'Lock',
    imgBase64: null,
    cssBackgroundColor: '#409eff',
    cssColor: '#ffffff',
    cssOpacity: 1.0,
    cssBorderWidth: 0,
    cssBorderRadius: 4,
    cssBorderColor: '#409eff',
    cssBorderStyle: 'solid',
  },
  {
    tagId: '1481956726503775018',
    tagType: 0,
    text: 'External',
    imgBase64: null,
    cssBackgroundColor: '#409eff',
    cssColor: '#ffffff',
    cssOpacity: 1.0,
    cssBorderWidth: 0,
    cssBorderRadius: 4,
    cssBorderColor: '#409eff',
    cssBorderStyle: 'solid',
  },
];
const fakeGextTagConversationIds = new Set<string>();

export const _getLeftPaneLists = (
  lookup: ConversationLookupType,
  comparator: (left: ConversationType, right: ConversationType) => number,
  selectedConversation?: string,
  pinnedConversationIds?: ReadonlyArray<string>
): LeftPaneLists => {
  const conversations: Array<ConversationType> = [];
  const archivedConversations: Array<ConversationType> = [];
  const pinnedConversations: Array<ConversationType> = [];

  const values = Object.values(lookup);
  const max = values.length;
  for (let i = 0; i < max; i += 1) {
    let conversation = values[i];
    if (selectedConversation === conversation.id) {
      conversation = {
        ...conversation,
        isSelected: true,
      };
    }

    // Inject fake tags on all active conversations for testing
    if (conversation.activeAt) {
      fakeGextTagConversationIds.add(conversation.id);
      conversation = { ...conversation, gextTags: FAKE_GEXT_TAGS };
    }

    // We always show pinned conversations
    if (conversation.isPinned) {
      pinnedConversations.push(conversation);
      continue;
    }

    if (conversation.activeAt) {
      if (conversation.isArchived) {
        archivedConversations.push(conversation);
      } else {
        conversations.push(conversation);
      }
    }
  }

  conversations.sort(comparator);
  archivedConversations.sort(comparator);

  pinnedConversations.sort(
    (a, b) =>
      (pinnedConversationIds || []).indexOf(a.id) -
      (pinnedConversationIds || []).indexOf(b.id)
  );

  return { conversations, archivedConversations, pinnedConversations };
};

export const getLeftPaneLists = createSelector(
  getConversationLookup,
  getConversationComparator,
  getSelectedConversationId,
  getPinnedConversationIds,
  _getLeftPaneLists
);

export const getMaximumGroupSizeModalState = createSelector(
  getComposerState,
  (composerState): OneTimeModalState => {
    switch (composerState?.step) {
      case ComposerStep.ChooseGroupMembers:
      case ComposerStep.SetGroupMetadata:
        return composerState.maximumGroupSizeModalState;
      default:
        assertDev(
          false,
          'Can\'t get the maximum group size modal state in this composer state; returning "never shown"'
        );
        return OneTimeModalState.NeverShown;
    }
  }
);

export const getRecommendedGroupSizeModalState = createSelector(
  getComposerState,
  (composerState): OneTimeModalState => {
    switch (composerState?.step) {
      case ComposerStep.ChooseGroupMembers:
      case ComposerStep.SetGroupMetadata:
        return composerState.recommendedGroupSizeModalState;
      default:
        assertDev(
          false,
          'Can\'t get the recommended group size modal state in this composer state; returning "never shown"'
        );
        return OneTimeModalState.NeverShown;
    }
  }
);

export const getMe = createSelector(
  [getConversationLookup, getUserConversationId],
  (
    lookup: ConversationLookupType,
    ourConversationId: string | undefined
  ): ConversationType => {
    if (!ourConversationId) {
      return getPlaceholderContact();
    }
    const me = lookup[ourConversationId] || getPlaceholderContact();
    // TODO(BA): remove when server sends real gextTags
    return me.gextTags ? me : { ...me, gextTags: FAKE_GEXT_TAGS };
    // return lookup[ourConversationId] || getPlaceholderContact();
  }
);

export const getComposerConversationSearchTerm = createSelector(
  getComposerState,
  (composer): string => {
    if (!composer) {
      assertDev(
        false,
        'getComposerConversationSearchTerm: composer is not open'
      );
      return '';
    }
    if (composer.step === ComposerStep.SetGroupMetadata) {
      assertDev(
        false,
        'getComposerConversationSearchTerm: composer does not have a search term'
      );
      return '';
    }
    return composer.searchTerm;
  }
);

export const getComposerSelectedRegion = createSelector(
  getComposerState,
  (composer): string => {
    if (!composer) {
      assertDev(false, 'getComposerSelectedRegion: composer is not open');
      return '';
    }
    if (composer.step !== ComposerStep.FindByPhoneNumber) {
      assertDev(
        false,
        'getComposerSelectedRegion: composer does not have a selected region'
      );
      return '';
    }
    return composer.selectedRegion;
  }
);

export const getComposerUUIDFetchState = createSelector(
  getComposerState,
  (composer): UUIDFetchStateType => {
    if (!composer) {
      assertDev(false, 'getIsFetchingUsername: composer is not open');
      return {};
    }
    if (
      composer.step !== ComposerStep.StartDirectConversation &&
      composer.step !== ComposerStep.FindByUsername &&
      composer.step !== ComposerStep.FindByPhoneNumber &&
      composer.step !== ComposerStep.ChooseGroupMembers
    ) {
      assertDev(
        false,
        `getComposerUUIDFetchState: step ${composer.step} ` +
          'has no uuidFetchState key'
      );
      return {};
    }
    return composer.uuidFetchState;
  }
);

export const getHasContactSpoofingReview = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    return state.hasContactSpoofingReview;
  }
);

function isTrusted(conversation: ConversationType): boolean {
  if (conversation.type === 'group') {
    return true;
  }

  return Boolean(
    isInSystemContacts(conversation) ||
      conversation.sharedGroupNames.length > 0 ||
      conversation.profileSharing ||
      conversation.isMe
  );
}

function hasDisplayInfo(conversation: ConversationType): boolean {
  if (conversation.type === 'group') {
    return Boolean(conversation.name);
  }

  return Boolean(
    conversation.name ||
      conversation.profileName ||
      conversation.phoneNumber ||
      conversation.isMe
  );
}

function canComposeConversation(conversation: ConversationType): boolean {
  return Boolean(
    !isSignalConversation(conversation) &&
      !conversation.isBlocked &&
      !conversation.removalStage &&
      ((isGroupV2(conversation) && !conversation.left) ||
        !isConversationUnregistered(conversation)) &&
      hasDisplayInfo(conversation) &&
      isTrusted(conversation)
  );
}

export const getAllComposableConversations = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      conversation =>
        !isSignalConversation(conversation) &&
        !conversation.isBlocked &&
        !conversation.removalStage &&
        !conversation.isGroupV1AndDisabled &&
        ((isGroupV2(conversation) && !conversation.left) ||
          !isConversationUnregistered(conversation)) &&
        // All conversation should have a title except in weird cases where
        // they don't, in that case we don't want to show these for Forwarding.
        conversation.titleNoDefault &&
        hasDisplayInfo(conversation)
    )
);

export const getAllGroupsWithInviteAccess = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(conversation => {
      return (
        conversation.type === 'group' &&
        conversation.title &&
        conversation.canAddNewMembers
      );
    })
);

export const getAllConversationsUnreadStats = createSelector(
  getAllConversations,
  (conversations): UnreadStats => {
    return countAllConversationsUnreadStats(conversations, {
      includeMuted: false,
    });
  }
);

/**
 * getComposableContacts/getCandidateContactsForNewGroup both return contacts for the
 * composer and group members, a different list from your primary system contacts.
 * This list may include false positives, which is better than missing contacts.
 *
 * Note: the key difference between them:
 *   getComposableContacts includes Note to Self
 *   getCandidateContactsForNewGroup does not include Note to Self
 *
 * Because they filter unregistered contacts and that's (partially) determined by the
 * current time, it's possible for them to return stale contacts that have unregistered
 * if no other conversations change. This should be a rare false positive.
 */
export const getComposableContacts = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      conversation =>
        conversation.type === 'direct' && canComposeConversation(conversation)
    )
);

export const getCandidateContactsForNewGroup = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      conversation =>
        conversation.type === 'direct' &&
        !conversation.isMe &&
        canComposeConversation(conversation)
    )
);

export const getComposableGroups = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      conversation =>
        conversation.type === 'group' && canComposeConversation(conversation)
    )
);

const getConversationIdsWithStories = createSelector(
  (state: StateType): StoriesStateType => state.stories,
  (stories: StoriesStateType): Set<string> => {
    return new Set(stories.stories.map(({ conversationId }) => conversationId));
  }
);

export const getNonGroupStories = createSelector(
  getComposableGroups,
  getConversationIdsWithStories,
  (
    groups: Array<ConversationType>,
    conversationIdsWithStories: Set<string>
  ): Array<ConversationType> => {
    return groups.filter(
      group => !isGroupInStoryMode(group, conversationIdsWithStories)
    );
  }
);

export const selectMostRecentActiveStoryTimestampByGroupOrDistributionList =
  createSelector(
    (state: StateType): ReadonlyArray<StoryDataType> => state.stories.stories,
    (stories: ReadonlyArray<StoryDataType>): Record<string, number> => {
      return reduce<StoryDataType, Record<string, number>>(
        stories,
        (acc, story) => {
          const distributionListOrConversationId =
            story.storyDistributionListId ?? story.conversationId;
          const cur = acc[distributionListOrConversationId];
          if (cur && story.timestamp < cur) {
            return acc;
          }
          return {
            ...acc,
            [distributionListOrConversationId]: story.timestamp,
          };
        },
        {}
      );
    }
  );

export const getGroupStories = createSelector(
  getConversationLookup,
  getConversationIdsWithStories,
  getHasStoriesSelector,
  (
    conversationLookup: ConversationLookupType,
    conversationIdsWithStories: Set<string>,
    hasStoriesSelector
  ): Array<ConversationWithStoriesType> => {
    return Object.values(conversationLookup)
      .filter(
        conversation =>
          isGroupInStoryMode(conversation, conversationIdsWithStories) &&
          !conversation.left
      )
      .map(conversation => ({
        ...conversation,
        hasStories: hasStoriesSelector(conversation.id),
      }));
  }
);

const getNormalizedComposerConversationSearchTerm = createSelector(
  getComposerConversationSearchTerm,
  (searchTerm: string): string => searchTerm.trim()
);

export const getFilteredComposeContacts = createSelector(
  getNormalizedComposerConversationSearchTerm,
  getComposableContacts,
  getRegionCode,
  (
    searchTerm: string,
    contacts: ReadonlyArray<ConversationType>,
    regionCode: string | undefined
  ): Array<ConversationType> => {
    return filterAndSortConversations(contacts, searchTerm, regionCode);
  }
);

export const getFilteredComposeGroups = createSelector(
  getNormalizedComposerConversationSearchTerm,
  getComposableGroups,
  getRegionCode,
  (
    searchTerm: string,
    groups: ReadonlyArray<ConversationType>,
    regionCode: string | undefined
  ): Array<
    ConversationType & {
      membersCount: number;
      disabledReason: undefined;
      memberships: ReadonlyArray<{
        aci: AciString;
        isAdmin: boolean;
      }>;
    }
  > => {
    return filterAndSortConversations(groups, searchTerm, regionCode).map(
      group => ({
        ...group,
        // we don't disable groups when composing, already filtered
        disabledReason: undefined,
        // should always be populated for a group
        membersCount: group.membersCount ?? 0,
        memberships: group.memberships ?? [],
      })
    );
  }
);

export const getFilteredCandidateContactsForNewGroup = createSelector(
  getCandidateContactsForNewGroup,
  getNormalizedComposerConversationSearchTerm,
  getRegionCode,
  (contacts, searchTerm, regionCode): Array<ConversationType> => {
    return filterAndSortConversations(contacts, searchTerm, regionCode);
  }
);

const getGroupCreationComposerState = createSelector(
  getComposerState,
  (
    composerState
  ): {
    groupName: string;
    groupAvatar: undefined | Uint8Array;
    groupExpireTimer: DurationInSeconds;
    selectedConversationIds: ReadonlyArray<string>;
  } => {
    switch (composerState?.step) {
      case ComposerStep.ChooseGroupMembers:
      case ComposerStep.SetGroupMetadata:
        return composerState;
      default:
        assertDev(
          false,
          'getSetGroupMetadataComposerState: expected step to be SetGroupMetadata'
        );
        return {
          groupName: '',
          groupAvatar: undefined,
          groupExpireTimer: DurationInSeconds.ZERO,
          selectedConversationIds: [],
        };
    }
  }
);

export const getComposeGroupAvatar = createSelector(
  getGroupCreationComposerState,
  (composerState): undefined | Uint8Array => composerState.groupAvatar
);

export const getComposeGroupName = createSelector(
  getGroupCreationComposerState,
  (composerState): string => composerState.groupName
);

export const getComposeGroupExpireTimer = createSelector(
  getGroupCreationComposerState,
  (composerState): DurationInSeconds => composerState.groupExpireTimer
);

export const getComposeSelectedContacts = createSelector(
  getConversationLookup,
  getGroupCreationComposerState,
  (conversationLookup, composerState): Array<ConversationType> =>
    deconstructLookup(conversationLookup, composerState.selectedConversationIds)
);

// This is where we will put Conversation selector logic, replicating what
// is currently in models/conversation.getProps()
// What needs to happen to pull that selector logic here?
//   1) contactTypingTimers - that UI-only state needs to be moved to redux
//   2) all of the message selectors need to be reselect-based; today those
//      Backbone-based prop-generation functions expect to get Conversation information
//      directly via ConversationController
export function _conversationSelector(
  conversation?: ConversationType
  // regionCode: string,
  // userNumber: string
): ConversationType {
  if (conversation) {
    // TODO(BA): Inject fake tags for testing; remove once server sends real gextTags
    if (!conversation.gextTags && fakeGextTagConversationIds.has(conversation.id)) {
      return { ...conversation, gextTags: FAKE_GEXT_TAGS };
    }
    return conversation;
  }

  return getPlaceholderContact();
}

// A little optimization to reset our selector cache when high-level application data
//   changes: regionCode and userNumber.
type CachedConversationSelectorType = (
  conversation?: ConversationType
) => ConversationType;
export const getCachedSelectorForConversation = createSelector(
  getRegionCode,
  getUserNumber,
  (): CachedConversationSelectorType => {
    // Note: memoizee will check all parameters provided, and only run our selector
    //   if any of them have changed.
    return memoizee(_conversationSelector, { max: 2000 });
  }
);

export type GetConversationByAnyIdSelectorType = (
  id?: string
) => ConversationType | undefined;
export const getConversationByAnyIdSelector = createSelector(
  getConversationLookup,
  getConversationsByServiceId,
  getConversationsByE164,
  getConversationsByGroupId,
  (
    byId: ConversationLookupType,
    byServiceId: ConversationLookupType,
    byE164: ConversationLookupType,
    byGroupId: ConversationLookupType
  ): GetConversationByAnyIdSelectorType => {
    return (id?: string) => {
      if (!id) {
        return undefined;
      }

      const onGroupId = getOwn(byGroupId, id);
      if (onGroupId) {
        return onGroupId;
      }
      const onServiceId = getOwn(
        byServiceId,
        normalizeServiceId(id, 'getConversationSelector')
      );
      if (onServiceId) {
        return onServiceId;
      }
      const onE164 = getOwn(byE164, id);
      if (onE164) {
        return onE164;
      }
      const onId = getOwn(byId, id);
      if (onId) {
        return onId;
      }

      return undefined;
    };
  }
);

export type GetConversationByIdType = (id?: string) => ConversationType;
export const getConversationSelector = createSelector(
  getCachedSelectorForConversation,
  getConversationByAnyIdSelector,
  (
    selector: CachedConversationSelectorType,
    getById: GetConversationByAnyIdSelectorType
  ): GetConversationByIdType => {
    return (id?: string) => {
      if (!id) {
        return selector(undefined);
      }

      const byId = getById(id);
      if (byId) {
        return selector(byId);
      }

      log.warn(`getConversationSelector: No conversation found for id ${id}`);
      // This will return a placeholder contact
      return selector(undefined);
    };
  }
);

export const getConversationByIdSelector = createSelector(
  getConversationLookup,
  conversationLookup =>
    (id: string): undefined | ConversationType =>{
      const convo = getOwn(conversationLookup, id);
      // TODO(BA): remove when server sends real gextTags
      if (convo && !convo.gextTags && fakeGextTagConversationIds.has(id)) {    
        return { ...convo, gextTags: FAKE_GEXT_TAGS };
      }
      return convo;
      // return getOwn(conversationLookup, id)
    }
);

export const getConversationByServiceIdSelector = createSelector(
  getConversationsByServiceId,
  conversationsByServiceId =>
    (serviceId: ServiceIdString): undefined | ConversationType =>
      getOwn(conversationsByServiceId, serviceId)
);

export const getCachedConversationMemberColorsSelector = createSelector(
  getConversationSelector,
  getUserConversationId,
  (
    conversationSelector: GetConversationByIdType,
    ourConversationId: string | undefined
  ) => {
    return memoizee(
      (conversationId: string | undefined) => {
        const contactNameColors: Map<string, ContactNameColorType> = new Map();
        const {
          sortedGroupMembers = [],
          type,
          id: theirId,
        } = conversationSelector(conversationId);

        if (type === 'direct') {
          if (ourConversationId) {
            contactNameColors.set(ourConversationId, ContactNameColors[0]);
          }
          contactNameColors.set(theirId, ContactNameColors[0]);
          return contactNameColors;
        }

        [...sortedGroupMembers]
          .sort((left, right) =>
            String(left.serviceId) > String(right.serviceId) ? 1 : -1
          )
          .forEach((member, i) => {
            contactNameColors.set(
              member.id,
              ContactNameColors[i % ContactNameColors.length]
            );
          });

        return contactNameColors;
      },
      { max: 100 }
    );
  }
);

export type ContactNameColorSelectorType = (
  conversationId: string,
  contactId: string | undefined
) => ContactNameColorType;

export const getContactNameColorSelector = createSelector(
  getCachedConversationMemberColorsSelector,
  conversationMemberColorsSelector => {
    return (
      conversationId: string,
      contactId: string | undefined
    ): ContactNameColorType => {
      const contactNameColors =
        conversationMemberColorsSelector(conversationId);
      return getContactNameColor(contactNameColors, contactId);
    };
  }
);

export const getContactNameColor = (
  contactNameColors: Map<string, string>,
  contactId: string | undefined
): string => {
  if (!contactId) {
    log.warn('No color generated for missing contactId');
    return ContactNameColors[0];
  }

  const color = contactNameColors.get(contactId);
  if (!color) {
    log.warn(`No color generated for contact ${contactId}`);
    return ContactNameColors[0];
  }
  return color;
};

export function _conversationMessagesSelector(
  conversation: ConversationMessageType
): TimelinePropsType {
  const {
    isNearBottom = null,
    messageChangeCounter,
    messageIds,
    messageLoadingState = null,
    metrics,
    scrollToMessageCounter,
    scrollToMessageId,
  } = conversation;

  const firstId = messageIds[0];
  const lastId =
    messageIds.length === 0 ? undefined : messageIds[messageIds.length - 1];

  const { oldestUnseen } = metrics;

  const haveNewest = !metrics.newest || !lastId || lastId === metrics.newest.id;
  const haveOldest =
    !metrics.oldest || !firstId || firstId === metrics.oldest.id;

  const items = messageIds;

  const oldestUnseenIndex = oldestUnseen
    ? messageIds.findIndex(id => id === oldestUnseen.id)
    : null;
  const scrollToIndex = scrollToMessageId
    ? messageIds.findIndex(id => id === scrollToMessageId)
    : null;
  const { totalUnseen } = metrics;

  return {
    haveNewest,
    haveOldest,
    isNearBottom,
    items,
    messageChangeCounter,
    messageLoadingState,
    oldestUnseenIndex:
      isNumber(oldestUnseenIndex) && oldestUnseenIndex >= 0
        ? oldestUnseenIndex
        : null,
    scrollToIndex:
      isNumber(scrollToIndex) && scrollToIndex >= 0 ? scrollToIndex : null,
    scrollToIndexCounter: scrollToMessageCounter,
    totalUnseen,
  };
}

type CachedConversationMessagesSelectorType = (
  conversation: ConversationMessageType
) => TimelinePropsType;
export const getCachedSelectorForConversationMessages = createSelector(
  getRegionCode,
  getUserNumber,
  (): CachedConversationMessagesSelectorType => {
    // Note: memoizee will check all parameters provided, and only run our selector
    //   if any of them have changed.
    return memoizee(_conversationMessagesSelector, { max: 50 });
  }
);

export const getConversationMessagesSelector = createSelector(
  getCachedSelectorForConversationMessages,
  getMessagesByConversation,
  (
    conversationMessagesSelector: CachedConversationMessagesSelectorType,
    messagesByConversation: MessagesByConversationType
  ) => {
    return (id: string): TimelinePropsType => {
      const conversation = messagesByConversation[id];
      if (!conversation) {
        // TODO: DESKTOP-2340
        return {
          haveNewest: false,
          haveOldest: false,
          messageChangeCounter: 0,
          messageLoadingState: TimelineMessageLoadingState.DoingInitialLoad,
          scrollToIndexCounter: 0,
          totalUnseen: 0,
          items: [],
          isNearBottom: null,
          oldestUnseenIndex: null,
          scrollToIndex: null,
        };
      }

      return conversationMessagesSelector(conversation);
    };
  }
);

export const getInvitedContactsForNewlyCreatedGroup = createSelector(
  getConversationsByServiceId,
  getConversations,
  (
    conversationLookup,
    { invitedServiceIdsForNewlyCreatedGroup = [] }
  ): Array<ConversationType> =>
    deconstructLookup(conversationLookup, invitedServiceIdsForNewlyCreatedGroup)
);

export const getConversationsWithCustomColorSelector = createSelector(
  getAllConversations,
  conversations => {
    return (colorId: string): Array<ConversationType> => {
      return conversations.filter(
        conversation => conversation.customColorId === colorId
      );
    };
  }
);

export function isMissingRequiredProfileSharing(
  conversation: ConversationType
): boolean {
  const doesConversationRequireIt =
    !conversation.isMe &&
    !conversation.left &&
    !conversation.removalStage &&
    (isGroupV1(conversation) || isDirectConversation(conversation));

  return Boolean(
    doesConversationRequireIt &&
      !conversation.profileSharing &&
      conversation.hasMessages
  );
}

export const getGroupAdminsSelector = createSelector(
  getConversationSelector,
  (conversationSelector: GetConversationByIdType) => {
    return (conversationId: string): Array<ConversationType> => {
      const {
        groupId,
        groupVersion,
        memberships = [],
      } = conversationSelector(conversationId);

      if (
        !isGroupV2({
          groupId,
          groupVersion,
        })
      ) {
        return [];
      }

      const admins: Array<ConversationType> = [];
      memberships.forEach(membership => {
        if (membership.isAdmin) {
          const admin = conversationSelector(membership.aci);
          admins.push(admin);
        }
      });
      return admins;
    };
  }
);

export const getContactSelector = createSelector(
  getConversationSelector,
  conversationSelector => {
    return (contactId: string) =>
      pick(conversationSelector(contactId), 'id', 'title', 'serviceId');
  }
);

export const getConversationVerificationData = createSelector(
  getConversations,
  (
    conversations: Readonly<ConversationsStateType>
  ): Record<string, ConversationVerificationData> =>
    conversations.verificationDataByConversation
);

export const getConversationIdsStoppedForVerification = createSelector(
  getConversationVerificationData,
  (verificationDataByConversation): Array<string> =>
    Object.keys(verificationDataByConversation)
);

export const getConversationServiceIdsStoppingSend = createSelector(
  getConversationVerificationData,
  (pendingData): Array<ServiceIdString> => {
    const result = new Set<ServiceIdString>();
    Object.values(pendingData).forEach(item => {
      if (item.type === ConversationVerificationState.PendingVerification) {
        item.serviceIdsNeedingVerification.forEach(serviceId => {
          result.add(serviceId);
        });

        if (item.byDistributionId) {
          Object.values(item.byDistributionId).forEach(distribution => {
            distribution.serviceIdsNeedingVerification.forEach(serviceId => {
              result.add(serviceId);
            });
          });
        }
      }
    });
    return Array.from(result);
  }
);

export const getConversationsStoppingSend = createSelector(
  getConversationSelector,
  getConversationServiceIdsStoppingSend,
  (
    conversationSelector: GetConversationByIdType,
    serviceIds: ReadonlyArray<ServiceIdString>
  ): Array<ConversationType> => {
    const conversations = serviceIds.map(serviceId =>
      conversationSelector(serviceId)
    );
    return sortByTitle(conversations);
  }
);

export const getHideStoryConversationIds = createSelector(
  getConversationLookup,
  (conversationLookup): Array<string> =>
    Object.keys(conversationLookup).filter(
      conversationId => conversationLookup[conversationId].hideStory
    )
);

export const getActivePanel = createSelector(
  getConversations,
  (conversations): PanelRenderType | undefined =>
    conversations.targetedConversationPanels.stack[
      conversations.targetedConversationPanels.watermark
    ]
);

type PanelInformationType = {
  currPanel: PanelRenderType | undefined;
  direction: 'push' | 'pop';
  prevPanel: PanelRenderType | undefined;
};

export const getPanelInformation = createSelector(
  getConversations,
  getActivePanel,
  (conversations, currPanel): PanelInformationType | undefined => {
    const { direction, watermark } = conversations.targetedConversationPanels;

    if (!direction) {
      return;
    }

    const watermarkDirection =
      direction === 'push' ? watermark - 1 : watermark + 1;
    const prevPanel =
      conversations.targetedConversationPanels.stack[watermarkDirection];

    return {
      currPanel,
      direction,
      prevPanel,
    };
  }
);

export const getIsPanelAnimating = createSelector(
  getConversations,
  (conversations): boolean => {
    return conversations.targetedConversationPanels.isAnimating;
  }
);

export const getWasPanelAnimated = createSelector(
  getConversations,
  (conversations): boolean => {
    return conversations.targetedConversationPanels.wasAnimated;
  }
);

export const getConversationTitle = createSelector(
  getIntl,
  getActivePanel,
  (i18n, panel): string | undefined =>
    getConversationTitleForPanelType(i18n, panel?.type)
);

// Note that this doesn't take into account max edit count. See canEditMessage.
export const getLastEditableMessageId = createSelector(
  getConversationMessages,
  getMessages,
  (conversationMessages, messagesLookup): string | undefined => {
    if (!conversationMessages) {
      return;
    }

    for (let i = conversationMessages.messageIds.length - 1; i >= 0; i -= 1) {
      const messageId = conversationMessages.messageIds[i];
      const message = messagesLookup[messageId];

      if (!message) {
        continue;
      }

      if (isOutgoing(message)) {
        return canEditMessage(message) ? message.id : undefined;
      }
    }

    return undefined;
  }
);

export const getPreloadedConversationId = createSelector(
  getConversations,
  ({ preloadData }): string | undefined => preloadData?.conversationId
);

export const getProfileUpdateError = createSelector(
  getConversations,
  ({ hasProfileUpdateError }): boolean => Boolean(hasProfileUpdateError)
);

export const getPendingAvatarDownloadSelector = createSelector(
  getConversations,
  (conversations: ConversationsStateType) => {
    return (conversationId: string): boolean => {
      return Boolean(
        conversations.pendingRequestedAvatarDownload[conversationId]
      );
    };
  }
);
