/* @flow */

import {FlatList, View, Text, RefreshControl, TouchableOpacity} from 'react-native';
import React, {Component} from 'react';

import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';

import * as inboxActions from './inbox-actions';
import CustomFieldChangeDelimiter from '../../components/custom-field/custom-field__change-delimiter';
import Diff from '../../components/diff/diff';
import ErrorMessage from '../../components/error-message/error-message';
import log from '../../components/log/log';
import ReactionIcon from '../../components/reactions/reaction-icon';
import Router from '../../components/router/router';
import usage from '../../components/usage/usage';
import UserInfo from '../../components/user/user-info';
import YoutrackWiki from '../../components/wiki/youtrack-wiki';
import CommentReactions from '../../components/comment/comment-reactions';
import {getReadableID} from '../../components/issue-formatter/issue-formatter';
import {getStorageState} from '../../components/storage/storage';
import {handleRelativeUrl} from '../../components/config/config';
import {hasType} from '../../components/api/api__resource-types';
import {guid, isReactElement} from '../../util/util';
import {LoadMoreList} from '../../components/progress/load-more-list';
import {SkeletonIssueActivities} from '../../components/skeleton/skeleton';
import {ThemeContext} from '../../components/theme/theme-context';

import {UNIT} from '../../components/variables/variables';

import styles from './inbox.styles';

import type {AppConfigFilled} from '../../flow/AppConfig';
import type {InboxState} from './inbox-reducers';
import type {IssueComment} from '../../flow/CustomFields';
import type {IssueOnList} from '../../flow/Issue';
import type {Notification, Metadata, ChangeValue, ChangeEvent, Issue, IssueChange} from '../../flow/Inbox';
import type {Reaction} from '../../flow/Reaction';
import type {Theme} from '../../flow/Theme';
import type {User} from '../../flow/User';

const CATEGORY_NAME = 'inbox view';

type Props = InboxState & typeof inboxActions;

type State = {
  isTitlePinned: boolean
};

const Category: Object = {
  CREATED: 'CREATED',
  LINKS: 'LINKS',
  COMMENT: 'COMMENT',
  SUMMARY: 'SUMMARY',
  DESCRIPTION: 'DESCRIPTION'
};

const MAX_TEXT_CHANGE_LENGTH: number = 5000;

class Inbox extends Component<Props, State> {
  static notificationReasons = {
    mentionReasons: 'Mention',
    tagReasons: '',
    savedSearchReasons: '',
    workflow: 'Workflow'
  };
  config: AppConfigFilled;
  theme: Theme;

  constructor(props) {
    super(props);
    this.state = {isTitlePinned: false};
    this.config = getStorageState().config;
    usage.trackScreenView(CATEGORY_NAME);
  }

  componentDidMount() {
    this.refresh();
  }

  refresh = () => {
    this.props.loadInbox();
  };

  goToIssue(issue: Issue) {
    if (!issue?.id) {
      return;
    }

    log.debug(`Opening issue "${issue.id}" from notifications`);
    Router.Issue({
      issuePlaceholder: {
        id: issue.id,
        summary: issue?.summary,
        description: issue?.description,
        created: issue?.created
      },
      issueId: issue.id
    });
  }

  onLoadMore = () => {
    const {loading, items, hasMore} = this.props;
    if (!loading && items.length > 0 && hasMore) {
      this.props.loadInbox(items.length);
    }
  };

  renderValues(values: Array<ChangeValue> = [], eventId: string) {
    return (
      values.map((it) => {
        const value = this.getChangeValue(it);
        return (
          <Text
            key={`${eventId}-${value}`}
            numberOfLines={5}
            style={styles.textPrimary}>
            {value}
          </Text>
        );
      })
    );
  }

  isCreateCategory(change): boolean {
    return change.category === Category.CREATED;
  }

  getChangeValue(change): string {
    if (change.category === Category.LINKS) {
      return change.id;
    }

    if (typeof change.name === 'string' && change.name.length > MAX_TEXT_CHANGE_LENGTH) {
      return `${change.name.substr(0, MAX_TEXT_CHANGE_LENGTH)}...`;
    }

    return change.name;
  }

  isEventHasField(event: ChangeEvent, fieldName: string): boolean {
    return Boolean(event && event[fieldName] && event[fieldName].length);
  }

  hasAddedValues(event: ChangeEvent): boolean {
    return this.isEventHasField(event, 'addedValues');
  }

