/* @flow */

import ApiBase from './api__base';

import type Auth from '../auth/auth';
import type {IssueProject} from '../../flow/CustomFields';

export default class ProjectsAPI extends ApiBase {
  pinProjectURL: string = `${this.youTrackApiUrl}/admin/users/me/pinnedProjects`;

  constructor(auth: Auth) {
    super(auth);
  }

  async addFavorite(projectId: string): Promise<IssueProject> {
    return this.makeAuthorizedRequest(this.pinProjectURL, 'POST', {id: projectId});
  }

  async removeFavorite(projectId: string): Promise<IssueProject> {
    return this.makeAuthorizedRequest(`${this.pinProjectURL}/${projectId}`, 'DELETE', null, {parseJson: false});
  }

  async toggleFavorite(projectId: string, pinned: boolean): Promise<IssueProject> {
    if (pinned) {
      return this.removeFavorite(projectId);
    } else {
      return this.addFavorite(projectId);
    }
  }
}
