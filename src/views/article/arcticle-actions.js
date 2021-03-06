/* @flow */

import {ANALYTICS_ARTICLE_PAGE} from '../../components/analytics/analytics-ids';
import {Alert, Clipboard, Share} from 'react-native';

import Router from '../../components/router/router';
import {confirmation} from '../../components/confirmation/confirmation';
import {getApi} from '../../components/api/api__instance';
import {getEntityPresentation} from '../../components/issue-formatter/issue-formatter';
import {hasType} from '../../components/api/api__resource-types';
import {isIOSPlatform, until} from '../../util/util';
import {logEvent} from '../../components/log/log-helper';
import {notify} from '../../components/notification/notification';
import {
  setActivityPage,
  setArticle,
  setArticleCommentDraft,
  setError,
  setLoading,
  setPrevArticle,
  setProcessing,
} from './article-reducers';
import {showActions, showActionSheet} from '../../components/action-sheet/action-sheet';

import type ActionSheet, {ActionSheetOptions} from '@expo/react-native-action-sheet';
import type Api from '../../components/api/api';
import type {AppState} from '../../reducers';
import type {Article, ArticleDraft} from '../../flow/Article';
import type {ArticleState} from './article-reducers';
import type {IssueComment} from '../../flow/CustomFields';
import type {ShowActionSheetWithOptions} from '../../components/action-sheet/action-sheet';

type ApiGetter = () => Api;

const articleLogMessagePrefix: string = `Article:`;

const loadArticle = (articleId: string, reset: boolean = true) => {
  return async (dispatch: (any) => any, getState: () => AppState, getApi: ApiGetter) => {
    const api: Api = getApi();

    logEvent({message: 'Loading article', analyticsId: ANALYTICS_ARTICLE_PAGE});

    if (reset) {
      dispatch(setLoading(true));
      dispatch(setArticle(null));
    }
    const [error, article] = await until(api.articles.getArticle(articleId));
    dispatch(setLoading(false));

    if (error) {
      dispatch(setError(error));
      logEvent({message: 'Failed to load articles', isError: true});
    } else {
      dispatch(setArticle(article));
    }
  };
};

const loadActivitiesPage = (reset: boolean = true) => {
  return async (dispatch: (any) => any, getState: () => AppState, getApi: ApiGetter) => {
    const api: Api = getApi();
    const {article}: Article = getState().article;

    if (reset) {
      dispatch(setActivityPage(null));
      dispatch(setLoading(true));
    }
    const [error, activityPage] = await until(api.articles.getActivitiesPage(article.id));
    dispatch(setLoading(false));

    if (error) {
      dispatch(setError(error));
      logEvent({message: 'Failed to load articles activities', isError: true});
    } else {
      dispatch(setActivityPage(activityPage.activities));
      logEvent({message: 'Articles activity page loaded'});
    }
  };
};

const showArticleActions = (actionSheet: ActionSheet, canUpdate: boolean, canDelete: boolean) => {
  return async (dispatch: (any) => any, getState: () => AppState, getApi: ApiGetter) => {
    const api: Api = getApi();
    const {article} = getState().article;
    const url: string = `${api.config.backendUrl}/articles/${article.idReadable}`;

    const actions = [
      {
        title: 'Share…',
        execute: () => {
          const msg: string = 'Share article URL';
          if (isIOSPlatform()) {
            Share.share({url});
          } else {
            Share.share({title: article.summary, message: url}, {dialogTitle: msg});
          }
          logEvent({message: msg, analyticsId: ANALYTICS_ARTICLE_PAGE});
        }
      },
      {
        title: 'Copy article URL',
        execute: () => {
          Clipboard.setString(url);
          logEvent({message: 'Copy article URL', analyticsId: ANALYTICS_ARTICLE_PAGE});
        }
      }
    ];

    if (canUpdate) {
      actions.push({
        title: 'Edit',
        execute: async () => {
          logEvent({message: `${articleLogMessagePrefix} Edit article`, analyticsId: ANALYTICS_ARTICLE_PAGE});
          const articleDraft: Article | null = await getArticleDraft(api, article);
          if (articleDraft) {
            Router.ArticleCreate({articleDraft: {...articleDraft, idReadable: article.idReadable}});
          }
        }
      });
    }

    if (canDelete) {
      actions.push({
        title: 'Delete',
        execute: async () => {
          logEvent({message: `${articleLogMessagePrefix} Delete article`, analyticsId: ANALYTICS_ARTICLE_PAGE});
          await confirmation('Are you sure you want to delete this article?', 'Delete');
          dispatch(deleteArticle(article, () => Router.KnowledgeBase()));
        }
      });
    }

    actions.push({title: 'Cancel'});

    const selectedAction = await showActions(actions, actionSheet);

    if (selectedAction && selectedAction.execute) {
      selectedAction.execute();
    }
  };
};

