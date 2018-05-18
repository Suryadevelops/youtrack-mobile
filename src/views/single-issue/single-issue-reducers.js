/* @flow */
import {createReducer} from 'redux-create-reducer';
import * as types from './single-issue-action-types';
import {ON_NAVIGATE_BACK} from '../../actions/action-types';
import type {IssueFull} from '../../flow/Issue';
import type {CustomField, FieldValue, IssueProject, CommandSuggestionResponse, IssueComment} from '../../flow/CustomFields';

export type State = {
  issueId: string,
  issue: IssueFull,
  unloadedIssueState: ?State,
  isRefreshing: boolean,
  issueLoaded: boolean,
  commentsLoaded: boolean,
  issueComments: ?Array<IssueComment>,
  commentsLoadingError: ?Error,
  editMode: boolean,
  isSavingEditedIssue: boolean,
  attachingImage: ?Object,
  addCommentMode: boolean,
  submittingComment: boolean,
  commentText: string,
  editingComment: ?IssueComment,
  summaryCopy: string,
  descriptionCopy: string,
  suggestionsAreLoading: boolean,
  commentSuggestions: ?Object,
  showCommandDialog: boolean,
  initialCommand: string,
  commandSuggestions: ?CommandSuggestionResponse,
  commandIsApplying: boolean
};

const initialState: State = {
  unloadedIssueState: null,
  issueId: '',
  issue: null,
  isRefreshing: false,
  issueLoaded: false,
  commentsLoaded: false,
  issueComments: null,
  commentsLoadingError: null,
  editMode: false,
  isSavingEditedIssue: false,
  attachingImage: null,
  addCommentMode: false,
  submittingComment: false,
  commentText: '',
  editingComment: null,
  summaryCopy: '',
  descriptionCopy: '',
  suggestionsAreLoading: false,
  commentSuggestions: null,
  showCommandDialog: false,
  initialCommand: '',
  commandSuggestions: null,
  commandIsApplying: false
};

