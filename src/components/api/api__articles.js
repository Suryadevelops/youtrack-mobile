/* @flow */

import qs from 'qs';

import ApiBase from './api__base';
import issueActivityPageFields from './api__activities-issue-fields';
import issueFields from './api__issue-fields';
import {activityArticleCategory} from '../activity/activity__category';

import type {Article} from '../../flow/Article';
import type {Activity} from '../../flow/Activity';
import type {IssueComment} from '../../flow/CustomFields';

export default class ArticlesAPI extends ApiBase {
  articleFields = 'fields=hasStar,content,created,updated,updatedBy(@permittedUsers),mentionedUsers(@permittedUsers),mentionedArticles(id,idReadable,reporter(@permittedUsers),summary,project(@project),parentArticle(idReadable),ordinal,visibility(@visibility),hasUnpublishedChanges),mentionedIssues(id,reporter(@permittedUsers),resolved,updated,created,fields(value(id,name,localizedName,color(@color),minutes,presentation,text,ringId,login,fullName,avatarUrl,allUsersGroup,icon),id,$type,hasStateMachine,isUpdatable,projectCustomField($type,id,field(id,name,aliases,localizedName,fieldType(valueType,isMultiValue)),bundle(id),canBeEmpty,emptyFieldText,isSpentTime)),project(@project),visibility(@visibility),tags(id,name,query,issuesUrl,color(@color),isDeletable,isShareable,isUpdatable,isUsable,owner(@permittedUsers),readSharingSettings(@updateSharingSettings),tagSharingSettings(@updateSharingSettings),updateSharingSettings(@updateSharingSettings)),watchers(hasStar),idReadable,summary),attachments(id,name,author(ringId),mimeType,url,size,visibility(@visibility),imageDimensions(width,height)),id,idReadable,reporter(@permittedUsers),summary,project(@project),parentArticle(idReadable),ordinal,visibility(@visibility),hasUnpublishedChanges;@visibility:$type,implicitPermittedUsers(@permittedUsers),permittedGroups(@permittedGroups),permittedUsers(@permittedUsers);@updateSharingSettings:permittedGroups(@permittedGroups),permittedUsers(@permittedUsers);@project:id,ringId,name,shortName,iconUrl,template,pinned,archived,isDemo;@permittedUsers:id,ringId,name,login,fullName,avatarUrl;@permittedGroups:id,name,ringId,allUsersGroup,icon;@color:id,background,foreground';
  categories: Array<string> = Object.keys(activityArticleCategory).map((key: string) => activityArticleCategory[key]);
  commentFields: string = issueFields.issueComment.toString();
  articleCommentFieldsQuery: string = ApiBase.createFieldsQuery(this.commentFields);

  async get(query: string | null = null, $top: number = 10000, $skip: number = 0): Promise<Array<Article>> {
    const fields: string = ApiBase.createFieldsQuery(
      ['id,idReadable,summary,parentArticle(id),project(id,name),ordinal,visibility($type)'],
      {
        ...{$top},
        ...{$skip},
        ...{query}
      }
    );
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles?${fields}`
    );
  }

  async getArticle(articleId: string): Promise<Article> {
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles/${articleId}?${this.articleFields}`
    );
  }

  async updateArticle(articleId: string, data: Object | null = null): Promise<Article> {
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles/${articleId}?${this.articleFields}`,
      'POST',
      data
    );
  }

  async getActivitiesPage(articleId: string): Promise<Array<Activity>> {
    const categoryKey = '&categories=';
    const categories = `${categoryKey}${(this.categories).join(categoryKey)}`;
    const queryString = qs.stringify({
      $top: 100,
      reverse: true,
      fields: issueActivityPageFields.toString()
    });

    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles/${articleId}/activitiesPage?${queryString}${categories}`);
  }

  async getArticleDrafts(articleIdReadable: string): Promise<Article> {
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/admin/users/me/articleDrafts/?${this.articleFields}&original=${articleIdReadable}`,
      'GET'
    );
  }

  async createArticleDraft(articleId: string): Promise<Article> {
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/admin/users/me/articleDrafts?${this.articleFields}`,
      'POST',
      {originalArticle: {id: articleId}}
    );
  }

  async updateArticleDraft(article: Article): Promise<Article> {
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/admin/users/me/articleDrafts/${article.id}?${this.articleFields}`,
      'POST',
      {
        content: article.content,
        parentArticle: article.parentArticle,
        project: article.project,
        summary: article.summary,
        visibility: article.visibility
      }
    );
  }

  async publishArticleDraft(articleDraftId: string): Promise<Article> {
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles/?draftId=${articleDraftId}`,
      'POST',
      {}
    );
  }

  getVisibilityOptions = async (articleId: string): Promise<Article> => {
    const queryString = ApiBase.createFieldsQuery(
      issueFields.getVisibility.toString(),
      {$visibilityTop: 50, $visibilitySkip: 0},
    );
    return await this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles/${articleId}/visibilityOptions/?${queryString}`,
      'GET',
    );
  };

  async getCommentDraft(articleId: string): Promise<Comment> {
    const fields: string = ApiBase.createFieldsQuery(
      {draftComment: this.commentFields}
    );
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles/${articleId}/?${fields}`,
      'GET'
    );
  }

  async doUpdateCommentDraft(articleId: string, commentText: string, method: string): Promise<Comment> {
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles/${articleId}/draftComment?${this.articleCommentFieldsQuery}`,
      method,
      {
        text: commentText,
        usesMarkdown: true
      }
    );
  }

  async createCommentDraft(articleId: string, commentText: string): Promise<IssueComment> {
    return this.doUpdateCommentDraft(articleId, commentText, 'PUT');
  }

  async updateCommentDraft(articleId: string, commentText: string): Promise<IssueComment> {
    return this.doUpdateCommentDraft(articleId, commentText, 'POST');
  }

  async submitCommentDraft(articleId: string, articleCommentDraftId: string): Promise<IssueComment> {
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles/${articleId}/comments?draftId=${articleCommentDraftId}&${this.articleCommentFieldsQuery}`,
      'POST',
      {}
    );
  }

  async updateComment(articleId: string, comment: IssueComment): Promise<IssueComment> {
    return this.makeAuthorizedRequest(
      `${this.youTrackApiUrl}/articles/${articleId}/comments/${comment.id}?${this.articleCommentFieldsQuery}`,
      'POST',
      {
        text: comment.text,
        usesMarkdown: true,
        visibility: comment.visibility || null
      }
    );
  }

}
