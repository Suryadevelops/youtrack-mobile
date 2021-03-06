/* @flow */

import * as activityHelper from './issue-activity__helper';
import * as types from '../issue-action-types';
import log from '../../../components/log/log';
import {getActivityCategories, getActivityAllTypes} from '../../../components/activity/activity-helper';

import type Api from '../../../components/api/api';
import type {Activity} from '../../../flow/Activity';
import type {State as SingleIssueState} from '../issue-reducers';

type ApiGetter = () => Api;
type StateGetter = () => { issueState: SingleIssueState };


export function receiveActivityAPIAvailability(activitiesEnabled: boolean) {
  return {type: types.RECEIVE_ACTIVITY_API_AVAILABILITY, activitiesEnabled};
}

export function receiveActivityPage(activityPage: Array<Activity> | null) {
  return {type: types.RECEIVE_ACTIVITY_PAGE, activityPage};
}

export function receiveActivityPageError(error: Error) {
  return {type: types.RECEIVE_ACTIVITY_ERROR, error};
}

export function receiveActivityEnabledTypes() {
  return {
    type: types.RECEIVE_ACTIVITY_CATEGORIES,
    issueActivityTypes: getActivityAllTypes(),
    issueActivityEnabledTypes: activityHelper.getIssueActivitiesEnabledTypes()
  };
}

export function loadActivitiesPage(doNotReset: boolean = false) {
  return async (dispatch: (any) => any, getState: StateGetter, getApi: ApiGetter) => {
    const issueId = getState().issueState.issueId;
    const api: Api = getApi();

    dispatch(receiveActivityEnabledTypes());
    const activityCategories = getActivityCategories(
      activityHelper.getIssueActivitiesEnabledTypes()
    );

    if (!doNotReset) {
      dispatch(receiveActivityPage(null));
    }
    dispatch(receiveActivityAPIAvailability(true));

    try {
      log.info('Loading activities...');
      const activityPage: Array<Activity> = await api.issue.getActivitiesPage(issueId, activityCategories);
      dispatch(receiveActivityPage(activityPage));
      log.info('Received activities', activityPage);
    } catch (error) {
      dispatch(receiveActivityPageError(error));
      dispatch({type: types.RECEIVE_ACTIVITY_ERROR, error});
      log.warn('Failed to load activity', error);
    }
  };
}