const getArticleDraft = async (api: Api, article: Article): Promise<ArticleDraft | null> => {
  let articleDraft: ArticleDraft | null = null;

  const [error, articleDrafts] = await until(api.articles.getArticleDrafts(null, article.id));

  if (error) {
    logEvent({message: `Failed to load ${article.idReadable} article drafts`, isError: true});
  } else {
    if (articleDrafts.length === 0) {
      articleDraft = await createArticleDraft(api, article);
    } else {
      articleDraft = articleDrafts[0];
      articleDraft.$isUnpublishedDraft = true;
    }
  }

  return articleDraft;
};

const createArticleDraft = async (api: Api, article: Article): Promise<ArticleDraft | null> => {
  let articleDraft: Article | null = null;

  const [createDraftError, draft] = await until(api.articles.createArticleDraft(article.id));
  if (createDraftError) {
    logEvent({message: `Failed to create a draft for the article ${article.idReadable}`, isError: true});
  } else {
    articleDraft = draft;
  }

  return articleDraft;
};

const deleteArticle = (article: Article, onAfterDelete?: () => any) => {
  return async (dispatch: (any) => any, getState: () => AppState, getApi: ApiGetter) => {
    const api: Api = getApi();
    const isDraft: boolean = hasType.articleDraft(article);

    dispatch(setProcessing(true));
    const [error] = await until(
      isDraft
        ? api.articles.deleteDraft(article.id)
        : api.articles.deleteArticle(article.id)
    );
    dispatch(setProcessing(false));

    if (error) {
      const errorMsg: string = 'Failed to delete article';
      logEvent({message: errorMsg, isError: true});
      notify(errorMsg, error);
    } else if (onAfterDelete) {
      onAfterDelete();
    }
  };
};

const setPreviousArticle = () => {
  return async (dispatch: (any) => any, getState: () => AppState) => {
    const articleState: ArticleState = getState().article;
    dispatch(setPrevArticle(articleState));
  };
};

const createArticleCommentDraft = (commentDraftText: string) => {
  return async (dispatch: (any) => any, getState: () => AppState) => {
    const api: Api = getApi();
    const {article}: Article = getState().article;

    const [error, commentDraft] = await until(api.articles.createCommentDraft(article.id, commentDraftText));
    if (error) {
      notify('Failed to create a comment draft', error);
      return null;
    } else {
      await dispatch(setArticleCommentDraft(commentDraft));
      return commentDraft;
    }
  };
};

const getArticleCommentDraft = () => {
  return async (dispatch: (any) => any, getState: () => AppState) => {
    const api: Api = getApi();
    const {article}: Article = getState().article;

    const [error, articleDraftCommentResponse] = await until(api.articles.getCommentDraft(article.id));
    if (!error && articleDraftCommentResponse.draftComment) {
      dispatch(setArticleCommentDraft(articleDraftCommentResponse.draftComment));
    }
  };
};

const updateArticleCommentDraft = (commentDraftText: string) => {
  return async (dispatch: (any) => any, getState: () => AppState) => {
    const api: Api = getApi();
    const {article}: Article = getState().article;
    const articleCommentDraft: ?Comment = getState().article.articleCommentDraft;

    if (!articleCommentDraft) {
      await dispatch(createArticleCommentDraft(commentDraftText));
    }

    const [error, updatedCommentDraft] = await until(api.articles.updateCommentDraft(article.id, commentDraftText));
    if (error) {
      notify('Failed to update a comment draft', error);
    } else {
      dispatch(setArticleCommentDraft(updatedCommentDraft));
    }
  };
};

const submitArticleCommentDraft = (commentDraftText: string) => {
  return async (dispatch: (any) => any, getState: () => AppState) => {
    const api: Api = getApi();
    const {article}: Article = getState().article;
    const articleCommentDraft: IssueComment = getState().article.articleCommentDraft;

    await dispatch(updateArticleCommentDraft(commentDraftText));
    const [error] = await until(api.articles.submitCommentDraft(article.id, articleCommentDraft.id));
    if (error) {
      notify('Failed to update a comment draft', error);
    } else {
      logEvent({message: `${articleLogMessagePrefix} comment added`, analyticsId: ANALYTICS_ARTICLE_PAGE});
      dispatch(setArticleCommentDraft(null));
    }
  };
};