export default createReducer(initialState, {
  [ON_NAVIGATE_BACK]: (state: State, action: {closingView: {routeName: string, params: {issueId?: string}}}): State => {
    const isIssueView = action.closingView.routeName === 'SingleIssue';

    const previousIssueState = state.unloadedIssueState ? state.unloadedIssueState : initialState;

    return isIssueView ? previousIssueState : state;
  },
  [types.SET_ISSUE_ID]: (state: State, action: {issueId: string}): State => {
    return {...state, issueId: action.issueId};
  },
  [types.RESET_SINGLE_ISSUE]: (state: State, action: {issueId: string}): State => {
    return initialState;
  },
  [types.START_ISSUE_REFRESHING]: (state: State): State => {
    return {...state, isRefreshing: true};
  },
  [types.STOP_ISSUE_REFRESHING]: (state: State): State => {
    return {...state, isRefreshing: false};
  },
  [types.RECEIVE_ISSUE]: (state: State, action: {issue: IssueFull}): State => {
    return {
      ...state,
      issueLoaded: true,
      issue: {
        ...action.issue,
        comments: state.issueComments
      }
    };
  },
  [types.RECEIVE_COMMENTS]: (state: State, action: {comments: Array<IssueComment>}): State => {
    const {comments} = action;
    return {
      ...state,
      commentsLoaded: true,
      issueComments: comments,
      issue: state.issue ? {...state.issue, comments} : state.issue
    };
  },
  [types.RECEIVE_COMMENTS_ERROR]: (state: State, action: {error: Error}): State => {
    return {...state, commentsLoadingError: action.error};
  },
  [types.SHOW_COMMENT_INPUT]: (state: State): State => {
    return {...state, addCommentMode: true};
  },
  [types.HIDE_COMMENT_INPUT]: (state: State): State => {
    return {...state, addCommentMode: false};
  },
  [types.START_SUBMITTING_COMMENT]: (state: State, action: {comment: string}): State => {
    return {...state, submittingComment: true, commentText: action.comment};
  },
  [types.STOP_SUBMITTING_COMMENT]: (state: State): State => {
    return {...state, submittingComment: false};
  },
  [types.SET_COMMENT_TEXT]: (state: State, action: {comment: string}): State => {
    return {...state, commentText: action.comment};
  },
  [types.RECEIVE_COMMENT]: (state: State, action: {comment: IssueComment}): State => {
    return {
      ...state,
      issue: {
        ...state.issue,
        comments: [
          ...state.issue.comments,
          action.comment
        ]
      }
    };
  },
  [types.SET_EDITING_COMMENT]: (state: State, action: {comment: IssueComment}): State => {
    return {...state, editingComment: action.comment};
  },
  [types.CLEAR_EDITING_COMMENT]: (state: State): State => {
    return {...state, editingComment: null};
  },
  [types.RECEIVE_UPDATED_COMMENT]: (state: State, action: {comment: IssueComment}): State => {
    const {comment} = action;
    return {
      ...state,
      issue: {
        ...state.issue,
        comments: state.issue.comments.map(it => it.id === comment.id ? comment : it)
      }
    };
  },
  [types.DELETE_COMMENT]: (state: State, action: {comment: IssueComment}): State => {
    const {comment} = action;
    return {
      ...state,
      issue: {
        ...state.issue,
        comments: state.issue.comments.filter(it => it.id !== comment.id)
      }
    };
  },
  [types.START_EDITING_ISSUE]: (state: State): State => {
    return {
      ...state,
      summaryCopy: state.issue.summary,
      descriptionCopy: state.issue.description,
      editMode: true
    };
  },
  [types.STOP_EDITING_ISSUE]: (state: State): State => {
    return {...state, editMode: false, summaryCopy: '', descriptionCopy: ''};
  },
  [types.SET_ISSUE_SUMMARY_AND_DESCRIPTION]: (state: State, action: {summary: string, description: string}): State => {
    return {
      ...state,
      issue: {
        ...state.issue,
        summary: action.summary,
        description: action.description
      }
    };
  },
  [types.SET_ISSUE_SUMMARY_COPY]: (state: State, action: {summary: string}): State => {
    return {
      ...state,
      summaryCopy: action.summary
    };
  },
  [types.SET_ISSUE_DESCRIPTION_COPY]: (state: State, action: {description: string}): State => {
    return {
      ...state,
      descriptionCopy: action.description
    };
  },
  [types.START_SAVING_EDITED_ISSUE]: (state: State,): State => {
    return {...state, isSavingEditedIssue: true};
  },
  [types.STOP_SAVING_EDITED_ISSUE]: (state: State): State => {
    return {...state, isSavingEditedIssue: false};
  },
  [types.SET_ISSUE_FIELD_VALUE]: (state: State, action: {field: CustomField, value: FieldValue}): State => {
    const {field, value} = action;
    return {
      ...state,
      issue: {
          ...state.issue,
          fields: [...state.issue.fields].map(it => {
            return it === field ? {...it, value} : it;
          })
        }
    };
  },
  [types.SET_PROJECT]: (state: State, action: {project: IssueProject}): State => {
    return {
      ...state,
      issue: {
        ...state.issue,
        project: action.project
      }
    };
  },
  [types.SET_COMMENT_TEXT]: (state: State, action: {comment: string}): State => {
    return {...state, commentText: action.comment};
  },
  [types.START_IMAGE_ATTACHING](state: State, action: {attachingImage: Object}): State {
    const {attachingImage} = action;
    return {
      ...state,
      issue: {
        ...state.issue,
        attachments: [...state.issue.attachments, attachingImage],
      },
      attachingImage
    };
  },
  [types.REMOVE_ATTACHING_IMAGE](state: State): State {
    return {
      ...state,
      issue: {
        ...state.issue,
        attachments: state.issue.attachments.filter(attach => attach !== state.attachingImage),
      },
      attachingImage: null
    };
  },
  [types.STOP_IMAGE_ATTACHING](state: State): State {
    return {...state, attachingImage: null};
  },
  [types.SET_VOTED]: (state: State, action: {voted: boolean}): State => {
    const {issue} = state;
    const {voted} = action;
    return {
      ...state,
      issue: {
        ...issue,
        votes: voted ? issue.votes + 1 : issue.votes - 1,
        voters: {
          ...state.issue.voters,
          hasVote: voted
        }
      }
    };
  },
  [types.SET_STARRED]: (state: State, action: {starred: boolean}): State => {
    const {issue} = state;
    const {starred} = action;
    return {
      ...state,
      issue: {
        ...issue,
        watchers: {
          ...issue.watchers,
          hasStar: starred
        }
      }
    };
  },
  [types.UNLOAD_ACTIVE_ISSUE_VIEW]: (state: State, action: {starred: boolean}): State => {
    return {...initialState, unloadedIssueState: state};
  },
  [types.START_LOADING_COMMENT_SUGGESTIONS]: (state: State): State => {
    return {...state, suggestionsAreLoading: true};
  },
  [types.STOP_LOADING_COMMENT_SUGGESTIONS]: (state: State): State => {
    return {...state, suggestionsAreLoading: false};
  },
  [types.RECEIVE_COMMENT_SUGGESTIONS]: (state: State, action: {suggestions: Object}): State => {
    return {...state, commentSuggestions: action.suggestions};
  },
  [types.OPEN_COMMAND_DIALOG]: (state: State, action: {initialCommand: string}): State => {
    return {...state, showCommandDialog: true, initialCommand: action.initialCommand};
  },
  [types.CLOSE_COMMAND_DIALOG]: (state: State): State => {
    return {...state, showCommandDialog: false, commandSuggestions: null, initialCommand: ''};
  },
  [types.RECEIVE_COMMAND_SUGGESTIONS]: (state: State, action: {suggestions: Object}): State => {
    return {...state, commandSuggestions: action.suggestions};
  },
  [types.START_APPLYING_COMMAND]: (state: State): State => {
    return {...state, commandIsApplying: true};
  },
  [types.STOP_APPLYING_COMMAND]: (state: State): State => {
    return {...state, commandIsApplying: false};
  },
});