  hasRemovedValues(event: ChangeEvent): boolean {
    return this.isEventHasField(event, 'removedValues');
  }

  renderMultiValueCustomFieldChange(event: ChangeEvent) {
    const combinedChangeValue = (values: Array<ChangeValue> = []) => (
      values.map(it => {
        it.category = event.category;
        return it;
      }).map(this.getChangeValue).join(delimiter)
    );

    const delimiter = ', ';
    const added: string = combinedChangeValue(event.addedValues);
    const removed: string = combinedChangeValue(event.removedValues);
    const hasRemovedChange: boolean = this.hasRemovedValues(event);

    return (
      <Text>
        {hasRemovedChange && <Text style={styles.changeRemoved}>
          {removed}
        </Text>}
        {this.hasAddedValues(event) && (<Text style={styles.textPrimary}>
          {hasRemovedChange ? delimiter : ''}
          {added}
        </Text>)}
      </Text>
    );
  }

  renderSingleValueCustomFieldChange(event: ChangeEvent) {
    const hasAddedValues: boolean = this.hasAddedValues(event);
    const hasRemovedValues: boolean = this.hasRemovedValues(event);
    const hasDelimiter: boolean = hasAddedValues && hasRemovedValues;

    return (
      <Text>
        {hasRemovedValues && (
          <Text style={!hasAddedValues ? styles.changeRemoved : null}>
            {this.renderValues(event.removedValues, event.entityId)}
          </Text>
        )}
        {hasDelimiter && <Text style={styles.textPrimary}>{CustomFieldChangeDelimiter}</Text>}
        {hasAddedValues && this.renderValues(event.addedValues, event.entityId)}
      </Text>
    );
  }

  renderCustomFieldChange(event: ChangeEvent) {
    return (
      event?.multiValue === true
        ? this.renderMultiValueCustomFieldChange(event)
        : this.renderSingleValueCustomFieldChange(event)
    );
  }

  renderTextDiff(event: IssueChange, title: ?string) {
    return (
      <Diff
        title={title || 'Details'}
        text1={this.getChangeValue(event.removedValues[0])}
        text2={this.getChangeValue(event.addedValues[0])}
      />
    );
  }

  renderLinks(event: ChangeEvent) {
    const issues = [].concat(event.addedValues).concat(event.removedValues);

    return (
      issues.map((issue: IssueOnList) => {
        return (
          <TouchableOpacity key={guid()}>
            <Text onPress={() => Router.Issue({issueId: issue.id})}>
              <Text style={styles.link}>
                <Text style={[styles.link, issue.resolved ? styles.resolved : null]}>
                  {issue.id}
                </Text>
                {` ${issue.summary}`}
              </Text>
            </Text>
          </TouchableOpacity>
        );
      })
    );
  }

  renderEventItem(event: ChangeEvent) {
    const textChangeEventName = (event: ChangeEvent) => `${event.name} changed`;
    const renderEventName = (event: ChangeEvent) => <Text style={styles.textSecondary}>{event.name}: </Text>;

    if (!this.hasAddedValues(event) && !this.hasRemovedValues(event)) {
      return null;
    }

    switch (true) {
    case event.category === Category.COMMENT: //TODO(xi-eye): filter out text update events
      return (
        <View style={styles.change}>
          {this.hasRemovedValues(event) && (
            this.getChangeValue(event.removedValues[0]).length
              ? this.renderTextDiff(event, textChangeEventName(event))
              : <View>{renderEventName(event)}{this.renderValues(event.addedValues, event.entityId)}</View>
          )}
        </View>
      );

    case event.category === Category.SUMMARY || event.category === Category.DESCRIPTION:
      return (
        this.renderTextDiff(event, textChangeEventName(event))
      );

    case event.category === Category.LINKS:
      return (
        <View style={styles.change}>
          {renderEventName(event)}
          {this.renderLinks(event)}
        </View>
      );

    default:
      return (
        <View style={styles.change}>
          {renderEventName(event)}
          {this.renderCustomFieldChange(event)}
        </View>
      );
    }
  }

  renderEvents(events: Array<ChangeEvent> = []) {
    const nodes = events.reduce((list, event) => {
      const item = this.renderEventItem(event);
      item && list.push(item);
      return list;
    }, []);

    return (
      <View>
        {nodes.map((node, index) =>
          (
            <View
              key={index}
              style={index > 0 ? styles.changeItem : null}
            >
              {node}
            </View>
          )
        )}
      </View>
    );
  }