const updateArticleComment = (comment: IssueComment) => {
  return async (dispatch: (any) => any, getState: () => AppState) => {
    const api: Api = getApi();
    const {article}: Article = getState().article;

    const [error] = await until(api.articles.updateComment(article.id, comment));
    if (error) {
      notify('Failed to update a comment', error);
    } else {
      logEvent({message: `${articleLogMessagePrefix} comment updated`, analyticsId: ANALYTICS_ARTICLE_PAGE});
      dispatch(loadActivitiesPage());
    }
  };
};

const deleteArticleComment = (commentId: string) => {
  return async (dispatch: (any) => any, getState: () => AppState) => {
    const api: Api = getApi();
    const {article}: Article = getState().article;

    try {
      await new Promise((resolve: Function, reject: Function) => {
        Alert.alert(
          'Are you sure you want to delete comment?',
          null,
          [
            {text: 'Cancel', style: 'cancel', onPress: reject},
            {text: 'Delete', onPress: resolve}
          ],
          {cancelable: true}
        );
      });

      const [error] = await until(api.articles.deleteComment(article.id, commentId));
      if (error) {
        notify('Failed to delete a comment', error);
      } else {
        logEvent({message: `${articleLogMessagePrefix} comment deleted`, analyticsId: ANALYTICS_ARTICLE_PAGE});
        dispatch(loadActivitiesPage());
      }
    } catch (error) {
      //
    }
  };
};

const showArticleCommentActions = (
  showActionSheetWithOptions: ShowActionSheetWithOptions,
  comment: IssueComment,
  activityId: string,
  canDeleteComment: boolean
) => {
  return async (dispatch: (any) => any, getState: () => AppState, getApi: ApiGetter) => {
    const api: Api = getApi();
    const {article} = getState().article;

    const url: string = `${api.config.backendUrl}/articles/${article.idReadable}#comment${activityId}`;
    const commentText = comment.text;
    const options: Array<ActionSheetOptions> = [
      {
        title: 'Share…',
        execute: function (): string {
          const params: Object = {};
          const isIOS: boolean = isIOSPlatform();

          if (isIOS) {
            params.url = url;
          } else {
            params.title = commentText;
            params.message = url;
          }
          Share.share(params, {dialogTitle: 'Share URL'});
          return this.title;
        }
      },
      {
        title: 'Copy URL',
        execute: function (): string {
          Clipboard.setString(url);
          return this.title;
        }
      }
    ];

    if (canDeleteComment) {
      options.push({
        title: 'Delete',
        execute: function () {
          dispatch(deleteArticleComment(comment.id));
          return this.title;
        }
      });
    }

    options.push({title: 'Cancel'});

    const selectedAction = await showActionSheet(
      options,
      showActionSheetWithOptions,
      comment?.author ? getEntityPresentation(comment.author) : null,
      commentText.length > 155 ? `${commentText.substr(0, 153)}…` : commentText
    );
    if (selectedAction && selectedAction.execute) {
      const actionTitle: string = selectedAction.execute();
      logEvent({message: `${articleLogMessagePrefix} comment ${actionTitle}`, analyticsId: ANALYTICS_ARTICLE_PAGE});
    }
  };
};

const getMentions = (query: string) => {
  return async (dispatch: (any) => any, getState: () => AppState, getApi: ApiGetter) => {
    const api: Api = getApi();
    const {article} = getState().article;
    const [error, mentions] = await until(
      api.mentions.getMentions(query, {containers: [{$type: article.$type, id: article.id}]}));
    if (error) {
      notify('Failed to load user mentions', error);
      return null;
    }
    return mentions;
  };
};

const toggleFavorite = () => {
  return async (dispatch: (any) => any, getState: () => AppState, getApi: ApiGetter) => {
    const api: Api = getApi();
    const {article} = getState().article;

    const prev: boolean = article.hasStar;
    dispatch(setArticle({...article, hasStar: !prev}));

    const [error] = await until(api.articles.updateArticle(article.id, {hasStar: !prev}));
    if (error) {
      notify('Failed to update the article', error);
      dispatch(setArticle({...article, hasStar: prev}));
    }
  };
};


export {
  loadArticle,
  loadActivitiesPage,
  showArticleActions,
  setPreviousArticle,
  deleteArticle,

  getArticleCommentDraft,
  updateArticleCommentDraft,
  submitArticleCommentDraft,

  updateArticleComment,

  showArticleCommentActions,
  deleteArticleComment,

  getMentions,
  toggleFavorite
};
