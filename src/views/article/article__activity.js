/* @flow */

import React, {useEffect, useState} from 'react';
import {ScrollView} from 'react-native';

import {useDispatch, useSelector} from 'react-redux';
import {useActionSheet} from '@expo/react-native-action-sheet';

import ArticleActivityStream from './article__activity-stream';
import ArticleAddComment from './article__add-comment';
import ArticleEditComment from './article__activity-edit-comment';
import IssuePermissions from '../../components/issue-permissions/issue-permissions';
import Router from '../../components/router/router';
import {createActivityModel} from '../../components/activity/activity-helper';
import {loadActivitiesPage, showArticleCommentActions} from './arcticle-actions';

import styles from './article.styles';

import type {ActivityItem, ActivityStreamCommentActions} from '../../flow/Activity';
import type {Article} from '../../flow/Article';
import type {IssueComment} from '../../flow/CustomFields';
import type {UITheme} from '../../flow/Theme';
import type {User, UserAppearanceProfile} from '../../flow/User';

type Props = {
  article: Article,
  issuePermissions: IssuePermissions,
  renderRefreshControl: (Function) => React$Element<any>,
  uiTheme: UITheme
};


const ArticleActivities = (props: Props) => {
  const {article, uiTheme, renderRefreshControl, issuePermissions} = props;

  const dispatch: Function = useDispatch();
  const {showActionSheetWithOptions} = useActionSheet();
  const [activities, updateActivityModel] = useState(null);

  const activityPage: Array<ActivityItem> = useSelector(store => store.article.activityPage);
  const user: User = useSelector(store => store.app.user);
  const loadActivities: Function = (reset: boolean) => {
    if (article?.idReadable) {
      dispatch(loadActivitiesPage(reset));
    }
  };

  useEffect(loadActivities, []);

  useEffect(() => {
    if (activityPage) {
      const userAppearanceProfile: ?UserAppearanceProfile = user?.profiles?.appearance;
      const naturalCommentsOrder: boolean = userAppearanceProfile ? userAppearanceProfile.naturalCommentsOrder : true;
      updateActivityModel(createActivityModel(activityPage, naturalCommentsOrder));
    }
  }, [activityPage]);


  const canDeleteComment = (comment: IssueComment): boolean => issuePermissions.articleCanDeleteComment(
    article, comment
  );
  const createCommentActions = (): ActivityStreamCommentActions => ({
    isAuthor: (comment: IssueComment) => issuePermissions.isCurrentUser(comment.author),
    canUpdateComment: (comment: IssueComment) => issuePermissions.articleCanUpdateComment(article, comment),
    onStartEditing: (comment: Comment) => {
      Router.PageModal({
        children: (
          <ArticleEditComment
            comment={comment}
            uiTheme={uiTheme}
          />
        )
      });
    },
    onShowCommentActions: async (comment: IssueComment, activityId: string) => dispatch(
      showArticleCommentActions(
        showActionSheetWithOptions,
        comment,
        activityId,
        canDeleteComment(comment)
      )
    ),
    canDeleteComment: canDeleteComment
  });

  return (
    <>
      <ScrollView
        refreshControl={renderRefreshControl(() => loadActivities(false))}
        contentContainerStyle={styles.articleActivities}
      >
        <ArticleActivityStream
          activities={activities}
          attachments={article?.attachments}
          uiTheme={uiTheme}
          user={user}
          issuePermissions={issuePermissions}
          commentActions={createCommentActions()}
        />
      </ScrollView>
      {issuePermissions.articleCanCommentOn(article) && (
        <ArticleAddComment
          issuePermissions={issuePermissions}
          onAdd={() => loadActivities(false)}
          uiTheme={uiTheme}
        />
      )}
    </>
  );
};

export default React.memo<Props>(ArticleActivities);