  isIssueDigestChange(metadata: Metadata): boolean {
    return metadata && metadata.change;
  }

  isWorkflowNotification(metadata: Metadata): boolean {
    return !this.isIssueDigestChange(metadata) && (metadata.body || metadata.text || metadata.subject);
  }

  renderWorkflowNotification(text: string) {
    const title: string = Inbox.notificationReasons.workflow;
    const workflowMetadata: Metadata = {
      reason: {
        [title]: [{title}]
      }
    };

    return (
      <View style={styles.notification}>
        <View><Text style={[styles.textPrimary, styles.notificationIssueInfo]}>{`${title}:`}</Text></View>

        <View style={[styles.notificationContent, styles.notificationContentWorkflow]}>
          <YoutrackWiki
            backendUrl={this.config.backendUrl}
            onIssueIdTap={(issueId) => Router.Issue({issueId})}
            uiTheme={this.theme.uiTheme}
          >
            {text}
          </YoutrackWiki>
        </View>

        {this.renderNotificationReason(workflowMetadata)}
      </View>
    );
  }

  getWorkflowNotificationText(metadata: Metadata): string {
    const PARSE_ERROR_NOTIFICATION: string = '<i>Unable to parse workflow notification.</i>';
    let text: string;

    if (metadata.body && metadata.body.indexOf('<html') === 0) {
      text = `${metadata.subject || ''}\n${metadata.text || ''}`;
      text = text.trim().length ? text.replace(/\s+/g, ' ') : PARSE_ERROR_NOTIFICATION;
    } else {
      text = metadata.body || metadata.text || metadata.subject;
    }

    return text || PARSE_ERROR_NOTIFICATION;
  }

  renderItem = ({item}: Notification | Object & { key: string }) => {
    if (isReactElement(item)) {
      return item;
    }

    const metadata: Metadata = item?.metadata;
    let renderer = null;

    if (hasType.commentReaction(item)) {
      renderer = this.renderReactionChange(item);
    } else if (metadata && this.isIssueDigestChange(metadata)) {
      renderer = metadata.issue ? this.renderIssueChange(metadata, item.sender) : null;
    } else if (metadata && this.isWorkflowNotification(metadata)) {
      renderer = this.renderWorkflowNotification(this.getWorkflowNotificationText(metadata));
    }

    return renderer;
  };

  createAvatarUrl(sender: User = {}): string | null {
    if (!sender.avatarUrl || !this.config || !this.config.backendUrl) {
      return null;
    }
    return handleRelativeUrl(sender.avatarUrl, this.config.backendUrl);
  }

  renderNotificationReason(metadata: Metadata) {
    const _reasons = Object.keys(metadata.reason || []).reduce((reasons, key) => {
      if (metadata.reason[key].length) {
        return reasons.concat(
          {
            title: Inbox.notificationReasons[key] ? `${Inbox.notificationReasons[key]} ` : '',
            value: metadata.reason[key].map((it: Object) => it.name).join(', ')
          }
        );
      }
      return reasons;
    }, []);

    if (_reasons?.length) {
      const reasonsPresentation: string = _reasons.map(
        (it) => it.title.trim() + it.value.trim()
      ).filter(Boolean).join(', ');

      if (reasonsPresentation.length > 0) {
        return <View>
          <Text style={styles.reason}>
            {reasonsPresentation}
          </Text>
        </View>;
      }
      return null;
    }
  }

  renderIssue(issue: IssueOnList) {
    const readableID: string = getReadableID(issue);
    return (
      <TouchableOpacity
        style={styles.notificationIssue}
        onPress={() => this.goToIssue(issue)}
      >
        <Text>
          {!!readableID && (
            <Text style={[
              styles.notificationIssueInfo,
              issue.resolved ? styles.resolved : null
            ]}>{readableID}</Text>
          )}
          {!!issue.summary && (
            <Text numberOfLines={2} style={[styles.notificationIssueInfo, issue.resolved && styles.secondaryText]}>
              {` ${issue.summary}`}
            </Text>
          )}
        </Text>
      </TouchableOpacity>
    );
  }

