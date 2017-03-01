
declare type IssueOnList = {
  id: string,
  summary: string,
  resolved: boolean,
  project: IssueProject,
  numberInProject: number,
  reporter: IssueUser,
  created: number,
  updated: number,
  fields: Array<CustomField>,
  fieldHash: any
}

declare type IssueFull = {
  id: string,
  summary: string,
  description: string,
  resolved: boolean,
  created: number,
  updated: number,
  numberInProject: number,
  wikifiedDescription: string,
  project: IssueProject,
  reporter: IssueUser,
  updater: IssueUser,
  fields: Array<CustomField>,
  tags: Array<Tag>,
  attachments: Array<Attachment>,
  comments: Array<IssueComment>,
  links: Array<IssueLink>,
  fieldHash: any
};

declare type AnyIssue = IssueOnList | IssueFull;

declare type ServersideSuggestion = {
  o: string,
  d: string,
  hd: string,
  pre: string,
  suf: string,
  ms: number,
  me: number,
  cp: number,
  cs: number,
  ce: number
};