  renderReactionChange = (reactionData: {
    $type: string,
    id: string,
    added: boolean,
    comment: IssueComment,
    reaction: Reaction,
    timestamp: number
  }) => {
    const {added, comment, timestamp, reaction} = reactionData;
    const issue: IssueOnList = comment.issue;

    return (
      <View style={styles.notification}>
        <UserInfo
          avatar={
            <View style={styles.reactionIcon}>
              <ReactionIcon name={reaction.reaction} size={24}/>
              {!added && <View style={styles.reactionIconRemoved}/>}
            </View>
          }
          additionalInfo={`\n${reactionData.added ? 'added a reaction' : 'removed a reaction'}`}
          style={{...styles.userInfo, marginBottom: 16}}
          timestamp={timestamp}
          user={reaction.author}
        />

        <View style={styles.notificationContent}>
          {this.renderIssue(issue)}
          <View style={styles.notificationChange}>
            <Text style={styles.secondaryText}>{comment.text}</Text>
            <CommentReactions
              comment={comment}
              currentUser={this.props.currentUser}
            />
          </View>
        </View>
      </View>
    );
  }


  renderIssueChange(metadata: Metadata, sender: User = {}) {
    const {issue, change} = metadata;

    if (!issue) {
      return null;
    }

    const events: Array<ChangeEvent> = (change?.events || []).filter((event) => !this.isCreateCategory(event));
    const avatarURL: string | null = this.createAvatarUrl(sender);
    if (avatarURL) {
      sender.avatarUrl = avatarURL;
    }

    return (
      <View style={styles.notification}>
        <UserInfo style={styles.userInfo} user={sender} timestamp={change?.endTimestamp}/>

        <View style={styles.notificationContent}>
          {this.renderIssue(issue)}
          {events.length > 0 && (
            <View style={styles.notificationChange}>
              {this.renderEvents(events)}
            </View>
          )}

          {this.renderNotificationReason(metadata)}
        </View>
      </View>
    );
  }

  renderListMessage = () => {
    const {loading, items, hasMore} = this.props;

    if (loading) {
      return <SkeletonIssueActivities marginTop={UNIT * 2} marginLeft={UNIT} marginRight={UNIT}/>;
    }

    if (!loading && items.length === 0) {
      return (
        <View>
          <Text style={styles.listMessageSmile}>(・_・)</Text>
          <Text
            style={styles.listFooterMessage}
            testID="no-notifications"
          >
            You have no notifications
          </Text>
        </View>
      );
    }

    if (items.length > 0 && loading && hasMore) {
      return <LoadMoreList/>;
    }

    return null;
  };

  renderRefreshControl = () => {
    return (
      <RefreshControl
        refreshing={false}
        onRefresh={this.refresh}
        tintColor={this.theme.uiTheme.colors.$link}
        testID="refresh-control"
      />
    );
  };

  renderTitle() {
    return (
      <View
        key="activityHeaderTitle"
        style={[
          styles.headerTitle,
          this.state.isTitlePinned ? styles.titleShadow : null
        ]}
      >
        <Text style={styles.headerTitleText}>Notifications</Text>
      </View>
    );
  }

  onScroll = ({nativeEvent}) => {
    const newY = nativeEvent.contentOffset.y;
    this.setState({
      isTitlePinned: newY >= UNIT
    });
  };

  render() {
    const {loading, error, items} = this.props;
    const hasError: boolean = !!error;
    return (
      <ThemeContext.Consumer>
        {(theme: Theme) => {
          this.theme = theme;

          const data: Array<React$Element<any> | Notification> = [this.renderTitle()].concat(items || []);

          return (
            <View style={styles.container}>

              {hasError && (
                <View style={styles.error}>
                  <ErrorMessage error={error}/>
                </View>
              )}

              {!hasError && <FlatList
                removeClippedSubviews={false}
                data={data}
                refreshControl={this.renderRefreshControl()}
                refreshing={loading}
                keyExtractor={(item: Object & { key: string } | Notification, index: number) => {
                  return `${(item.key || item.id)}-${index}`;
                }}
                renderItem={this.renderItem}
                onEndReached={this.onLoadMore}
                onEndReachedThreshold={0.1}
                onScroll={this.onScroll}
                ListFooterComponent={this.renderListMessage}
                scrollEventThrottle={10}
                stickyHeaderIndices={[0]}
              />}
            </View>
          );
        }}
      </ThemeContext.Consumer>
    );
  }
}

const mapStateToProps = (state, ownProps) => {
  return {
    ...state.inbox,
    ...ownProps,
    currentUser: state.app.user
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    ...bindActionCreators(inboxActions, dispatch)
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Inbox);
